import json
import logging
import math
import os
import threading
import time
from datetime import datetime, timezone

import requests
from apexomni.helpers.util import round_size
from google.cloud import pubsub_v1

from database import database
from models.apex import AccountData
from utils.trades import Trades
from utils.types import BreakoutBotRequest, IPerpetual, ISymbols
from utils import db

# Internal Stream URL for WebSocket push after notification INSERT
_STREAM_INTERNAL_URL = os.getenv("STREAM_INTERNAL_URL", "https://stream.eagleailabs.com")
_INTERNAL_NOTIFICATION_SECRET = os.getenv("INTERNAL_NOTIFICATION_SECRET", "")


class PermanentError(Exception):
    """Raised for failures that cannot be resolved by retrying the message.
    The Pub/Sub callback will ACK these so the message is not redelivered."""


# Maps signal name → (notification_type, icon, priority)
_BREAKOUT_SIGNAL_META = {
    "Entry":     ("trade_entry", "mdi:rocket-launch",    "high"),
    "TP1":       ("tp1_hit",     "mdi:target",            "medium"),
    "TP2":       ("tp2_hit",     "mdi:target",            "medium"),
    "TP3":       ("tp3_hit",     "mdi:bullseye-arrow",    "high"),
    "SL":        ("sl_hit",      "mdi:alert-circle",      "critical"),
    "SL-UPDATE": ("sl_hit",      "mdi:alert-circle",      "critical"),
}


