import json
import logging
import random
import time
from datetime import datetime, timezone
from typing import List, cast

import requests
from apexomni.constants import APEX_OMNI_HTTP_MAIN, NETWORKID_MAIN
from apexomni.http_private_sign import HttpPrivateSign
from psycopg2.extensions import connection
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)

from database import database
from trades import decrypt
from utils.types import ICredential, IDepth, IOrderResponseSuccessful


class Trades:
    def __init__(
        self,
    ) -> None:
        pass

    def get_worst_price(self, symbol, side) -> str | None:
        try:
            r = requests.get(
                "https://omni.apex.exchange/api/v3/depth",
                params={"symbol": symbol.replace("-", "")},
            )

            data = r.json()

            price = None

            if "code" in data and data["code"] != 0:
                raise ValueError(data)
            else:
                data = data.get("data", {})
                depth: IDepth = {
                    "a": data.get("a", []),
                    "b": data.get("b", []),
                    "s": data.get("s", ""),
                    "u": data.get("u", 0),
                }
                ask = depth.get("a")[0][0]
                bid = depth.get("b")[0][0]
                if side == "BUY":
                    price = ask
                else:
                    price = bid

            return price
        except Exception as e:
            print(f"Could not get worst price for {symbol} - {side}. Error: {str(e)}")
            return None

    def set_leverage(self, client: HttpPrivateSign, symbol: str, rate: str):
        try:
            response = client.set_initial_margin_rate_v3(
                symbol=symbol, initialMarginRate=rate
            )

            if "code" in response:
                raise ValueError(response)

            return True
        except Exception as e:
            print(f"Failed to set leverage: {str(e)}")
            return None

    def get_leverage(self, user_id: str | int, symbol: str) -> float:
        customImr = 0

        try:
            r = database.redis

            if r is None:
                raise ValueError("Redis not available")

            response = r.get(f"{user_id}@account.apex")
            if response is None:
                raise ValueError(f"{user_id}@account.apex not found")

            parsed: dict = json.loads(str(response))

            data: dict = parsed.get("data", {})
            if data is None:
                raise ValueError(f"{user_id}@account.apex has no data")

            positions: List[dict] = data.get("positions", {})

            for position in positions:
                if position.get("symbol") == symbol:
                    customImr = float(position.get("customImr", 0))
                    break

        except Exception as e:
            logging.error(
                f"Error while fetching leverage for {26}@account.apex. Defaulting to 0. Error details: {e}"
            )
            return 0

        leverage = (1 / customImr) if customImr != 0 else 0
        return leverage

    def deduct_ctc(self, conn: connection, user_id: int, ctc_cost: str | None):
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            if ctc_cost is None:
                return

            cur.execute(
                "update users set ctc_balance = ctc_balance - coalesce(%s, 0) where id = %s returning ctc_balance",
                (
                    ctc_cost,
                    user_id,
                ),
            )

            row = cur.fetchone()
            new_balance = float(row["ctc_balance"]) if row else None
            print(f"Deducted {ctc_cost} CTC for {user_id} — new balance: {new_balance}")

            if new_balance is not None:
                self._maybe_notify_ctc_balance(conn, user_id, new_balance)

        except Exception as e:
            print(f"Could not deduct CTC for {user_id}: {str(e)}")
            return None
        finally:
            conn.commit()
            cur.close()

    def _maybe_notify_ctc_balance(self, conn: connection, user_id: int, balance: float):
        """Insert a CTC balance warning notification if balance crosses a threshold.
        Deduplicates — only fires once per threshold per 24-hour window.
        Never raises — must not block order execution.
        """
        try:
            if balance <= 0:
                notification_type = "balance_depleted"
                title = "CTC Balance Depleted"
                message = f"Your CTC balance has run out. Top up to continue using CLAW features."
                icon = "mdi:close-octagon"
                priority = "critical"
            elif balance < 5:
                notification_type = "balance_critical"
                title = f"CTC Balance Critical — {balance:.1f} credits left"
                message = f"Only {balance:.1f} CTC credits remaining. Top up soon or your bot will stop executing."
                icon = "mdi:alert-octagon"
                priority = "critical"
            elif balance < 20:
                notification_type = "balance_low"
                title = f"CTC Balance Low — {balance:.1f} credits"
                message = f"Your CTC balance is running low ({balance:.1f} credits). Consider topping up."
                icon = "mdi:alert"
                priority = "medium"
            else:
                return  # Balance is fine, no notification needed

            cur = conn.cursor(cursor_factory=RealDictCursor)
            # Dedup: skip if same notification_type sent in last 24h
            cur.execute(
                """
                SELECT id FROM notifications
                WHERE user_id = %s
                  AND feature = 'ctc'
                  AND notification_type = %s
                  AND created_at > NOW() - INTERVAL '24 hours'
                LIMIT 1
                """,
                (user_id, notification_type),
            )
            if cur.fetchone():
                cur.close()
                return  # Already notified recently

            cur.execute(
                """
                INSERT INTO notifications
                    (user_id, feature, notification_type, title, message, icon, priority)
                VALUES (%s, 'ctc', %s, %s, %s, %s, %s)
                RETURNING id, user_id, feature, notification_type, title, message, icon, priority, read, created_at
                """,
                (user_id, notification_type, title, message, icon, priority),
            )
            row = cur.fetchone()
            conn.commit()
            cur.close()

            if row:
                print(f"[CTC] Notification inserted for user={user_id} type={notification_type} balance={balance:.1f}")
                self._push_notification_ws(user_id, dict(row))

        except Exception as e:
            print(f"[CTC] Failed to insert balance notification for user={user_id}: {e}")

    def _push_notification_ws(self, user_id: int, notification: dict):
        """Fire-and-forget HTTP push to Stream so the notification appears live in the browser."""
        import os, requests as req
        secret = os.getenv("INTERNAL_NOTIFICATION_SECRET", "")
        if not secret:
            return
        stream_url = os.getenv("STREAM_INTERNAL_URL", "https://stream.eagleailabs.com")
        try:
            # Convert datetime to ISO string for JSON serialisation
            if hasattr(notification.get("created_at"), "isoformat"):
                notification["created_at"] = notification["created_at"].isoformat()
            req.post(
                f"{stream_url}/internal/notifications/push",
                json={"user_id": user_id, "notification": notification},
                headers={"X-Internal-Token": secret},
                timeout=3,
            )
        except Exception as e:
            print(f"[CTC] WebSocket push failed (non-critical) for user={user_id}: {e}")

    def authenticate(self, conn: connection, user_id: int) -> HttpPrivateSign | None:
        try:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
                (user_id,),
            )
            row = cur.fetchone()
            if row is None:
                raise ValueError(f"Row is None for {user_id}")
            data: ICredential = cast(ICredential, dict(row))

            key = data.get("key")
            secret = data.get("secret")
            passphrase = data.get("passphrase")
            seeds = data.get("seed")

            key = decrypt(key)
            secret = decrypt(secret)
            passphrase = decrypt(passphrase)
            seeds = decrypt(seeds)

            client = HttpPrivateSign(
                APEX_OMNI_HTTP_MAIN,
                network_id=NETWORKID_MAIN,
                api_key_credentials={
                    "key": key,
                    "secret": secret,
                    "passphrase": passphrase,
                },
                zk_seeds=seeds,
            )

            client.configs_v3()
            client.get_user_v3()
            client.get_account_v3()

            return client
        except Exception:
            return None

    def cancel_order(
        self, conn: connection, client: HttpPrivateSign, user_id: int, id: str
    ) -> str:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        try:
            order = client.delete_order_v3(id=id)

            if "code" in order:
                raise ValueError(order)

            return f"Successfully canceled order {id} for {user_id}"
        except Exception as e:
            return f"Error canceling order {id} for {user_id}. Error: {str(e)}"
        finally:
            conn.commit()
            cur.close()

    def place_trade(
        self,
        conn: connection,
        exchange: str,
        user: int,
        client: HttpPrivateSign,
        symbol: str,
        side: str,
        type: str,
        size: str,
        price: str,
        tpPrice: str | None = None,
        slPrice: str | None = None,
        reduceOnly: bool = True,
        triggerPrice: str | None = None,
        triggerPriceType: str | None = None,
        isPositionTpsl: bool = False,
        source: str = "manual",
    ) -> int | Exception:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        timestamp = datetime.now(timezone.utc)

        try:
            order: IOrderResponseSuccessful = client.create_order_v3(
                symbol=symbol,
                side=side,
                type=type,
                size=size,
                price=price,
                tpPrice=tpPrice,
                slPrice=slPrice,
                reduceOnly=reduceOnly,
                triggerPrice=triggerPrice,
                triggerPriceType=triggerPriceType,
                isPositionTpsl=isPositionTpsl,
            )
            if "code" in order:
                raise ValueError(order)

            id = order.get("data", {}).get("id")
            if id is None:
                raise ValueError("Order id is None")

            # Tag the order with its source. The ApeX execution is already complete
            # at this point — this is purely a DB label. Sleep is kept tight
            # (0.3s per retry) to minimise delay before returning, reducing
            # slippage during volatile moves where price can move $500+ per second.
            attempts = 1
            while attempts <= 5:
                cur.execute(
                    "UPDATE orders SET source = %s WHERE id = %s",
                    (source, id),
                )
                if cur.rowcount > 0:
                    timestamp = datetime.now(timezone.utc)
                    print(
                        f"[{source} {timestamp}]: Successfully updated source {source} for order {id}, user {user}"
                    )
                    break
                timestamp = datetime.now(timezone.utc)
                print(
                    f"[{source} {timestamp}]: No record found for order {id} on attempt {attempts}, user {user}"
                )
                attempts += 1
                time.sleep(0.3 + random.uniform(0, 0.1))

            timestamp = datetime.now(timezone.utc)
            print(
                f"[{source} {timestamp}]: Successfully placed trade for user {user}, {size} {side} for {symbol} at {price} on {exchange} {type}"
            )
            return id
        except Exception as error:
            print(
                f"[{source} {timestamp}]: Error placing trade for user {user}, {size} {side} for {symbol} at {price} on {exchange} {type}. Error: {error}"
            )
            return error

        finally:
            conn.commit()
            cur.close()
