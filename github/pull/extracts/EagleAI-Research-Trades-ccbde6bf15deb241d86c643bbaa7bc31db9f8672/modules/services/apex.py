import logging
import uuid
from typing import List

import requests
from apexomni.constants import APEX_OMNI_HTTP_MAIN, NETWORKID_MAIN
from apexomni.helpers.util import round_size
from apexomni.http_private_sign import HttpPrivate_v3, HttpPrivateSign
from flask import Blueprint, jsonify, request
from flask_cors import CORS
from psycopg2.extras import RealDictCursor

from database import database
from trades import decrypt
from utils.authentication import authentication
from utils.trades import Trades
from utils.types import (
    IAccount,
    IAccountBalance,
    ICredential,
    IDepth,
    IHistoricalPnl,
    IOrderResponseData,
    IOrderResponseFailed,
    IOrderResponseSuccessful,
    IPerpetual,
    ISymbols,
    ServiceResponse
)
from utils.validation import MarginRequest, OrderRequest, TpslRequest

from utils import db

logging.basicConfig(
    filename="trades.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

def place_order_v1_1(order_request: OrderRequest, user_id: int) -> ServiceResponse:

    conn = None
    body = order_request
    trades = Trades()
    (
        symbol,
        side,
        size,
        type,
        price,
        tpPrice,
        slPrice,
        triggerPrice,
        triggerPriceType,
        reduceOnly,
        isPositionTpsl,
    ) = (
        body.symbol,
        body.side,
        body.size,
        body.type,
        body.price,
        body.tpPrice,
        body.slPrice,
        body.triggerPrice,
        body.triggerPriceType,
        body.reduceOnly,
        body.isPositionTpsl,
    )

    try:

        if price is None:
            price = trades.get_worst_price(symbol=symbol, side=side)
            body.price = price
        
        print("INFO HTTP=Placing order", f"details={body}")

        if database.postgres is None:
            raise ValueError(
               "DB connection not available. Please try again later"
            )

        conn = database.postgres.getconn()

        client = trades.authenticate(conn, user_id)
        if client is None:
            raise ValueError(f"Failed to authenticate user with id {user_id}")
        
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
        price = round_size(price, symbolData.get("tickSize"))

        if float(size) > float(maximum := symbolData.get("maxOrderSize")):
            raise ValueError(
                f"Order size {size} is bigger than supported. Max is {maximum}"
            )

        if float(size) < float(minimum := symbolData.get("minOrderSize")):
            raise ValueError(
                f"Order size {size} is smaller than supported. Min is {minimum}"
            )

        size, price, tpPrice, slPrice, triggerPrice = (
            str(size),
            str(price),
            str(tpPrice),
            str(slPrice),
            str(triggerPrice),
        )

        response = trades.place_trade(
            conn=conn,
            exchange="apex",
            user=user_id,
            client=client,
            symbol=symbol,
            side=side,
            type=type,
            size=size,
            isPositionTpsl=isPositionTpsl,
            tpPrice=tpPrice,
            slPrice=slPrice,
            triggerPrice=triggerPrice,
            triggerPriceType=triggerPriceType,
            price=price,
            source="manual",
            reduceOnly=reduceOnly,
        )

    
        return {
            "data": {
                "status": True,
                "message": f"Successfully placed trade of {size} {side} for {symbol} at {price} on apex {type}",
            } if not isinstance(response, Exception) else None,
            "error": response if isinstance(response, Exception) else None
        }
    except Exception as e:
        print("ERROR HTTP error=Failed to place order", f"details={e}")
        return {
            "error": e,
            "data": None
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)
        
def place_order(order_request: OrderRequest, user_id: int) -> ServiceResponse:
    conn = None
    trades = Trades()
    body = order_request

    symbol = body.symbol
    side = body.side
    size = body.size
    type = body.type
    tpPrice = body.tpPrice
    slPrice = body.slPrice
    triggerPrice = body.triggerPrice
    triggerPriceType = body.triggerPriceType
    orderPrice = body.orderPrice
    reduceOnly = body.reduceOnly
    # For test cases only will this be true
    retry = body.retry

    try:

        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (user_id,),
        )
        data: ICredential = cur.fetchone()

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

        if price is None:
            raise ValueError("Price is empty")
        else:
            order: IOrderResponseFailed
            match type:
                case "LIMIT":
                    order = client.create_order_v3(
                        symbol=symbol,
                        side=side,
                        price=orderPrice,
                        type=type,
                        size=size,
                        reduceOnly=reduceOnly,
                    )
                case "STOP_LIMIT":
                    order = client.create_order_v3(
                        symbol=symbol,
                        side=side,
                        price=price,
                        type=type,
                        size=size,
                        triggerPrice=triggerPrice,
                        triggerPriceType=triggerPriceType,
                        reduceOnly=reduceOnly,
                    )
                case "TAKE_PROFIT_MARKET":
                    print(f"{side} {size}x {symbol}")

                    order = client.create_order_v3(
                        symbol=symbol,
                        side=side,
                        type="LIMIT",
                        size=size,
                        price=price,
                        isOpenTpslOrder=True,
                        isSetOpenSl=True,
                        slPrice=slPrice,
                        slSide="SELL" if side == "BUY" else "BUY",
                        slSize=size,
                        slTriggerPrice=slPrice,
                        isSetOpenTp=True,
                        tpPrice=tpPrice,
                        tpSide="SELL" if side == "BUY" else "BUY",
                        tpSize=size,
                        tpTriggerPrice=tpPrice,
                    )
                case "MARKET":
                    # Frontend sends tpPrice/slPrice as 0 when not set, so check
                    # for a real non-zero value rather than just `is not None`.
                    _has_tp = tpPrice is not None and float(tpPrice) > 0
                    _has_sl = slPrice is not None and float(slPrice) > 0
                    _close_side = "SELL" if side == "BUY" else "BUY"
                    order = client.create_order_v3(
                        symbol=symbol,
                        side=side,
                        price=price,
                        type=type,
                        size=size,
                        isOpenTpslOrder=_has_tp or _has_sl,
                        isSetOpenTp=_has_tp,
                        tpPrice=tpPrice if _has_tp else None,
                        tpTriggerPrice=tpPrice if _has_tp else None,
                        tpSize=size if _has_tp else None,
                        tpSide=_close_side if _has_tp else None,
                        isSetOpenSl=_has_sl,
                        slPrice=slPrice if _has_sl else None,
                        slTriggerPrice=slPrice if _has_sl else None,
                        slSize=size if _has_sl else None,
                        slSide=_close_side if _has_sl else None,
                        reduceOnly=reduceOnly,
                    )
                case _:
                    order = client.create_order_v3(
                        symbol=symbol,
                        side=side,
                        price=price,
                        type=type,
                        size=size,
                        reduceOnly=reduceOnly,
                    )
            id = str(uuid.uuid4())
            leverage = trades.get_leverage(user_id=user_id, symbol=symbol)

            if "code" in order:
                """process failed"""
                if database.postgres is not None:
                    conn = database.postgres.getconn()
                    cur = conn.cursor()

                    cur.execute(
                        """
                            insert into
                                apex_orders
                            (id, user_id, exchange, symbol, side, type, qty, price, leverage, tp, sl, status, apex_order_id, error_message, created_at, updated_at)
                                values
                            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                        """,
                        (
                            id,
                            user_id,
                            "apex",
                            symbol,
                            side,
                            type,
                            size,
                            price,
                            leverage,
                            tpPrice,
                            slPrice,
                            "failed",
                            None,
                            f"{order.get('code')} - {order.get('key')} - {order.get('detail')} - {order.get('msg')}",
                        ),
                    )

                    conn.commit()
                    cur.close()

                    raise ValueError("error placing order")
            """process succeeded"""
            s: IOrderResponseSuccessful = order  # type: ignore

            if database.postgres is not None:
                conn = database.postgres.getconn()
                cur = conn.cursor()
                cur.execute(
                    """
                        insert into
                            apex_orders
                        (id, user_id, exchange, symbol, side, type, qty, price, leverage, tp, sl, status, apex_order_id, apex_id, apex_client_id, error_message, retry, created_at, updated_at)
                            values
                        (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                    """,
                    (
                        id,
                        user_id,
                        "apex",
                        s.get("data", {}).get("symbol"),
                        s.get("data", {}).get("side"),
                        s.get("data", {}).get("type"),
                        s.get("data", {}).get("size"),
                        s.get("data", {}).get("price"),
                        leverage,
                        tpPrice,
                        slPrice,
                        s.get("data", {}).get("status"),
                        s.get("data", {}).get("orderId") or None,
                        s.get("data", {}).get("id"),
                        s.get("data", {}).get("clientOrderId"),
                        "",
                        retry,
                    ),
                )
                conn.commit()
                cur.close()

            return {
                "data":{
                    "status": True,
                    "message": f"Successfully placed {type} trade of position {size} {side} for {symbol}",
                    "data": s["data"],
                },
                "error": None
            }
    
    except Exception as e:
        return {
            "data": None,
            "error": e
        }
    
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def add_tp_sl(tpsl_request: TpslRequest, user_id: int, symbol: str) -> ServiceResponse:
    conn = None
    body = tpsl_request
    try:
        side = body.side
        size = body.size
        tpPrice = body.tpPrice
        triggerPriceType = body.triggerPriceType
        slPrice = body.slPrice

        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (user_id,),
        )
        data: ICredential = cur.fetchone()

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

        if price is None:
            raise ValueError("Price is empty")
        else:
            order: IOrderResponseFailed
            orders: List[IOrderResponseSuccessful] = []
            messages: List[str] = []

            if tpPrice is None and slPrice is None:
                raise ValueError("Required fields missing. Both tpPrice and slPrice cannot be empty")

            if tpPrice is not None:
                existing_tps = db.get_untriggered_orders(
                    cur,
                    user_id,
                    "TAKE_PROFIT_MARKET",
                    symbol
                )
                
                DUPLICATE_TP_DOES_NOT_EXISTS = all(float(tp.get("trigger_price")) != tpPrice for tp in existing_tps)
                if DUPLICATE_TP_DOES_NOT_EXISTS: 
                    order = client.create_order_v3(
                        symbol=symbol,
                        side=side,
                        type="TAKE_PROFIT_MARKET",
                        size=size,
                        price=price,
                        triggerPrice=tpPrice,
                        triggerPriceType=triggerPriceType,
                        reduceOnly=True,
                        isPositionTpsl=True,
                    )
                    if "code" in order:
                        raise ValueError(order)
                    else:
                        for o in existing_tps:
                            client.delete_order_v3(id=o.get("id"))
                        messages.append(
                            f"Successfully added TP at {tpPrice} of size {size} for {symbol}"
                        )
                        orders.append(order)
                else:
                    messages.append(f"TP at {tpPrice} already exists")

            if slPrice is not None:
                existing_sls = db.get_untriggered_orders(
                    cur,
                    user_id,
                    "STOP_MARKET",
                    symbol
                )

                DUPLICATE_SL_DOES_NOT_EXISTS = all(float(sl.get("trigger_price")) != slPrice for sl in existing_sls)
                if  DUPLICATE_SL_DOES_NOT_EXISTS:
                        order = client.create_order_v3(
                            symbol=symbol,
                            side=side,
                            type="STOP_MARKET",
                            size=size,
                            price=price,
                            triggerPrice=slPrice,
                            triggerPriceType=triggerPriceType,
                            reduceOnly=True,
                            isPositionTpsl=True,
                        )

                        if "code" in order:
                            raise ValueError(order)
                        else:
                            for o in existing_sls:
                                client.delete_order_v3(id=o.get("id"))
                            messages.append(
                                f"Successfully added SL at {slPrice} of size {size} for {symbol}"
                            )
                            orders.append(order)
                else:
                    messages.append(f"SL at {slPrice} already exists")

            for o in orders:
                id = str(uuid.uuid4())

                if database.postgres is not None:
                    cur.execute(
                        """
                        insert into
                            apex_orders
                        (id, user_id, exchange, symbol, side, type, qty, price, leverage, status, apex_order_id, apex_id, apex_client_id, error_message, sl, tp, created_at, updated_at)
                            values
                        (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                        """,
                        (
                            id,
                            user_id,
                            "apex",
                            o.get("data", {}).get("symbol"),
                            o.get("data", {}).get("side"),
                            o.get("data", {}).get("type"),
                            o.get("data", {}).get("size"),
                            o.get("data", {}).get("price"),
                            1,
                            o.get("data", {}).get("status"),
                            o.get("data", {}).get("orderId") or None,
                            o.get("data", {}).get("id"),
                            o.get("data", {}).get("clientOrderId"),
                            "",
                            slPrice,
                            tpPrice,
                        ),
                    )

            conn.commit()
            cur.close()

            return {
                "data": {
                    "status": True,
                    "message": messages,
                    "data": orders,
                },
                "error": None
            }
    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return {
            "data": None,
            "error": e
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)
        
