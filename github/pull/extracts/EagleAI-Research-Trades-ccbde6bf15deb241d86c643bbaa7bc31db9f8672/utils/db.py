from utils.types import IBinanceCredential, GetBinanceOrderFilter
from trades import decrypt
from typing import List
import json
from database import database
from psycopg2.extras import RealDictCursor
from typing import Literal

def fetch_binance_credentials(cur, user_id):
    cur.execute(
        "select user_id, api_key, secret from binance_credentials where user_id = %s",
        (user_id,),
    )
    data: IBinanceCredential = cur.fetchone()
    if data is None:
        return None
    api_key = data.get("api_key")
    secret = data.get("secret")

    api_key = decrypt(api_key)
    secret = decrypt(secret)

    return {
        "api_key": api_key,
        "secret": secret
    }

def get_user_preferred_trading_platform(user_id: int) -> Literal["APEX", "BINANCE"]:
    # Check cache first
    if database.redis is not None:
        try:
            cached_value = database.redis.get(f"{user_id}@user-trading-plarform")
            if cached_value is not None:
                return cached_value
        except Exception:
            pass

    if database.postgres is None:
        print(f"get_user_preferred_trading_platform: no DB connection, defaulting to APEX for user {user_id}")
        return "APEX"

    conn = None
    try:
        conn = database.postgres.getconn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "select trading_platform from users where id = %s",
            (user_id,),
        )
        user = cur.fetchone()
        cur.close()
        trading_platform = (
            user.get("trading_platform") or "APEX"
            if user is not None
            else "APEX"
        )
        if database.redis is not None:
            try:
                database.redis.setex(f"{user_id}@user-trading-plarform", 300, trading_platform)
            except Exception:
                pass
        return trading_platform
    except Exception as e:
        print(f"get_user_preferred_trading_platform error for user {user_id}: {e}, defaulting to APEX")
        return "APEX"
    finally:
        if conn is not None:
            database.postgres.putconn(conn)

def get_untriggered_orders(cur, user_id, order_type, symbol):
    cur.execute(
        """
        SELECT * 
        FROM orders 
        WHERE user_id = %s 
        AND type = %s 
        AND symbol = %s 
        AND status = %s
        """,
        (user_id, order_type, symbol, "UNTRIGGERED"),
    )
    orders = cur.fetchall()
    return orders

def insert_binance_order(cur, conn, user_id, order):
    cur.execute(
        """
        INSERT INTO binance_orders (
            order_id,
            is_conditional,
            user_id,
            symbol,
            side,
            position_side,
            quantity,
            price,
            order_type,
            status,
            create_time,
            update_time,
            trigger_time,
            good_till_date,
            time_in_force,
            client_order_id,
            executed_qty,
            avg_price,
            cum_qty,
            cum_quote,
            stop_price,
            orig_type,
            orig_qty,
            reduce_only,
            close_position,
            price_protect,
            price_match,
            self_trade_prevention_mode,
            working_type,
            additional_properties
        ) VALUES (
            %(order_id)s,
            %(is_conditional)s,
            %(user_id)s,
            %(symbol)s,
            %(side)s,
            %(position_side)s,
            %(quantity)s,
            %(price)s,
            %(order_type)s,
            %(status)s,
            %(create_time)s,
            %(update_time)s,
            %(trigger_time)s,
            %(good_till_date)s,
            %(time_in_force)s,
            %(client_order_id)s,
            %(executed_qty)s,
            %(avg_price)s,
            %(cum_qty)s,
            %(cum_quote)s,
            %(stop_price)s,
            %(orig_type)s,
            %(orig_qty)s,
            %(reduce_only)s,
            %(close_position)s,
            %(price_protect)s,
            %(price_match)s,
            %(self_trade_prevention_mode)s,
            %(working_type)s,
            %(additional_properties)s
        )
        """,
        {
            'order_id': order['order_id'],
            'is_conditional': False,
            'user_id': user_id,
            'symbol': order['symbol'],
            'side': order['side'],
            'position_side': order['position_side'],
            'quantity': order['orig_qty'],
            'price': order['price'],
            'order_type': order['type'],
            'status': order['status'],
            'create_time': order.get('time', order['update_time']),
            'update_time': order['update_time'],
            'trigger_time': 0,
            'good_till_date': order['good_till_date'],
            'time_in_force': order['time_in_force'],
            'client_order_id': order['client_order_id'],
            'executed_qty': order['executed_qty'],
            'avg_price': order['avg_price'],
            'cum_qty': order['cum_qty'],
            'cum_quote': order['cum_quote'],
            'stop_price': order['stop_price'],
            'orig_type': order['orig_type'],
            'orig_qty': order['orig_qty'],
            'reduce_only': order['reduce_only'],
            'close_position': order['close_position'],
            'price_protect': order['price_protect'],
            'price_match': order['price_match'],
            'self_trade_prevention_mode': order['self_trade_prevention_mode'],
            'working_type': order['working_type'],
            'additional_properties': json.dumps(order.get('additional_properties', {}))
        }
    )
    conn.commit()

