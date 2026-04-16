import logging 
from flask import Blueprint, request
from utils.validation import OrderRequest, MarginRequest, TpslRequest
from binance_common.configuration import ConfigurationRestAPI
from binance_common.constants import DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL
from binance_sdk_derivatives_trading_usds_futures.derivatives_trading_usds_futures import DerivativesTradingUsdsFutures
from binance_sdk_derivatives_trading_usds_futures.rest_api.models import NewOrderSideEnum, NewAlgoOrderPriceMatchEnum, NewOrderTimeInForceEnum
from utils.authentication import authentication
from database import database
from psycopg2.extras import RealDictCursor
from utils import db
from utils.types import ServiceResponse
import time

import json
logging.basicConfig(
    filename="trades.binance.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

def place_order(order_request: OrderRequest, user_id: int)->ServiceResponse:
    conn = None
    body = order_request
    symbol = body.symbol.replace("-", "")
    side = body.side
    size = body.size
    type = body.type
    tpPrice = body.tpPrice
    slPrice = body.slPrice
    triggerPrice = body.triggerPrice
    triggerPriceType = body.triggerPriceType
    orderPrice = body.orderPrice
    price=body.price
    reduceOnly = body.reduceOnly
    
    try:
        if database.postgres is None:
            logging.error("Unable to connect to database")
            raise ValueError("Something went wrong, Code:001")
         
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
           raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        side_hash = {
            "BUY": NewOrderSideEnum.BUY,
            "SELL": NewOrderSideEnum.SELL
        }

        type_hash = {
            "MARKET": "MARKET",
            "LIMIT": "LIMIT",
            "TAKE_PROFIT_MARKET": "TAKE_PROFIT_MARKET",
            "STOP_LIMIT": "STOP",
            "STOP_MARKET": "STOP_MARKET"
        }

        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        match type:
            case "LIMIT":
                order = client.rest_api.new_order(
                    symbol=symbol,
                    side=side_hash[side],
                    price=orderPrice,
                    type=type_hash[type],
                    quantity=size,
                    reduce_only=reduceOnly,
                    time_in_force=NewOrderTimeInForceEnum.GTC
                )
            case "STOP_LIMIT":
                order = client.rest_api.new_algo_order(
                    algo_type="CONDITIONAL",
                    symbol=symbol,
                    side=side_hash[side],
                    price=orderPrice,
                    type=type_hash[type],
                    quantity=size,
                    trigger_price=triggerPrice,
                )
            case "TAKE_PROFIT_MARKET":
                order = client.rest_api.new_algo_order(
                    algo_type="CONDITIONAL",
                    symbol=symbol,
                    side=side_hash[side],
                    type=type_hash[type],
                    quantity=size,
                    trigger_price=triggerPrice,
                )
            case _:
                order = client.rest_api.new_order(
                    symbol=symbol,
                    side=side_hash[side],
                    type=type_hash[type],
                    quantity=size,
                    reduce_only=reduceOnly
                )

        order = order.data().__dict__
       
        if type == "LIMIT" or type == "MARKET":
            db.insert_binance_order(cur, conn, user_id, order)
        else: 
            db.insert_binance_conditional_order(cur, conn, user_id, order)
            
        slTp = []
        tp = None
        if tpPrice is not None:
          
            try:
                tp = client.rest_api.new_algo_order(
                    algo_type="CONDITIONAL",
                    symbol=symbol,
                    type=type_hash['TAKE_PROFIT_MARKET'],
                    side=side_hash['BUY'] if side == "SELL" else side_hash['SELL'],
                    quantity=size,
                    trigger_price=tpPrice,
                    reduce_only=True
                )
                
                tp = tp.data().__dict__
                db.insert_binance_conditional_order(cur, conn, user_id, tp)
                slTp.append(f"TP set to {tpPrice}")

            except Exception as e:
               logging.error(
                    "Could not set TP(%s) for order (size=%s, symbol=%s, user_id=%s) reason: %s",
                    tpPrice, size, symbol, user_id, e.__dict__.get("error_message") if hasattr(e, "__dict__") else str(e)
               )
            
        sl = None
        if slPrice is not None:
            try:
                sl = client.rest_api.new_algo_order(
                    algo_type="CONDITIONAL",
                    symbol=symbol,
                    type=type_hash['STOP_MARKET'],
                    side=side_hash['BUY'] if side == "SELL" else side_hash['SELL'],
                    quantity=size,
                    trigger_price=slPrice,
                    reduce_only=True
                )
            
                sl = sl.data().__dict__
                db.insert_binance_conditional_order(cur, conn, user_id, sl)
                slTp.append(f"SL set to {slPrice}")
            
            except Exception as e:
               logging.error(
                    "Could not set SL(%s) for order (size=%s, symbol=%s, user_id=%s) reason: %s",
                    slPrice, size, symbol, user_id, e.__dict__.get("error_message") if hasattr(e, "__dict__") else str(e)
                )

        slTpMessage = (" and ").join(slTp)
        cur.close()
        return {
           "data": {
                "status": True,
                "message": 
                    "Order placed successfuly" if len(slTp) == 0 
                    else (" with ").join(["Order placed successfuly", slTpMessage]),
                "data": {
                    "order": order
                }
            },
            "error": None
        }
    except Exception as e:
        return {
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e)),
            "data": None
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def cancel_open_order(order_id: str, user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        order = db.get_binance_order(
            cur,
            {
                "user_id": user_id,
                "order_id": order_id
            },
            ["*"] # select all columns 
        )

        if order is None:
            raise ValueError("Order not found")
        
        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        if order.get("is_conditional"):
            client.rest_api.cancel_algo_order(
                order_id
            )
            db.insert_binance_conditional_order(
                cur,
                conn,
                user_id,
                {
                    "algo_id": int(time.time_ns()),       
                    "symbol": order["symbol"],
                    "side": order["side"],
                    "position_side": order['position_side'],
                    "quantity": order['quantity'],
                    "price": order['price'],
                    "order_type": f"CANCEL_{order['order_type']}",
                    "status": "CANCELLED",
                    "algo_status": "CANCELLED",
                    "create_time": order['create_time'],
                    "update_time": order['update_time'],
                    "trigger_time": order['trigger_time'],
                    "good_till_date": order['good_till_date'],
                    "time_in_force": order['time_in_force'],
                    "client_algo_id": order['client_order_id'],
                    "algo_type": order['algo_type'],
                    "trigger_price": order['trigger_price'],
                    "activate_price": order['activate_price'],
                    "working_type": order['working_type'],
                    "reduce_only": order['reduce_only'],
                    "close_position": order['close_position'],
                    "price_protect": order['price_protect'],
                    "iceberg_quantity": order['iceberg_quantity'],
                    "callback_rate": order['callback_rate'],
                    "price_match": order['price_match'],
                    "self_trade_prevention_mode": order['self_trade_prevention_mode'],
                    "additional_properties": order.get('additional_properties', {}),
                    "cancels": order.get("order_id")
                }
            )
        else:
            client.rest_api.cancel_order(
                symbol=order.get("symbol"),
                order_id=order_id
            )
        return {
            "data": {
                "status": True,
                "message": "Order cancelled successfuly"
            },
            "error": None
        }
    
    except Exception as e:
       return {
           "data": None,
           "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e))
       }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_open_position(symbol: str, user_id: int)->ServiceResponse:
    conn = None
    try:
        symbol = symbol.replace("-", "")
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        response = client.rest_api.position_information_v2(symbol=symbol)
        data = response.data()
        positions = list(map(lambda p: p.__dict__, data))

        return {
            "data": {
                "status": True,
                "data": positions
            },
            "error": None
        }
    
    except Exception as e:
       return {
           "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e)),
           "data": None
       }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_account_summary(user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        response = client.rest_api.futures_account_balance_v2()
        data = response.data()
        account_balance = list(map(lambda p: p.__dict__, data))

        return {
            "data": {
                "status": False,
                "message": "Account balance retrieved",
                "data": {
                    "account_balance": account_balance
                }
            },
            "error": None
        }
    except Exception as e:
       ERROR_IS_DICT = hasattr(e, "__dict__")
       return {
           "error": ValueError(e.__dict__.get("error_message") if ERROR_IS_DICT else str(e)),
           "data": None
       }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def set_leverage(margin_request: MarginRequest, user_id: int)->ServiceResponse:
    conn = None
    body = margin_request

    try:
        symbol = body.symbol
        leverage = body.rate
        symbol = symbol.replace("-", "")

        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        leverage = int(1 / float(leverage))

        response = client.rest_api.change_initial_leverage(symbol=symbol, leverage=leverage)
        data = response.data().__dict__
        return {
                "data": {
                "status": True,
                "message": "Leverage set",
                "data": data
            }
        }

    except Exception as e:
         return {
             "data": None,
             "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e))
         }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_tradeable_symbols(user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        if database.redis is not None:
            r = database.redis
            try: 
                cached_symbols = r.get("binance-symbols")
                if cached_symbols is not None:
                    return { 
                        "data": {
                            "message": "Symbols retrieved",
                            "status": True,
                            "data": {
                                "symbols": json.loads(cached_symbols)
                            }
                        }, 
                        "error": None
                    }
            except Exception as e:
                logging.info("Unable to retrieve binance symbols from cache")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        response = client.rest_api.exchange_information()
        data = response.data().__dict__
        _symbols = data.get("symbols")

        symbols = []
        for s in _symbols:
            s = s.__dict__
            s.pop("filters", None)
            symbols.append(s)

        if len(symbols) > 0:
            try:
                r.setex("binance-symbols", 300, json.dumps(symbols))
            except Exception as e:
                logging.info("Unable to write binance symbols to cache")

        return {
            "data": {
                "status": True,
                "message": "Symbols retrieved",
                "data":{
                    "symbol": symbols
                }
            },
            "error": None
        }
    
    except Exception as e:
        return {
            "data": None,
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e))
         }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)
        
