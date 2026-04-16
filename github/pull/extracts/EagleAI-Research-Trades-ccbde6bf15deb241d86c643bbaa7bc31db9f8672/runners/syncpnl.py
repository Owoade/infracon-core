from database import database
from psycopg2.extras import RealDictCursor, execute_values
from trades import decrypt
from apexomni.http_private_sign import HttpPrivateSign
from apexomni.constants import APEX_OMNI_HTTP_MAIN, NETWORKID_MAIN
from utils.types import IHistoricalPnl
import logging


def sync_users_pnl():
    # Fetch user's credentials
    conn = database.postgres.getconn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cur.execute(
                "SELECT user_id, key, passphrase, secret, seed FROM apex_credentials WHERE active = true"
            )
            credentials = cur.fetchall()
        finally:
            cur.close()
    finally:
        database.postgres.putconn(conn)

    for cr in credentials:
        user_id = cr.get("user_id")
        key = cr.get("key")
        secret = cr.get("secret")
        passphrase = cr.get("passphrase")
        seeds = cr.get("seed")
        
        try:
            key = decrypt(key)
            secret = decrypt(secret)
            passphrase = decrypt(passphrase)
            seeds = decrypt(seeds)
            
            # Fetch PnL for each user
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

            fetch_and_sync_historical_pnl(client=client, user_id=user_id, page=0)
        except Exception as e:
            logging.error(f"Failed to sync PnL for user {user_id}: {e}")
            continue


def fetch_and_sync_historical_pnl(client, user_id, page):
    pnl: IHistoricalPnl = client.historical_pnl_v3(page=page)

    if pnl is None or pnl.get("code") == "request failed" or pnl.get("data") is None:
        return
    
    historical_pnl = pnl.get("data").get("historicalPnl")
    total_size = pnl.get("data").get("totalSize")
    logging.info(f"Total size: {total_size}, Total returned pnl: {len(historical_pnl)}, Page: {page}")
    
    if not historical_pnl or len(historical_pnl) == 0:
        return

    batch_data = []
    for data in historical_pnl:
        batch_data.append((
            user_id,
            data.get("id"),
            "APEX",
            data.get("symbol"),
            data.get("side"),
            data.get("type"),
            data.get("exitType"),
            data.get("size"),
            data.get("price"),
            data.get("exitPrice"),
            data.get("totalPnl"),
            data.get("fee"),
            data.get("liquidateFee"),
            data.get("closeSharedOpenFee"),
            data.get("closeSharedOpenValue"),
            data.get("closeSharedFundingFee"),
            data.get("isLiquidate"),
            data.get("isDeleverage"),
            data.get("createdAt")
        ))
    conn = database.postgres.getconn()
    try:
        cur = conn.cursor()
        try:
            execute_values(
                cur,
                """
                INSERT INTO public.apex_user_historical_pnl (
                    user_id, trade_id, venue,
                    symbol, side, type, exit_type,
                    size_base, entry_price, exit_price,
                    total_pnl_quote, fee_quote, liquidate_fee_quote,
                    close_open_fee_quote, close_open_val_quote, close_funding_fee_qt,
                    is_liquidate, is_deleverage, created_at_ms
                )
                VALUES %s
                ON CONFLICT (user_id, trade_id) DO UPDATE SET
                    symbol               = EXCLUDED.symbol,
                    side                 = EXCLUDED.side,
                    type                 = EXCLUDED.type,
                    exit_type            = EXCLUDED.exit_type,
                    size_base            = EXCLUDED.size_base,
                    entry_price          = EXCLUDED.entry_price,
                    exit_price           = EXCLUDED.exit_price,
                    total_pnl_quote      = EXCLUDED.total_pnl_quote,
                    fee_quote            = EXCLUDED.fee_quote,
                    liquidate_fee_quote  = EXCLUDED.liquidate_fee_quote,
                    close_open_fee_quote = EXCLUDED.close_open_fee_quote,
                    close_open_val_quote = EXCLUDED.close_open_val_quote,
                    close_funding_fee_qt = EXCLUDED.close_funding_fee_qt,
                    is_liquidate         = EXCLUDED.is_liquidate,
                    is_deleverage        = EXCLUDED.is_deleverage,
                    created_at_ms        = EXCLUDED.created_at_ms,
                    updated_at           = now();
                """,
                batch_data
            )
            conn.commit()
            logging.info(f"Successfully synced {len(batch_data)} PnL records for user {user_id}")
        except Exception as e:
            conn.rollback()
            logging.error(f"Database error for user {user_id}: {e}")
            raise
        finally:
            cur.close()
    finally:
        database.postgres.putconn(conn)
    
    if total_size > ((page* 100) + len(historical_pnl)):
        page += 1
        fetch_and_sync_historical_pnl(client=client, user_id=user_id, page=page)