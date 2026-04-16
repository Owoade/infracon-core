import os
import sqlite3

import redis
from dotenv import find_dotenv, load_dotenv
from psycopg2 import pool

load_dotenv(find_dotenv())


class Database:
    def __init__(self):
        # self.sqlite3 = self.handleSqlite3()
        self.postgres = self.handlePostgres()
        self.redis = self.handleRedis()

    def handleRedis(self):
        try:
            host = os.getenv("REDIS_HOST")
            password = os.getenv("REDIS_PASSWORD")

            pool = redis.ConnectionPool(
                host=host,
                port=6379,
                password=password,
                db=0,
                decode_responses=True,
            )

            r = redis.Redis(connection_pool=pool)

            return r
        except Exception as e:
            print(f"error connecting to redis: {e}")
            return None

    def handlePostgres(self):
        try:
            base = os.path.dirname(os.path.abspath(__file__))
            is_dev_environment = os.getenv("ENVIRONMENT") == "development"
            postgres = pool.SimpleConnectionPool(
                minconn=1,
                maxconn=200,
                host=os.getenv("TRADEANALYTICS_DB_HOST"),
                port=5432,
                user=os.getenv("TRADEANALYTICS_DB_USER"),
                password=os.getenv("TRADEANALYTICS_DB_PASS"),
                database=os.getenv("TRADEANALYTICS_DB_NAME"),
                sslrootcert=os.path.join(base, "./certs/server-ca.pem") if not is_dev_environment else None,
                sslcert=os.path.join(base, "./certs/client-cert.pem") if not is_dev_environment else None,
                sslkey=os.path.join(base, "./certs/client-key.pem") if not is_dev_environment else None,
            )

            return postgres
        except Exception as e:
            print(f"error connecting to PostgreSQL: {e}")
            return None

    def handleSqlite3(self):
        try:
            conn = sqlite3.connect("./sqlite3/trades.db")
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as e:
            print(f"error connecting to Sqlite3: {e}")
            return None


database = Database()