class Autotrade:
    def __init__(self, name: str, topic: str, subscription: str) -> None:
        self.name = name
        self.topic = topic
        self.subscription = subscription

        self.trades = Trades()

    def _get_account_snapshot(self, r, user, client):
        """Get account snapshot from Redis, falling back to Apex API.

        Returns the account data dict or raises ValueError if neither works.
        """
        cached = r.get(f"{user}@account.apex")
        if cached is not None:
            parsed = json.loads(str(cached))
            return parsed["data"]

        # Redis miss — fetch live from Apex API and cache it
        print(f"[{self.name}]: No Redis snapshot for {user}, fetching from Apex API")
        try:
            account_resp = client.get_account_v3()
            if "code" in account_resp:
                raise ValueError(account_resp)
            account_data = account_resp.get("data", {})
            # Cache it for future use (60s TTL)
            r.setex(f"{user}@account.apex", 60, json.dumps({"data": account_data}))
            return account_data
        except Exception as e:
            raise ValueError(
                f"User {user} has no Redis snapshot and Apex API fallback failed: {e}"
            )

    def _get_pro_position_from_db(self, pro_user_id, symbol, position_side):
        """Look up the pro's current position size from the positions table.

        The DB is authoritative and avoids the Redis partial-snapshot problem
        where Redis may only reflect a fraction of the pro's actual position
        (e.g. if they added units outside our copy-tracking window).

        Returns the absolute position size as a float, or 0.0 on any failure.
        """
        try:
            db_conn = database.postgres.getconn()
            if db_conn is None:
                return 0.0
            try:
                cur = db_conn.cursor()
                cur.execute(
                    """
                    SELECT ABS(CAST("size" AS numeric)) AS pos_size
                      FROM public.positions
                     WHERE user_id = %s
                       AND symbol = %s
                       AND side = %s
                       AND CAST("size" AS numeric) != 0
                     LIMIT 1
                    """,
                    (int(pro_user_id), symbol, position_side),
                )
                row = cur.fetchone()
                cur.close()
                if row is None:
                    return 0.0
                return float(row[0]) if row[0] is not None else 0.0
            finally:
                database.postgres.putconn(db_conn)
        except Exception as e:
            print(f"[{self.name}]: _get_pro_position_from_db failed pro={pro_user_id} sym={symbol}: {e}")
            return 0.0

    def _get_copytrade_position_size(
        self, follower_user_id, pro_user_id, symbol: str, position_side: str
    ) -> float:
        """Return the net size this follower opened for a specific pro via copytrade.

        Sums MARKET entry orders minus MARKET close orders in copy_trade_orders
        for the (follower, pro, symbol, side) combination. Returns 0.0 when no
        copytrade history exists — caller should fall back to full-position logic.
        """
        entry_side = "SELL" if position_side == "SHORT" else "BUY"
        close_side = "BUY" if position_side == "SHORT" else "SELL"

        try:
            db_conn = database.postgres.getconn()
            if db_conn is None:
                return 0.0
            try:
                cur = db_conn.cursor()
                cur.execute(
                    """
                    SELECT
                        COALESCE(SUM(CASE WHEN cto.side = %s THEN cto.qty ELSE 0 END), 0)
                        - COALESCE(SUM(CASE WHEN cto.side = %s THEN cto.qty ELSE 0 END), 0)
                          AS net_copytrade_qty
                      FROM public.copy_trade_orders cto
                      JOIN public.copy_trade_decisions ctd
                        ON ctd.id = cto.decision_id
                     WHERE cto.follower_user_id = %s
                       AND ctd.pro_user_id = %s
                       AND cto.symbol = %s
                       AND cto.type = 'MARKET'
                    """,
                    (entry_side, close_side, int(follower_user_id), int(pro_user_id), symbol),
                )
                row = cur.fetchone()
                cur.close()
                if row is None:
                    return 0.0
                val = row[0]
                result = float(val) if val is not None else 0.0
                return max(result, 0.0)
            finally:
                database.postgres.putconn(db_conn)
        except Exception as e:
            print(
                f"[{self.name}]: _get_copytrade_position_size failed "
                f"follower={follower_user_id} pro={pro_user_id} sym={symbol}: {e}"
            )
            return 0.0

    def _get_follower_position(self, account, symbol, position_side):
        """Find the follower's position for a given symbol and side.

        Returns (position_dict, position_size_float) or (None, 0.0).
        """
        for position in account.get("positions", []) or []:
            if (
                position.get("symbol") == symbol
                and position.get("side") == position_side
                and float(position.get("size", 0)) != 0
            ):
                return position, float(position.get("size", 0))
        return None, 0.0

    def _cancel_existing_orders(self, conn, r, client, user, symbol, order_type, timestamp):
        """Cancel all UNTRIGGERED orders of a given type for a symbol.

        Used to clean up old SL/TP before placing new ones.
        """
        cached = r.get(f"{user}@account.apex")
        if cached is None:
            return

        parsed = json.loads(str(cached))
        account = parsed["data"]

        for order in account.get("orders", []):
            if (
                order.get("status") == "UNTRIGGERED"
                and order.get("type") == order_type
                and order.get("symbol") == symbol
            ):
                print(
                    f"[{self.name} {timestamp}]: Canceling existing {order_type} order {order.get('id')} for {user} on {symbol}"
                )
                s = self.trades.cancel_order(
                    conn=conn,
                    client=client,
                    user_id=user,
                    id=order.get("id"),
                )
                print(f"[{self.name} {timestamp}]: {s}")

    def _notify_breakout(
        self,
        conn,
        user_id: int,
        signal_name: str,
        symbol: str,
        side: str,
        price: str,
        model_name: str,
    ):
        """Insert a notification for a breakout bot signal.

        Checks the user's notification_preferences first — if they have
        dashboard disabled for breakout_bot, skip silently.
        Falls back to enabled if no preference row exists (default on).
        Never raises — notification failure must not block order execution.
        """
        meta = _BREAKOUT_SIGNAL_META.get(signal_name)
        if meta is None:
            return

        notification_type, icon, priority = meta
        # Derive display direction from order side (BUY=LONG, SELL=SHORT).
        # For TP/SL signals the order side is the *closing* direction (opposite
        # of the position), so we invert: SELL on a TP means the position is LONG.
        order_side = side.upper()
        if signal_name in ("TP1", "TP2", "TP3", "SL", "SL-UPDATE"):
            display_direction = "LONG" if order_side == "SELL" else "SHORT"
        else:
            display_direction = "LONG" if order_side == "BUY" else "SHORT"
        clean_symbol = symbol.replace("-", "/")  # BTC-USDT → BTC/USDT
        # Strip trailing USDT for a cleaner label: BTC/USDT → BTC
        base = clean_symbol.split("/")[0]

        # Build human-readable title and message per signal type
        level_labels = {"TP1": "First", "TP2": "Second", "TP3": "Final"}
        if signal_name == "Entry":
            title = f"Breakout Signal: {base} {display_direction}"
            message = f"{model_name} — {display_direction} entry on {clean_symbol} at ${price}"
        elif signal_name in ("TP1", "TP2", "TP3"):
            level = signal_name
            label = level_labels.get(level, level)
            title = f"{level} Hit: {clean_symbol}"
            message = f"{model_name} — {label} take profit hit on {display_direction} {clean_symbol} at ${price}"
        else:  # SL / SL-UPDATE
            title = f"Trade Invalidated: {clean_symbol}"
            message = f"{model_name} — {display_direction} trade on {clean_symbol} invalidated. Stop loss at ${price}"

        try:
            cur = conn.cursor()

            # Check user's per-type notification preference — default to enabled
            cur.execute(
                """
                SELECT COALESCE(dashboard, true)
                FROM notification_preferences
                WHERE user_id = %s AND feature = 'breakout_bot' AND notification_type = %s
                LIMIT 1
                """,
                (user_id, notification_type),
            )
            row = cur.fetchone()
            dashboard_enabled = row[0] if row else True

            if not dashboard_enabled:
                cur.close()
                return

            cur.execute(
                """
                INSERT INTO notifications
                    (user_id, feature, notification_type, title, message, icon, priority, metadata)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id,
                    "breakout_bot",
                    notification_type,
                    title,
                    message,
                    icon,
                    priority,
                    json.dumps({
                        "symbol": symbol,
                        "side": display_direction,
                        "price": price,
                        "model": model_name,
                        "signal": signal_name,
                    }),
                ),
            )
            # Fetch the inserted row so we can push the full object to the WebSocket
            cur2 = conn.cursor()
            cur2.execute(
                """
                SELECT id, user_id, feature, notification_type, title, message,
                       icon, priority, read, action_url, action_label, metadata, created_at
                FROM notifications
                WHERE user_id = %s
                ORDER BY id DESC LIMIT 1
                """,
                (user_id,),
            )
            row2 = cur2.fetchone()
            cur2.close()
            conn.commit()
            cur.close()
            print(f"[{self.name}]: Notification inserted for user={user_id} signal={signal_name} symbol={symbol} model={model_name}")

            # Push to user's live WebSocket connection via Stream internal endpoint
            if row2 and _INTERNAL_NOTIFICATION_SECRET:
                notification_obj = {
                    "id": row2[0],
                    "user_id": row2[1],
                    "feature": row2[2],
                    "notification_type": row2[3],
                    "title": row2[4],
                    "message": row2[5],
                    "icon": row2[6],
                    "priority": row2[7],
                    "read": row2[8],
                    "action_url": row2[9],
                    "action_label": row2[10],
                    "metadata": row2[11],
                    "created_at": row2[12].isoformat() if row2[12] else None,
                }
                try:
                    requests.post(
                        f"{_STREAM_INTERNAL_URL}/internal/notifications/push",
                        json={"user_id": user_id, "notification": notification_obj},
                        headers={"X-Internal-Token": _INTERNAL_NOTIFICATION_SECRET},
                        timeout=3,
                    )
                    print(f"[{self.name}]: WebSocket push sent for user={user_id} notification_id={row2[0]}")
                except Exception as push_err:
                    print(f"[{self.name}]: WebSocket push failed (non-critical) for user={user_id}: {push_err}")

        except Exception as e:
            print(f"[{self.name}]: Failed to insert notification for user={user_id}: {e}")

    # Semaphore: max 1 broadcast in flight at a time — prevents thread pile-up
    # when multiple signals fire in quick succession
    _broadcast_semaphore = threading.Semaphore(1)

    def _broadcast_signal_alert(
        self,
        symbol: str,
        side: str,
        price: str,
        model_name: str,
        order_logic: str = "",
        tp1: str = "",
        tp2: str = "",
        tp3: str = "",
        sl: str = "",
    ):
        """Broadcast a signal alert to every user who has opted in to the matching
        version's signal_alert notification — regardless of whether they are a
        breakout bot auto-trader subscriber.

        Uses notification_type = signal_alert_v1 / v2 / v3 / v4 based on order_logic.
        Includes TP1/TP2/TP3/SL in the notification body and metadata when provided.

        Runs in a daemon thread so it never blocks trade execution.
        Never raises.

        Optimised: bulk INSERT all users in one query, single HTTP call with all
        user IDs, semaphore prevents concurrent broadcasts piling up threads.
        """
        _version_map = {
            "v1": "signal_alert_v1",
            "v2": "signal_alert_v2",
            "v3": "signal_alert_v3",
            "v4c": "signal_alert_v4",
            "v4r": "signal_alert_v4",
        }
        notification_type = _version_map.get(order_logic.lower(), "signal_alert_v1")

        def _run():
            if not Autotrade._broadcast_semaphore.acquire(blocking=False):
                print(f"[{self.name}]: signal_alert skipped (broadcast already in progress) for {symbol}")
                return

            conn = None
            try:
                if database.postgres is None:
                    return
                conn = database.postgres.getconn()
                if conn is None:
                    return

                order_side = side.upper()
                display_direction = "LONG" if order_side == "BUY" else "SHORT"
                clean_symbol = symbol.replace("-", "/")
                base = clean_symbol.split("/")[0]
                version_label = order_logic.upper() if order_logic else "V1"

                def _fmt(val: str) -> str:
                    """Strip floating-point noise: 82.60000000001 → 82.6"""
                    if not val:
                        return ""
                    try:
                        return f"{float(val):.8g}"
                    except (ValueError, TypeError):
                        return val

                title = f"Breakout Signal: {base} {display_direction}"

                # Build message body — include TP/SL if provided
                msg_parts = [f"BreakoutBot {version_label} — {display_direction} entry on {clean_symbol} at ${_fmt(price)}"]
                tp_parts = [f"TP{i}: ${_fmt(v)}" for i, v in enumerate([tp1, tp2, tp3], 1) if v]
                if tp_parts:
                    msg_parts.append(" | ".join(tp_parts))
                if sl:
                    msg_parts.append(f"SL: ${_fmt(sl)}")
                message = " · ".join(msg_parts)

                icon = "mdi:chart-line-variant"
                priority = "high"
                metadata = json.dumps({
                    "symbol": symbol,
                    "side": display_direction,
                    "price": price,
                    "tp1": tp1,
                    "tp2": tp2,
                    "tp3": tp3,
                    "sl": sl,
                    "model": model_name,
                    "version": order_logic,
                    "signal": "Entry",
                })

                cur = conn.cursor()

                # 1. Get all opted-in users
                cur.execute(
                    """
                    SELECT user_id FROM notification_preferences
                    WHERE feature = 'breakout_bot'
                      AND notification_type = %s
                      AND COALESCE(dashboard, true) = true
                    """,
                    (notification_type,),
                )
                opted_in = [row[0] for row in cur.fetchall()]
                cur.close()

                if not opted_in:
                    return

                print(f"[{self.name}]: {notification_type} broadcast to {len(opted_in)} users for {symbol} {display_direction}")

                # 2. Bulk INSERT all notifications in one query — not one per user
                from psycopg2.extras import execute_values
                cur = conn.cursor()
                rows = [
                    (uid, "breakout_bot", notification_type, title, message, icon, priority, metadata)
                    for uid in opted_in
                ]
                execute_values(
                    cur,
                    """
                    INSERT INTO notifications
                        (user_id, feature, notification_type, title, message, icon, priority, metadata)
                    VALUES %s
                    RETURNING id, user_id, feature, notification_type, title, message,
                              icon, priority, read, action_url, action_label, metadata, created_at
                    """,
                    rows,
                )
                inserted = cur.fetchall()
                conn.commit()
                cur.close()

                # 3. Single HTTP call to Stream with all user IDs — not one per user
                if inserted and _INTERNAL_NOTIFICATION_SECRET:
                    notifications = [
                        {
                            "id": row[0], "user_id": row[1], "feature": row[2],
                            "notification_type": row[3], "title": row[4], "message": row[5],
                            "icon": row[6], "priority": row[7], "read": row[8],
                            "action_url": row[9], "action_label": row[10],
                            "metadata": row[11],
                            "created_at": row[12].isoformat() if row[12] else None,
                        }
                        for row in inserted
                    ]
                    try:
                        requests.post(
                            f"{_STREAM_INTERNAL_URL}/internal/notifications/push-bulk",
                            json={"notifications": notifications},
                            headers={"X-Internal-Token": _INTERNAL_NOTIFICATION_SECRET},
                            timeout=5,
                        )
                    except Exception:
                        pass

            except Exception as e:
                print(f"[{self.name}]: _broadcast_signal_alert failed: {e}")
                try:
                    if conn:
                        conn.rollback()
                except Exception:
                    pass
            finally:
                if conn and database.postgres:
                    database.postgres.putconn(conn)
                Autotrade._broadcast_semaphore.release()

        threading.Thread(target=_run, daemon=True).start()

    def callback(self, message):
        conn = None
        user = ""
        _ack = True  # Set to False for retryable failures so Pub/Sub redelivers

        try:
            data: BreakoutBotRequest = json.loads(message.data.decode("utf-8"))

            execution_id = data.get("execution_id")
            name = data.get("name")
            symbol = data.get("symbol")
            side = data.get("side")
            size = data.get("qty")
            type = data.get("type")
            user = data.get("user")
            pro_user = data.get("pro_user_id")
            pro_order_size = data.get("pro_qty")
            ctc_cost = data.get("ctc_cost")
            leverage = data.get("leverage")
            exchange = data.get("exchange")
            price = data.get("price")
            source_timestamp = data.get("timestamp")
            source_decision = data.get("source_decision")
            dispatcher_reduce_only = bool(data.get("reduceOnly", False))
            dry_run = bool(data.get("dry_run", False))

            timestamp = datetime.now(timezone.utc)

            print({"event": "order_request", "type": self.name, "data": data})

            # dry_run: fire notifications only, skip all order execution.
            # Use this for testing notifications without placing real trades.
            if dry_run and self.name == "breakoutbot":
                print(f"[{self.name} {timestamp}]: DRY RUN — notifications only, skipping order execution for user={user} name={name} symbol={symbol}")
                if database.postgres is None:
                    raise ValueError("Database not available")
                conn = database.postgres.getconn()
                if conn is None:
                    raise ValueError("Connection not available")
                _model_name = "BreakoutBot"
                if isinstance(source_decision, dict):
                    _model_name = source_decision.get("model_name", "BreakoutBot")
                elif isinstance(source_decision, str) and source_decision:
                    _model_name = source_decision
                self._notify_breakout(conn, int(user), name, symbol, side, str(price), _model_name)
                return

            if database.postgres is None:
                raise ValueError("Database not available")

            conn = database.postgres.getconn()
            if conn is None:
                raise ValueError("Connection not available")

            r = database.redis
            if r is None:
                raise ValueError("Redis not available")

            client = self.trades.authenticate(conn, user)
            if client is None:
                raise PermanentError(f"Failed to authenticate user with id {user}")

            # SL-CANCEL / TP-CANCEL: no size/price needed, just cancel orders
            if name in ("SL-CANCEL", "TP-CANCEL"):
                cancel_type = "STOP_MARKET" if name == "SL-CANCEL" else "TAKE_PROFIT_MARKET"
                print(
                    f"[{self.name} {timestamp}]: {name} for {user} on {symbol}"
                )
                self._cancel_existing_orders(
                    conn, r, client, user, symbol, cancel_type, timestamp
                )
                return  # skip all size/price/leverage logic

            res = requests.get("https://omni.apex.exchange/api/v3/symbols")
            symbols: ISymbols = res.json()

            perpetualContract = (
                symbols.get("data", {})
                .get("contractConfig", {})
                .get("perpetualContract", {})
            )

            symbolData: IPerpetual | None = None

            for p in perpetualContract:
                if p.get("symbol") == symbol:
                    symbolData = p
                    break

            if symbolData is None:
                raise ValueError(f"Symbol {symbol} data not found")

            size = round_size(size, symbolData.get("stepSize"))

            # For MARKET orders (entries & closes), always fetch the
            # current worst price from the order book.  Apex requires
            # MARKET order prices to be *worse* than the index price;
            # using the Pro's original price can be stale and rejected.
            if type == "MARKET" or name == "Entry":
                worst = self.trades.get_worst_price(symbol=symbol, side=side)
                if worst is not None:
                    price = round_size(worst, symbolData.get("tickSize"))
                else:
                    # Fallback: use the Pro's price (better than nothing)
                    price = round_size(price, symbolData.get("tickSize"))
            else:
                price = round_size(price, symbolData.get("tickSize"))

            if float(size) > float(maximum := symbolData.get("maxOrderSize")):
                raise ValueError(
                    f"Order size {size} is bigger than supported. Max is {maximum}"
                )

            if float(size) < float(minimum := symbolData.get("minOrderSize")):
                raise ValueError(
                    f"Order size {size} is smaller than supported. Min is {minimum}"
                )

            # ------------------------------------------------------------ #
            # LEVERAGE: Only set if no open position on this symbol.
            # Apex rejects leverage changes when a position is open.
            # ------------------------------------------------------------ #
            if leverage is not None and leverage != 0:
                # Check if follower has ANY open position on this symbol first
                try:
                    account_for_lev = self._get_account_snapshot(r, user, client)
                    has_open_position = False
                    for pos in account_for_lev.get("positions", []) or []:
                        if (
                            pos.get("symbol") == symbol
                            and float(pos.get("size", 0)) != 0
                        ):
                            has_open_position = True
                            break

                    if has_open_position:
                        print(
                            f"[{self.name} {timestamp}]: Skipping leverage change for {user} on {symbol} — open position exists"
                        )
                    else:
                        imrSteps = symbolData.get("riskLimitConfig", {}).get("imrSteps", [])
                        if len(imrSteps) == 0:
                            raise ValueError(f"imrSteps for {symbol} returned an empty array")

                        rate = min(
                            imrSteps,
                            key=lambda x: abs(float(x) - (1 / float(leverage))),
                        )
                        response = self.trades.set_leverage(
                            client=client, symbol=symbol, rate=rate
                        )

                        if response is not True:
                            print(
                                f"[{self.name} {timestamp}]: Leverage set failed for {user} on {symbol}, continuing with existing leverage. Error: {response}"
                            )
                        else:
                            print(
                                f"[{self.name} {timestamp}]: Successfully set leverage {1 / float(rate):.1f}x for {user} on {symbol}"
                            )
                except ValueError:
                    # If we can't get account snapshot for leverage check,
                    # skip leverage change but continue with the order
                    print(
                        f"[{self.name} {timestamp}]: Could not check positions for leverage, skipping leverage change for {user}"
                    )

            size, price = str(size), str(price)

            # Initialise so the final trade_api_response check at the bottom
            # of the callback never hits an UnboundLocalError. Paths that
            # reach place_trade() will overwrite this with the real result.
            trade_api_response = None

            # Resolve model name from source_decision for notification labelling
            _model_name = "BreakoutBot"
            if isinstance(source_decision, dict):
                _model_name = source_decision.get("model_name", "BreakoutBot")
            elif isinstance(source_decision, str) and source_decision:
                _model_name = source_decision
            
            # Idempotency & duplicate check for copytrade execution
            # 1️. Redis is used for a fast, in-memory guard to prevent concurrent duplicate processing.
            # 2️. Database is used as the source of truth to ensure the trade hasn't been permanently recorded.

            if self.name == "copytrade":
                # Redis idempotency check: atomic set if not exists
                # Prevents multiple workers or retries from processing the same execution_id concurrently
                redis_result = r.set(f"copytrade:{execution_id}", "true", nx=True, ex=60)
                if redis_result is None:
                    raise PermanentError(
                        f"Duplicate copy trade execution blocked by Redis idempotency check. "
                        f"execution_id={execution_id} already exists in Redis."
                    )

                # Database check: ensures that even if Redis fails or expires, duplicates are not persisted
                if db.copytrade_execution_exists(conn, execution_id):
                    raise PermanentError(
                        f"Copy trade already executed in database. execution_id={execution_id}"
                    )

            match name:
                case "Entry":
                    # ---------------------------------------------------- #
                    # COPYTRADE ENTRY HANDLER
                    # ---------------------------------------------------- #
                    account = self._get_account_snapshot(r, user, client)

                    if self.name == "breakoutbot":
                        # Fire notification for this user's trade execution
                        self._notify_breakout(conn, int(user), name, symbol, side, str(price), _model_name)
                        # Broadcast signal alert to all opted-in watchers (non-blocking)
                        # order_logic field requires breakout-executor to include it in the Pub/Sub payload
                        _order_logic = data.get("order_logic", "")
                        self._broadcast_signal_alert(symbol, side, str(price), _model_name, _order_logic)
                        # Breakout bot: skip if already has position
                        for position in account.get("positions", []) or []:
                            if (
                                position.get("symbol") == symbol
                                and float(position.get("size", 0)) != 0
                            ):
                                raise PermanentError(
                                    f"User {user} has an active {position.get('size')} {position.get('side')} for {position.get('symbol')}. skipping order request"
                                )

                        trade_api_response = self.trades.place_trade(
                            conn=conn,
                            exchange=exchange,
                            user=user,
                            client=client,
                            symbol=symbol,
                            side=side,
                            type=type,
                            size=size,
                            tpPrice=None,
                            slPrice=None,
                            price=price,
                            source=self.name,
                            reduceOnly=False,
                        )
                    else:
                        trade_api_response = False
                        # ------------------------------------------------ #
                        # COPYTRADE: Detect open/close/reduce
                        # ------------------------------------------------ #
                        print(
                            f"[{self.name} {timestamp}]: Copytrade Entry {execution_id} for {user}: {side} {size} {symbol}"
                        )

                        # Determine what side the follower's existing position
                        # would be on. A BUY order opens/adds to LONG; a SELL
                        # order opens/adds to SHORT.  But if the follower
                        # already has the OPPOSITE position, this order is
                        # closing/reducing it.
                        order_opens_side = "LONG" if side == "BUY" else "SHORT"
                        order_closes_side = "SHORT" if side == "BUY" else "LONG"

                        # Check follower's current position on the side this
                        # order would CLOSE (opposite side).
                        _, follower_close_size = self._get_follower_position(
                            account, symbol, order_closes_side
                        )

                        # Also check if follower already has a position on the
                        # side this order would OPEN (same side) — to prevent
                        # doubling up.
                        _, follower_open_size = self._get_follower_position(
                            account, symbol, order_opens_side
                        )

                        if follower_close_size > 0:
                            # -------------------------------------------- #
                            # CLOSE / REDUCE: Follower has an opposite
                            # position.  Compute the proportional close
                            # amount by looking up the Pro's position from
                            # their Redis account snapshot.
                            #
                            # Race-condition handling:
                            # The snapshot may be STALE (pre-close) or
                            # UPDATED (post-close) depending on WebSocket
                            # sync timing.
                            #
                            # Stale:   pro_remaining = full pos before close
                            #          ratio = pro_close / pro_remaining
                            # Updated: pro_remaining = pos AFTER close
                            #          ratio = pro_close / (remaining + close)
                            #
                            # Heuristic: if remaining >= close_qty, the
                            # snapshot hasn't reflected the close yet (stale).
                            # If remaining < close_qty, it has (updated).
                            # -------------------------------------------- #

                            step = float(symbolData.get("stepSize", "0.001"))

                            copytrade_size = 0.0
                            close_base = follower_close_size
                            dispatcher_qty = 0.0

                            if dispatcher_reduce_only:
                                # -------------------------------------------- #
                                # TRUSTED PATH: dispatcher (CopyTrade PR #17)
                                # already computed the proportional close qty
                                # using the DB positions table (copytrade-only
                                # size). Use it directly rather than
                                # recalculating, which risks the stale/updated
                                # heuristic getting it wrong.
                                #
                                # Cap at follower's actual position size to
                                # prevent overshoot (reduceOnly on Apex also
                                # caps, but be explicit).
                                # -------------------------------------------- #
                                dispatcher_qty = float(size)
                                effective_size = min(dispatcher_qty, follower_close_size)
                                # Round up to a clean step boundary. Use dispatcher_qty
                                # as the ceiling, NOT follower_close_size — the latter
                                # includes any manual positions the follower opened, and
                                # rounding up to the total would accidentally close them.
                                if effective_size >= dispatcher_qty * 0.99:
                                    effective_size = math.ceil(dispatcher_qty / step) * step
                                else:
                                    # Round to nearest step (not floor) for close orders.
                                    # round_size() floors — e.g. 0.001818 → 0.001 (25% instead of 50%).
                                    # reduceOnly=True on Apex caps execution at the open position
                                    # size, so rounding up slightly is safe and avoids undershoot.
                                    effective_size = math.floor(effective_size / step + 0.5) * step
                                close_ratio = effective_size / follower_close_size if follower_close_size > 0 else 1.0
                                snapshot_state = "dispatcher"
                                pro_remaining = 0.0
                                pro_close_f = float(pro_order_size) if pro_order_size else 0.0
                                pro_full_before = 0.0
                            else:
                                # -------------------------------------------- #
                                # CALCULATED PATH: dispatcher sent reduceOnly=False
                                # (pro closed without the flag, or this is a
                                # reversal — e.g. SHORT→LONG in one order).
                                # Recalculate the proportional close from the
                                # pro's DB position.
                                #
                                # Always treat DB as POST-close (updated path):
                                # by the time the executor runs, the Stream service
                                # has already processed the WebSocket fill event
                                # and updated the positions table.
                                #
                                # pro_full_before = remaining + close_qty handles
                                # both 50% and 100% closes correctly:
                                #   50% close: remaining=0.006, close=0.006 → full=0.012, ratio=0.5 ✓
                                #   100% close: remaining=0, close=0.012 → full=0.012, ratio=1.0 ✓
                                #
                                # close_base = follower's full position (not
                                # copytrade-only). We cannot use copy_trade_orders
                                # here because the dispatcher commits that row before
                                # publishing, so by the time the executor runs, the
                                # net is already post-close. Copytrade-only protection
                                # is handled upstream in the TRUSTED PATH (dispatcher
                                # pre-computes the qty from a fresh DB read).
                                # -------------------------------------------- #
                                pro_close_f = float(pro_order_size)

                                pro_remaining = self._get_pro_position_from_db(
                                    pro_user, symbol, order_closes_side
                                )

                                if pro_remaining == 0.0:
                                    try:
                                        pro_cached = r.get(f"{pro_user}@account.apex")
                                        if pro_cached:
                                            pro_account_data = json.loads(str(pro_cached))
                                            pro_positions = pro_account_data.get("data", {}).get("positions", [])
                                            for pos in pro_positions:
                                                if (
                                                    pos.get("symbol") == symbol
                                                    and pos.get("side") == order_closes_side
                                                    and float(pos.get("size", 0)) != 0
                                                ):
                                                    pro_remaining = abs(float(pos.get("size", 0)))
                                                    break
                                    except Exception as e:
                                        print(f"[{self.name} {timestamp}]: Could not read Pro {pro_user} position from Redis: {e}")
                                        pro_remaining = 0.0

                                # Use the follower's total position as the close base.
                                # We intentionally don't query copy_trade_orders here
                                # because of a timing issue: the dispatcher commits the
                                # close order row BEFORE publishing the Pub/Sub message,
                                # so by the time the executor processes it, the net would
                                # already reflect the close (under-reporting for partial
                                # closes, returning 0 for full closes). The TRUSTED PATH
                                # above (dispatcher_reduce_only=True) is where copytrade-
                                # only protection is enforced — it pre-computes the exact
                                # qty using a fresh DB read before committing.
                                copytrade_size = 0.0
                                close_base = follower_close_size

                                # Always use updated path: remaining is post-close.
                                pro_full_before = pro_remaining + pro_close_f
                                snapshot_state = "updated_db"

                                if pro_full_before > 0 and pro_close_f > 0:
                                    close_ratio = min(pro_close_f / pro_full_before, 1.0)
                                else:
                                    close_ratio = 1.0

                                if close_ratio >= 0.99:
                                    effective_size = math.ceil(close_base / step) * step
                                else:
                                    # Round to nearest step (not floor) for close orders.
                                    # round_size() floors — e.g. 0.001818 → 0.001 (25% instead of 50%).
                                    # reduceOnly=True on Apex caps execution at the open position
                                    # size, so rounding up slightly is safe and avoids undershoot.
                                    raw = close_base * close_ratio
                                    effective_size = math.floor(raw / step + 0.5) * step

                            effective_size = str(round(effective_size, 10))

                            if float(effective_size) < float(symbolData.get("minOrderSize", 0)):
                                raise ValueError(
                                    f"Reduce size {effective_size} below min order size for {user} on {symbol}. Skipping."
                                )

                            print(
                                f"[{self.name} {timestamp}]: CLOSE/REDUCE for {user}: "
                                f"follower_total={follower_close_size} copytrade_only={copytrade_size} "
                                f"close_base={close_base} dispatcher_qty={dispatcher_qty} {order_closes_side}, "
                                f"pro_close={pro_order_size} pro_remaining={pro_remaining} "
                                f"snapshot={snapshot_state} pro_full={pro_full_before} "
                                f"ratio={close_ratio} "
                                f"placing reduceOnly {side} {effective_size}"
                            )

                            trade_api_response = self.trades.place_trade(
                                conn=conn,
                                exchange=exchange,
                                user=user,
                                client=client,
                                symbol=symbol,
                                side=side,
                                type="MARKET",
                                size=effective_size,
                                tpPrice=None,
                                slPrice=None,
                                price=price,
                                source=self.name,
                                reduceOnly=True,
                            )

                        elif follower_open_size > 0:
                            # Follower already has a position on the SAME
                            # side — this could be an add-on or duplicate.
                            # Allow it but log clearly.
                            print(
                                f"[{self.name} {timestamp}]: ADD-ON for {user}: "
                                f"already has {follower_open_size} {order_opens_side}, "
                                f"adding {size} {side}"
                            )

                            trade_api_response = self.trades.place_trade(
                                conn=conn,
                                exchange=exchange,
                                user=user,
                                client=client,
                                symbol=symbol,
                                side=side,
                                type="MARKET",
                                size=size,
                                tpPrice=None,
                                slPrice=None,
                                price=price,
                                source=self.name,
                                reduceOnly=False,
                            )
                        else:
                            # No existing position on either side.
                            # Before opening a fresh position, check whether
                            # the Pro is actually CLOSING their position.  If
                            # so, the follower has nothing to close → skip.
                            #
                            # Detection: look up the Pro's remaining position
                            # on the side this order would CLOSE.  If the Pro
                            # had a position there (pro_remaining + pro_order_size > 0)
                            # but is now reducing/closing it, this is a close
                            # signal, not a new open.
                            is_pro_close = False
                            try:
                                pro_cached = r.get(f"{pro_user}@account.apex")
                                if pro_cached:
                                    pro_account_data = json.loads(str(pro_cached))
                                    pro_positions = pro_account_data.get("data", {}).get("positions", [])
                                    # Check if the Pro has (or just had) a position
                                    # on the side this order would close.
                                    pro_has_open_side = False
                                    for pos in pro_positions:
                                        if (
                                            pos.get("symbol") == symbol
                                            and pos.get("side") == order_opens_side
                                            and float(pos.get("size", 0)) != 0
                                        ):
                                            pro_has_open_side = True
                                            break

                                    # If the Pro does NOT have an open position on
                                    # the same side as this order would open, then
                                    # this order is a close/reduce of the Pro's
                                    # opposite position — not a new open.
                                    if not pro_has_open_side:
                                        is_pro_close = True
                            except Exception as e:
                                print(f"[{self.name} {timestamp}]: Could not check Pro {pro_user} position for close detection: {e}")

                            if is_pro_close:
                                print(
                                    f"[{self.name} {timestamp}]: SKIP for {user}: Pro {pro_user} is closing {symbol} "
                                    f"but follower has no position to close. Skipping to avoid opening unwanted position."
                                )
                            else:
                                # Genuine new open
                                print(
                                    f"[{self.name} {timestamp}]: NEW OPEN for {user}: {side} {size} {symbol}"
                                )

                                trade_api_response = self.trades.place_trade(
                                    conn=conn,
                                    exchange=exchange,
                                    user=user,
                                    client=client,
                                    symbol=symbol,
                                    side=side,
                                    type="MARKET",
                                    size=size,
                                    tpPrice=None,
                                    slPrice=None,
                                    price=price,
                                    source=self.name,
                                    reduceOnly=False,
                                )

                case "TP1" | "TP2" | "TP3":
                    if self.name == "breakoutbot":
                        self._notify_breakout(conn, int(user), name, symbol, side, str(price), _model_name)
                    # price = the TP trigger level from the dispatcher.
                    # Apex needs a valid execution price for the ZK sig
                    # (worst price from order book) and the trigger price
                    # separately.
                    trigger_price = price
                    if float(trigger_price) <= 0:
                        print(
                            f"[{self.name} {timestamp}]: Skipping {name} for {user} on {symbol} — trigger price is {trigger_price}"
                        )
                    else:
                        exec_price = self.trades.get_worst_price(symbol=symbol, side=side)
                        if exec_price is not None:
                            exec_price = str(round_size(exec_price, symbolData.get("tickSize")))
                        else:
                            exec_price = trigger_price

                        trade_api_response = self.trades.place_trade(
                            conn=conn,
                            exchange=exchange,
                            user=user,
                            client=client,
                            symbol=symbol,
                            side=side,
                            type="TAKE_PROFIT_MARKET",
                            size=size,
                            tpPrice=None,
                            slPrice=None,
                            price=exec_price,
                            triggerPrice=trigger_price,
                            triggerPriceType="INDEX",
                            isPositionTpsl=True,
                            source=self.name,
                        )

                case "SL":
                    if self.name == "breakoutbot":
                        self._notify_breakout(conn, int(user), name, symbol, side, str(price), _model_name)
                    # Cancel any existing SL orders first, then place new one
                    self._cancel_existing_orders(
                        conn, r, client, user, symbol, "STOP_MARKET", timestamp
                    )

                    trigger_price = price
                    if float(trigger_price) <= 0:
                        print(
                            f"[{self.name} {timestamp}]: Skipping SL for {user} on {symbol} — trigger price is {trigger_price}"
                        )
                    else:
                        exec_price = self.trades.get_worst_price(symbol=symbol, side=side)
                        if exec_price is not None:
                            exec_price = str(round_size(exec_price, symbolData.get("tickSize")))
                        else:
                            exec_price = trigger_price

                        trade_api_response = self.trades.place_trade(
                            conn=conn,
                            exchange=exchange,
                            user=user,
                            client=client,
                            symbol=symbol,
                            side=side,
                            type="STOP_MARKET",
                            size=size,
                            tpPrice=None,
                            slPrice=None,
                            price=exec_price,
                            triggerPrice=trigger_price,
                            triggerPriceType="INDEX",
                            isPositionTpsl=True,
                            source=self.name,
                        )

                case "SL-UPDATE":
                    # Cancel existing SL orders first, then place updated SL
                    self._cancel_existing_orders(
                        conn, r, client, user, symbol, "STOP_MARKET", timestamp
                    )

                    trigger_price = price
                    if float(trigger_price) <= 0:
                        print(
                            f"[{self.name} {timestamp}]: Skipping SL-UPDATE for {user} on {symbol} — trigger price is {trigger_price}"
                        )
                    else:
                        exec_price = self.trades.get_worst_price(symbol=symbol, side=side)
                        if exec_price is not None:
                            exec_price = str(round_size(exec_price, symbolData.get("tickSize")))
                        else:
                            exec_price = trigger_price

                        trade_api_response = self.trades.place_trade(
                            conn=conn,
                            exchange=exchange,
                            user=user,
                            client=client,
                            symbol=symbol,
                            side=side,
                            type="STOP_MARKET",
                            size=size,
                            tpPrice=None,
                            slPrice=None,
                            price=exec_price,
                            triggerPrice=trigger_price,
                            triggerPriceType="INDEX",
                            isPositionTpsl=True,
                            source=self.name,
                        )

                case "TP-UPDATE":
                    # Cancel existing TP orders first, then place updated TP
                    self._cancel_existing_orders(
                        conn, r, client, user, symbol, "TAKE_PROFIT_MARKET", timestamp
                    )

                    trigger_price = price
                    if float(trigger_price) <= 0:
                        print(
                            f"[{self.name} {timestamp}]: Skipping TP-UPDATE for {user} on {symbol} — trigger price is {trigger_price}"
                        )
                    else:
                        exec_price = self.trades.get_worst_price(symbol=symbol, side=side)
                        if exec_price is not None:
                            exec_price = str(round_size(exec_price, symbolData.get("tickSize")))
                        else:
                            exec_price = trigger_price

                        trade_api_response = self.trades.place_trade(
                            conn=conn,
                            exchange=exchange,
                            user=user,
                            client=client,
                            symbol=symbol,
                            side=side,
                            type="TAKE_PROFIT_MARKET",
                            size=size,
                            tpPrice=None,
                            slPrice=None,
                            price=exec_price,
                            triggerPrice=trigger_price,
                            triggerPriceType="INDEX",
                            isPositionTpsl=True,
                            source=self.name,
                        )

                case _:
                    raise ValueError(f"{name} does not match one of Entry, TP1-3, SL, SL-UPDATE, TP-UPDATE")

            if not isinstance(trade_api_response, Exception) and trade_api_response != False:
                self.trades.deduct_ctc(conn=conn, user_id=user, ctc_cost=ctc_cost)
                db.insert_copytrade_execution(
                    conn,
                    pro_trader_id=pro_user,
                    follower_id=user,
                    order_id=trade_api_response,
                    exchange="apex",
                    id=execution_id
                )

            # For safety-critical SL/TP legs: if Apex rejected the order,
            # raise so the message is NACKed and Pub/Sub retries delivery.
            if name in ("SL", "SL-UPDATE", "TP1", "TP2", "TP3", "TP-UPDATE"):
                if isinstance(trade_api_response, Exception):
                    raise ValueError(
                        f"[{self.name}]: {name} placement failed for user={user} symbol={symbol} — "
                        f"will NACK for retry. Apex error: {trade_api_response}"
                    )

        except json.JSONDecodeError as e:
            # Malformed message — ACK it; retrying won't help.
            timestamp = datetime.now(timezone.utc)
            print(
                f"[{self.name} {timestamp}]: JSON decode error for {user} at {e.pos}: {e.msg}"
            )
        except PermanentError as e:
            # Non-retryable failure (auth broken, duplicate position, etc.).
            # ACK so Pub/Sub does not redeliver — retrying cannot fix these.
            _ack = True
            timestamp = datetime.now(timezone.utc)
            print(f"[{self.name} {timestamp}]: ERROR (will ACK, not retrying) for {user} execution_id={data.get('execution_id', 'unknown') if 'data' in dir() else 'unknown'}: {e}")
        except Exception as e:
            # Retryable failure (Apex rejection, DB/Redis outage, etc.).
            # NACK so Pub/Sub redelivers — critical for SL/TP safety.
            _ack = False
            timestamp = datetime.now(timezone.utc)
            print(f"[{self.name} {timestamp}]: ERROR (will NACK) for {user} execution_id={data.get('execution_id', 'unknown') if 'data' in dir() else 'unknown'}: {e}")
        finally:
            if _ack:
                message.ack()
            else:
                message.nack()
            if conn and database.postgres:
                database.postgres.putconn(conn)

    def start(self, shutdown_event):
        print(f"Starting AutoTrade - {self.name}\n")

        subscriber = pubsub_v1.SubscriberClient()
        future = subscriber.subscribe(self.subscription, self.callback)

        try:
            while not shutdown_event.is_set():
                time.sleep(0.5)
        finally:
            future.cancel()
            try:
                future.result(timeout=5)
            except Exception:
                pass

            future.cancel()
            future.result()


breakoutbot = Autotrade(
    "breakoutbot",
    "projects/eagleailabs-analytics/topics/breakout.executions.v1",
    "projects/eagleailabs-analytics/subscriptions/breakout-executor-out",
)

copytrade = Autotrade(
    "copytrade",
    "projects/eagleailabs-analytics/topics/copytrade.executions.v1",
    "projects/eagleailabs-analytics/subscriptions/copytrade-executions-out",
)


class SignalBroadcaster:
    """Dedicated subscriber for the breakout.signals Pub/Sub topic.

    Alan's breakout-decider publishes a lightweight signal event the moment
    a signal fires — completely independent of trade execution or followers.
    This subscriber receives it, extracts symbol/side/price/order_logic, and
    calls _broadcast_signal_alert to notify all opted-in watchers.

    Always ACKs — old signals must never be replayed.
    """

    def __init__(self, subscription: str):
        self.subscription = subscription

    def callback(self, message):
        try:
            data = json.loads(message.data.decode("utf-8"))

            # Builder payload fields (breakout.orders.v1 topic):
            #   symbol, side, entry, stop, tps (array), decider_logic, source, version
            symbol       = data.get("symbol", "")
            side         = data.get("side", "")
            price        = str(data.get("entry", data.get("price", "")))
            sl           = str(data.get("stop", data.get("sl", "")))

            # tps is an array [tp1, tp2, tp3] — fall back to single tp field
            tps = data.get("tps") or data.get("meta", {}).get("all_tps") or []
            if not tps and data.get("tp"):
                tps = [data.get("tp")]
            tp1 = str(tps[0]) if len(tps) > 0 else ""
            tp2 = str(tps[1]) if len(tps) > 1 else ""
            tp3 = str(tps[2]) if len(tps) > 2 else ""

            # decider_logic: "v1" / "v2" / "v3" / "v4c" / "v4r"
            # version may be "v3_10s" — strip suffix for clean label
            order_logic = data.get("decider_logic", data.get("order_logic", ""))
            version_label = order_logic.upper() if order_logic else \
                data.get("version", "").split("_")[0].upper() or "V1"

            # Derive friendly model name from source ("builder.breakout_v3" → "BreakoutBot V3")
            source = data.get("source", "")
            if source and "breakout_" in source:
                ver = source.split("breakout_")[-1].upper()
                model_name = f"BreakoutBot {ver}"
            elif order_logic:
                model_name = f"BreakoutBot {order_logic.upper()}"
            else:
                model_name = data.get("model_name", "BreakoutBot")

            if symbol and side and price:
                breakoutbot._broadcast_signal_alert(
                    symbol, side, price, model_name, order_logic,
                    tp1=tp1, tp2=tp2, tp3=tp3, sl=sl,
                )
            else:
                print(f"[SignalBroadcaster]: incomplete payload — {data}")
        except Exception as e:
            print(f"[SignalBroadcaster]: callback error: {e}")
        finally:
            message.ack()  # always ACK — never replay stale signals

    def start(self, shutdown_event):
        print("Starting SignalBroadcaster\n")
        subscriber = pubsub_v1.SubscriberClient()
        future = subscriber.subscribe(self.subscription, self.callback)

        try:
            while not shutdown_event.is_set():
                time.sleep(0.5)
        finally:
            future.cancel()
            try:
                future.result(timeout=5)
            except Exception:
                pass
            future.cancel()
            future.result()


signal_broadcaster = SignalBroadcaster(
    # Alan's confirmed subscription on breakout.orders.v1 topic
    # Receives builder payload for every signal from every model version
    "projects/eagleailabs-analytics/subscriptions/breakout-notification-alerts",
)