def insert_binance_conditional_order(cur, conn, user_id, order):
    cur.execute(
        """
        INSERT INTO binance_orders (
            order_id,
            is_conditional,
            user_id,
            symbol,
            side,
            position_side,
            quantity,
            price,
            order_type,
            status,
            create_time,
            update_time,
            trigger_time,
            good_till_date,
            time_in_force,
            client_order_id,
            algo_type,
            trigger_price,
            activate_price,
            algo_status,
            working_type,
            reduce_only,
            close_position,
            price_protect,
            iceberg_quantity,
            callback_rate,
            price_match,
            self_trade_prevention_mode,
            additional_properties,
            cancels
        ) VALUES (
            %(order_id)s,
            %(is_conditional)s,
            %(user_id)s,
            %(symbol)s,
            %(side)s,
            %(position_side)s,
            %(quantity)s,
            %(price)s,
            %(order_type)s,
            %(status)s,
            %(create_time)s,
            %(update_time)s,
            %(trigger_time)s,
            %(good_till_date)s,
            %(time_in_force)s,
            %(client_order_id)s,
            %(algo_type)s,
            %(trigger_price)s,
            %(activate_price)s,
            %(algo_status)s,
            %(working_type)s,
            %(reduce_only)s,
            %(close_position)s,
            %(price_protect)s,
            %(iceberg_quantity)s,
            %(callback_rate)s,
            %(price_match)s,
            %(self_trade_prevention_mode)s,
            %(additional_properties)s,
            %(cancels)s
        )
        """,
        {
            'order_id': order['algo_id'],
            'is_conditional': True,
            'user_id': user_id,
            'symbol': order['symbol'],
            'side': order['side'],
            'position_side': order['position_side'],
            'quantity': order['quantity'],
            'price': order['price'],
            'order_type': order['order_type'],
            'status': order['algo_status'],  # Map algo_status to status column
            'create_time': order['create_time'],
            'update_time': order['update_time'],
            'trigger_time': order['trigger_time'],
            'good_till_date': order['good_till_date'],
            'time_in_force': order['time_in_force'],
            'client_order_id': order['client_algo_id'],  # Map client_algo_id to client_order_id
            'algo_type': order['algo_type'],
            'trigger_price': order['trigger_price'],
            'activate_price': order['activate_price'],
            'algo_status': order['algo_status'],
            'working_type': order['working_type'],
            'reduce_only': order['reduce_only'],
            'close_position': order['close_position'],
            'price_protect': order['price_protect'],
            'iceberg_quantity': order['iceberg_quantity'],
            'callback_rate': order['callback_rate'],
            'price_match': order['price_match'],
            'self_trade_prevention_mode': order['self_trade_prevention_mode'],
            'additional_properties': json.dumps(order.get('additional_properties', {})),
            'cancels': order.get("cancels")
        }
    )
    conn.commit()

def get_binance_order(cur, filter: GetBinanceOrderFilter, attributes: List[str]):
    if attributes is None:
        attributes = ["*"]

    columns = ", ".join(attributes)
    cur.execute(
        f"""
        SELECT {columns}
        FROM all_binance_orders
        WHERE order_id = %s
        AND user_id = %s
        """,
        (
            filter.get("order_id"),
            filter.get("user_id"),
        ),
    )
    
    return cur.fetchone()

def get_tp_sl(cur, user_id, symbol):
    cur.execute(
        """
            SELECT * FROM all_binance_orders
            WHERE user_id = %s AND symbol = %s AND status = 'NEW' AND is_conditional
        """,
        (
            user_id,
            symbol,
        )
    )

    return cur.fetchall()

def get_untriggered_conditional_binance_orders(cur, user_id, type, symbol):
    cur.execute(
        """
            SELECT * FROM all_binance_orders
            WHERE user_id = %s AND symbol = %s AND status = 'NEW' AND order_type = %s AND is_conditional
        """,
        (
            user_id,
            symbol,
            type,
        )
    )

    return cur.fetchall()

def copytrade_execution_exists(conn, id: str) -> bool:
    query = "SELECT 1 FROM copytrade_executions WHERE id = %s LIMIT 1;"
    with conn.cursor() as cur:
        cur.execute(query, (id,))
        return cur.fetchone() is not None


def insert_copytrade_execution(conn, pro_trader_id: int, follower_id: int, order_id: str, exchange: str, id: str):
    query = """
        INSERT INTO copytrade_executions (id, pro_trader_id, follower_id, order_id, exchange)
        VALUES (%s, %s, %s, %s, %s);
    """

    with conn.cursor() as cur:
        cur.execute(query, (id, pro_trader_id, follower_id, order_id, exchange))
        conn.commit()