def delete_order(order_id, user_id) -> ServiceResponse:
    conn = True
    id = order_id
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (user_id,),
        )
        data: ICredential = cur.fetchone()

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

        # Look up the order details BEFORE deleting so we know its type/symbol/side.
        # This is needed so the CopyTrade dispatcher can propagate TP/SL
        # cancellations to followers.
        order_details = None
        try:
            cur.execute(
                "SELECT symbol, side, type, size, price, trigger_price FROM orders WHERE id = %s",
                (id,),
            )
            order_details = cur.fetchone()
        except Exception as e:
            logging.warning(f"Could not look up order {id} before delete: {e}")

        response = client.delete_order_v3(id=id)
        if "code" in response:
            raise ValueError("Failed to delete order")

        # If this was a SL or TP order placed by a Pro trader, insert a
        # cancellation record into apex_orders so the CopyTrade dispatcher
        # can propagate the removal to followers.
        if order_details is not None:
            order_type = (
                order_details.get("type", "") if isinstance(order_details, dict) else ""
            )
            if order_type in ("STOP_MARKET", "TAKE_PROFIT_MARKET"):
                try:
                    cancel_id = str(uuid.uuid4())
                    cancel_type = f"CANCEL_{order_type}"
                    cur.execute(
                        """
                        INSERT INTO apex_orders
                            (id, user_id, exchange, symbol, side, type, qty, price, leverage,
                             status, apex_order_id, error_message, created_at, updated_at, order_type)
                        VALUES
                            (%s, %s, 'apex', %s, %s, %s, %s, %s, 1,
                             'cancelled', %s, '', now(), now(), 'manual')
                        """,
                        (
                            cancel_id,
                            user_id,
                            order_details.get("symbol")
                            if isinstance(order_details, dict)
                            else None,
                            order_details.get("side")
                            if isinstance(order_details, dict)
                            else None,
                            cancel_type,
                            order_details.get("size")
                            if isinstance(order_details, dict)
                            else None,
                            order_details.get("trigger_price")
                            if isinstance(order_details, dict)
                            else None,
                            id,
                        ),
                    )
                    conn.commit()
                except Exception as e:
                    logging.warning(
                        f"Could not insert cancellation record for order {id}: {e}"
                    )
        
        return {
            "data": {
                "status": True,
                "message": "Successfully deleted order",
                "data": response,
            },
            "error": None
        }
    
    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return {
            "data": None,
            "error": e
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)
    