def add_tp_sl(tpsl_request: TpslRequest, symbol: str, user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        symbol = symbol.replace("-", "")
        body = tpsl_request
        side = body.side
        size = body.size
        tpPrice = body.tpPrice
        triggerPriceType = body.triggerPriceType
        slPrice = body.slPrice

        side_hash = {
            "BUY": NewOrderSideEnum.BUY,
            "SELL": NewOrderSideEnum.SELL
        }

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        orders = []
        messages = []

        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        if slPrice is not None:
            try:
                existing_sls = db.get_untriggered_conditional_binance_orders(
                    cur,
                    user_id,
                    type="STOP_MARKET",
                    symbol=symbol
                )
                duplicate_sl = any(float(sl.get("trigger_price")) == float(slPrice) for sl in existing_sls)

                if duplicate_sl:
                    messages.append(f"SL already set to {slPrice}")
                else:
                    response = client.rest_api.new_algo_order(
                        algo_type="CONDITIONAL",
                        symbol=symbol,
                        side=side_hash[side],
                        type="STOP_MARKET",
                        quantity=size,
                        trigger_price=slPrice,
                        reduce_only=True
                    )

                    order = response.data().__dict__
                    orders.append(order)
                    messages.append(f"SL set to {slPrice}")

                    for order in existing_sls:
                        client.rest_api.cancel_algo_order(
                            order.get("order_id")
                        )

            except Exception as e: 
                if hasattr(e, "error_message"):
                    e.error_message = f"Stop loss {e.error_message}"
                raise e
            
        if tpPrice is not None:
            try:
                existing_tps = db.get_untriggered_conditional_binance_orders(
                    cur,
                    user_id,
                    type="TAKE_PROFIT_MARKET",
                    symbol=symbol
                )
                duplicate_tp = any(float(tp.get("trigger_price")) == float(tpPrice) for tp in existing_tps)

                if duplicate_tp:
                    messages.append(f"TP already set to {tpPrice}")
                else:
                    response = client.rest_api.new_algo_order(
                        algo_type="CONDITIONAL",
                        symbol=symbol,
                        side=side_hash[side],
                        type="TAKE_PROFIT_MARKET",
                        quantity=size,
                        trigger_price=tpPrice,
                        reduce_only=True
                    )

                    order = response.data().__dict__
                    orders.append(order)
                    messages.append(f"TP set to {tpPrice}")

                    for order in existing_tps:
                        client.rest_api.cancel_algo_order(
                            order.get("order_id")
                        )
        
            except Exception as e: 
                # Cancel SL if already set
                if len(orders) == 1:
                    client.rest_api.cancel_algo_order(
                        algo_id= orders[0].get("algo_id")
                    ) 
                if hasattr(e, "error_message"):
                    e.error_message = f"Take profit {e.error_message}"
                raise e
            

        for order in orders:
            db.insert_binance_conditional_order(
                cur,
                conn,
                user_id,
                order
            )

        cur.close()
        return {
            "data": {
                "status": True,
                "message": " and ".join(messages),
                "data": orders
            },
            "error": None
        }
    
    except Exception as e:
        return {
            "data": None,
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e))
        }
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_past_orders(symbol: str, user_id: int)->ServiceResponse:
    conn = None
    try:
        symbol = symbol.replace("-", "")

        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        response = client.rest_api.all_orders(symbol=symbol)
        data = list(map(lambda o: o.__dict__, response.data()))

        return {
            "data": {
                "status": True,
                "message": "Orders retrieved",
                "data": data
            },
            "error": None
        }
    
    except Exception as e:
        return {
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e)),
            "data": None
        }
    
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_filled_orders(symbol: str, user_id: int)->ServiceResponse:
    conn = None
    try:
        symbol = symbol.replace("-", "")
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)

        response = client.rest_api.account_trade_list(symbol=symbol)
        data = list(map(lambda o: o.__dict__, response.data()))

        return {
            "data": {
                "status": True,
                "message": "Filled orders retrieved",
                "data": data
            },
            "error": None
        }
    
    except Exception as e:
        return {
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e)),
            "data": None
        }
    
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_historical_pnl(user_id: int, page: int = 1, per_page: int = 100)->ServiceResponse:
    page = 1 if page < 1 else page
    per_page = 100 if per_page < 1 else per_page
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)
        
        response = client.rest_api.get_income_history(page=page, limit=per_page)
        data = list(map(lambda o: o.__dict__, response.data()))

        return {
            "data": {
                "status": True,
                "message": "Historical PNL",
                "data": data
            }, 
            "error": None
        }
    
    except Exception as e:
        return {
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e)),
            "data": None
        }
    
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_account_details(user_id: int)->ServiceResponse:
    conn = None
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        credentials = db.fetch_binance_credentials(cur, user_id)
        if credentials is None:
            raise ValueError("Credentials not found, kindly add your credentials to proceed!")
        
        configuration = ConfigurationRestAPI(api_key=credentials.get("api_key"), api_secret=credentials.get("secret"), base_path=DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL)
        client = DerivativesTradingUsdsFutures(config_rest_api=configuration)
        
        response = client.rest_api.account_information_v2()
        data = response.data().__dict__

        if "assets" in data:
            data["assets"] = list(map(lambda a: a.__dict__, data["assets"]))

        if "positions" in data:
            data["positions"] = list(map(lambda p: p.__dict__, data["positions"] ))

        return {
            "data": {
                "status": True,
                "message": "Account details",
                "data": data
            },
            "error": None
        }
    
    except Exception as e:
        return {
            "error": ValueError(e.error_message if hasattr(e, "error_message") else str(e)),
            "data": None
        }
    
    finally:
        if conn and database.postgres:
            database.postgres.putconn(conn)

def get_tpsl(user_id: int, symbol: str)->ServiceResponse:
    conn=None
    symbol = symbol.replace("-", "")
    try:
        if database.postgres is None:
            raise ValueError("Something went wrong, Code:001")
        
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        tpsls = db.get_tp_sl(cur, user_id, symbol)
        return {
            "data": {
                "status": True,
                "data": tpsls
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
    


    
                    

        

        