def get_historical_orders(user_id: int) -> ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

        client = HttpPrivate_v3(
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

        orders = client.history_orders_v3()

        if "code" in orders:
            """request failed"""
            raise ValueError(
                "Failed to fetch historical orders. Please try again later"
            )

        else:
            if "data" in orders:
                d: IOrderResponseData = orders["data"]
                return {"data": {"status": True, "data": d}, "error": None}
            else:
                return {"data": {"status": True, "data": orders}, "error": None}
    except Exception as e:
        logging.error(f"fetch historical orders error: {str(e)}")
        return {
            "error": e,
            "data": None
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_open_orders(user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

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
        account: IAccount = client.get_account_v3()

        if account is None:
            raise ValueError(
                "Could not retrieve data at this time. please check credentials are correct",
            )
        
        if "code" in account:  #   type: ignore
            """request failed"""
            raise ValueError(
               "Failed to fetch open orders"
            )
        else:
            return {"data": {"status": True, "data": account.get("positions")}, "error": None}
    except Exception as e:
        logging.error(f"fetch open orders error: {str(e)}")
        return {
            "data": None,
            "error": e
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_filled_orders(user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

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
        fills = client.trades_v3()

        if fills is None:
           raise ValueError("could not retrieve data at this time. please check credentials are correct",)

        if "code" in fills:  #   type: ignore
            """request failed"""
            raise ValueError(fills)
        else:
            return {"data": {"status": True, "data": fills}, "error": None}
    
    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return {
            "data": None,
            "error": e
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_historical_pnl(user_id: int, page: int = 1, per_page: int = 100)->ServiceResponse:
    conn = True
    page = page - 1 if page >= 1 else 0
    per_page = 100 if per_page < 1 else per_page
    
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

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
        pnl: IHistoricalPnl = client.historical_pnl_v3(page=page, limit=per_page)

        if pnl is None:
            raise ValueError(
               "could not retrieve data at this time. please check credentials are correct"
            )

        if "code" in pnl:  #   type: ignore
            """request failed"""
            raise ValueError(
                "Failed to fetch historical P&L. Please try again later"
            )
        else:
            return {
                "data": {"status": True, "data": pnl.get("data").get("historicalPnl"), "count": pnl.get("data").get("totalSize")},
                "error": None
            }

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return {
            "data": None,
            "error": e
        }
        
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_account(user_id: int)->ServiceResponse:
    conn = True
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

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
        account: IAccount = client.get_account_v3()

        if account is None:
            raise ValueError(
               "Could not retrieve data at this time. Please check credentials are correct"
            )

        if "code" in account:  #   type: ignore
            """request failed"""
            raise ValueError(
                "Failed to fetch account details. Please try again later"
            )
        else:
            return {
               "data": {
                    "status": True,
                    "message": "Successfully fetched account details",
                    "data": account,
                },
                "error": None
            }

    except Exception as e:
        logging.error(f"get account error: {str(e)}")
        return {
            "error": e,
            "data": None
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_account_balance(user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

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
        account: IAccountBalance = client.get_account_balance_v3()

        if account is None:
            raise ValueError(
                "Could not retrieve data at this time. Please check credentials are correct"
            )

        if "code" in account:  #   type: ignore
            """request failed"""
            raise ValueError(
               "Failed to fetch account balance. Please try again later"
            )

        else:
            return {
                "data": {
                    "status": True,
                    "message": "Successfully fetched account balance",
                    "data": account.get("data"),
                },
                "error": None
            }
        
    except Exception as e:
        logging.error(f"account balance error: {str(e)}")
        return {
            "error": e,
            "data": None
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def set_initial_margin(margin_request: MarginRequest, user_id: int)->ServiceResponse:
    conn = None
    body = margin_request
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        symbol = body.symbol
        rate = body.rate

        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "select user_id, name, key, passphrase, secret, seed from apex_credentials ac where active = true and user_id = %s order by created desc",
            (str(user_id),),
        )
        data: ICredential = cur.fetchone()

        key = data.get("key")
        passphrase = data.get("passphrase")
        secret = data.get("secret")
        seed = data.get("seed")

        key = decrypt(key)
        passphrase = decrypt(passphrase)
        secret = decrypt(secret)
        seeds = decrypt(seed)

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

        margin = client.set_initial_margin_rate_v3(
            symbol=symbol, initialMarginRate=rate
        )

        if "code" in margin:
            """request failed"""
            raise ValueError(
               f"Failed to set leverage for {symbol}. Please try again later"
            )

        else:
            return {
               "data": {
                    "status": True,
                    "message": f"Successfully set leverage of {1 / float(rate)}x for {symbol}",
                    "data": margin,
                },
                "error": None
            }

    except Exception as e:
        logging.error(f"margin error: {str(e)}")
        return {
            "error": e,
            "data": None
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_assets()->ServiceResponse:
    try:
        r = requests.get("https://data-api.eagleairesearch.com/v1/assets", timeout=10)
        r.raise_for_status()
        return {"data": {"status": True, "data": r.json()}, "error": None}
    except Exception as e:
        logging.error(f"fetch assets error: {str(e)}")
        return {
            "data": None,
            "error": e
        }

def get_symbols()->ServiceResponse:
    try:
        r = requests.get("https://omni.apex.exchange/api/v3/symbols")
        data: ISymbols = r.json()

        contractConfig = data["data"]["contractConfig"]["perpetualContract"]

        if "code" in data:
            """request failed"""
            raise ValueError(
                "Failed to fetch symbols. Please try again later"
            )
        else:
            return {
                "data": {
                    "status": True,
                    "message": "Successfully processed contract symbols",
                    "data": contractConfig,
                },
                "error": None
            }

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return {
            "data": None,
            "error": e
        }

def get_tp_sl(user_id: int, symbol: str)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError(
                "DB connection not available. Please try again later"
            )
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "SELECT * FROM public.orders WHERE user_id = %s AND symbol = %s and status = 'UNTRIGGERED'",
            (
                user_id,
                symbol,
            ),
        )

        data = cur.fetchall()

        for row in data:
            row["id"] = str(row["id"])
            
        return {"data": {"status": True, "data": data}, "error": None}
    except Exception as e:
        logging.error(f"fetch historical orders error: {str(e)}")
        return {
            "data": None,
            "error": e
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)