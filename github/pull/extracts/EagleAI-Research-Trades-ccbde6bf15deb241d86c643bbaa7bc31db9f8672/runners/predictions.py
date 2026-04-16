import asyncio
import datetime
import logging
import os
import random
import signal
from time import time
from typing import TypedDict

import httpx
from psycopg2.extras import RealDictCursor
from socketio import async_client

from database import database

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.WARNING,  # was INFO — was logging 400 lines per prediction cycle, killing CPU and disk
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)

shutdown = asyncio.Event()


class Data(TypedDict):
    closingPrices: list[float]
    timestamps: list[int]
    currenttime: int
    currency: str
    currPrice: float
    formattedDate: str
    predictedData: list[float]
    formatcurrPrice: str
    currMarketCap: str
    predictedMarketCap: str
    predictedMarketPrice: float | str
    hours: int


class Message(TypedDict):
    is_error: bool
    error: str
    data: Data
    version: str
    email: str
    message_id: str
    requestid: str
    command: str
    payload: str
    first_name: str
    last_name: str
    username: str
    type: str
    loading_message_id: str


class Prediction(TypedDict):
    id: int
    token: str
    prediction_made_time: datetime.datetime
    current_price: float
    prediction_timeframe: datetime.timedelta
    prediction_time: datetime.datetime
    target_price: float
    actual_price: float
    prediction_result: str | None
    model_version: str
    direction_result: str | None
    confidence_level: float | None


class OHLC(TypedDict):
    instrument: str
    high_price: float
    low_price: float
    close_price: float


class Predictions:
    def __init__(self, assets) -> None:
        self.authorization_token = None
        self.assets = assets
        self.baseUrl = "https://api.eagleailabs.com"
        self.last_prediction_fired_at: datetime.datetime | None = None
        self.socket_connected: bool = False
        # Shared HTTP client — avoids creating 400 new connections per cycle
        self._http_client: httpx.AsyncClient | None = None

    async def setupAuthenticationToken(self):
        logging.info("Setting up authentication token")
        retries = 0

        while not shutdown.is_set():
            try:
                now = datetime.datetime.now()

                target = now.replace(hour=0, minute=0, second=0)
                target += datetime.timedelta(days=1)

                async with httpx.AsyncClient() as client:
                    email = os.getenv("USER_EMAIL")
                    password = os.getenv("USER_PASSWORD")

                    if email is None or password is None:
                        raise ValueError("User email and password not set")

                    response = await client.post(
                        f"{self.baseUrl}/api/v1/login",
                        json={
                            "email": email,
                            "password": password,
                        },
                    )

                    if response.status_code != 200:
                        raise ValueError(response)

                    data: dict = response.json()
                    token = data.get("token", {})

                    self.authorization_token = token
                    logging.info("Successfully updated authentication token")

                    retries = 0

                    await asyncio.sleep((target - now).total_seconds())
            except Exception as e:
                retries += 1
                sleep_duration = min((2**retries), 300) + random.uniform(0, 1)
                await asyncio.sleep(sleep_duration)
                logging.error(e)

    async def setupAPICalls(self):
        while self.authorization_token is None:
            await asyncio.sleep(1)

        logging.info("Setting up timed predictions at every 5-minute mark")

        while not shutdown.is_set():
            try:
                sleep_duration = 300 - (time() % 300)
                await asyncio.sleep(sleep_duration + 0.5)

                self.last_prediction_fired_at = datetime.datetime.now(datetime.timezone.utc)

                async with asyncio.TaskGroup() as group:
                    for asset in self.assets:
                        match asset:
                            case "BTC":
                                for version in ["v1", "v2"]:
                                    for timeframe in range(1, 25):
                                        group.create_task(
                                            self.requestFGCPrediction(
                                                asset, version, timeframe
                                            )
                                        )

                            case "ETH" | "SOL" | "XRP":
                                for timeframe in range(1, 25):
                                    group.create_task(
                                        self.requestFGCPrediction(
                                            asset, "v1", timeframe
                                        )
                                    )

                            case _:
                                for timeframe in [1, 6, 12, 24]:
                                    group.create_task(
                                        self.requestFGCPrediction(
                                            asset, "v1", timeframe
                                        )
                                    )
            except Exception as e:
                logging.error(e)

    async def setupSocketListener(self):
        while self.authorization_token is None:
            await asyncio.sleep(1)

        retries = 0

        logging.info("Setting up socket listener")

        sio = async_client.AsyncClient()

        @sio.event
        async def connect():
            self.socket_connected = True
            logging.info("Successfully connected to socket")

        @sio.event
        async def message(message: Message):
            data = message.get("data", {})

            if message.get("is_error"):
                logging.error(message.get("error"))
                return

            if (
                not len(data.get("predictedData"))
                or len(data.get("predictedData")) == 0
            ):
                logging.error("Predicted data is an empty array")
                return

            (
                token,
                prediction_made_time,
                current_price,
                prediction_timeframe,
                target_price,
                model_version,
            ) = (
                data.get("currency", None),
                data.get("currenttime", None),
                data.get("currPrice", None),
                data.get("hours"),
                data.get("predictedData")[-1] if data.get("predictedData") else None,
                message.get("version", None),
            )

            prediction_made_time = datetime.datetime.fromtimestamp(prediction_made_time)
            prediction_time = prediction_made_time + datetime.timedelta(
                hours=prediction_timeframe
            )

            if database.postgres is None:
                logging.error("Database not initialized")
                return

            conn = database.postgres.getconn()
            if conn is None:
                logging.error("Failed to get database connection")
                return

            cursor = conn.cursor()

            try:
                cursor.execute(
                    "INSERT INTO trade_analytics (token, prediction_made_time, current_price, prediction_timeframe, prediction_time, target_price, model_version) VALUES (%s, date_bin('5 minutes', %s, TIMESTAMP '2000-01-01'), %s, %s, date_bin('5 minutes', %s, TIMESTAMP '2000-01-01'), %s, %s)",
                    (
                        token,
                        prediction_made_time,
                        current_price,
                        f"{prediction_timeframe} hours",
                        prediction_time,
                        target_price,
                        model_version,
                    ),
                )
                conn.commit()
            except Exception as e:
                logging.error(f"Failed to insert prediction into database: {e}")
            finally:
                cursor.close()
                database.postgres.putconn(conn)

        @sio.event
        async def disconnect():
            self.socket_connected = False
            logging.info("Disconnected from socket")

        @sio.event
        async def error(error):
            logging.error(error)

        while not shutdown.is_set():
            try:
                headers = {"token": self.authorization_token}

                await sio.connect(self.baseUrl, headers, transports=["websocket"])

                retries = 0  # reset backoff on successful connect
                await sio.wait()
            except Exception as e:
                await sio.disconnect()
                retries += 1
                # Max 30s backoff (was 300s) so reconnect is fast after API restarts
                sleep_duration = min((2**retries), 30) + random.uniform(0, 1)
                await asyncio.sleep(sleep_duration)
                logging.error(e)

    async def requestFGCPrediction(self, asset: str, version: str, timeframe: int):
        # Removed per-request logging — was generating 400 log lines per cycle, causing disk + CPU spike
        try:
            if self._http_client is None or self._http_client.is_closed:
                self._http_client = httpx.AsyncClient(timeout=30.0)
            await self._http_client.get(
                f"{self.baseUrl}/api/{version}/price",
                params={"command": "price", "payload": f"{asset} {timeframe}"},
                headers={"Authorization": f"Bearer {self.authorization_token}"},
            )
        except Exception as e:
            logging.error(f"FGC prediction request failed asset={asset} v={version} tf={timeframe}: {e}")

    def _runEvaluatePredictions(self):
        """Blocking DB work — called via asyncio.to_thread so it doesn't
        freeze the event loop and block setupAPICalls from firing."""
        if database.postgres is None:
            logging.error("Database not initialized")
            return

        conn = database.postgres.getconn()
        if conn is None:
            logging.error("Failed to get database connection")
            return

        cursor = conn.cursor()
        try:
            # Single bulk UPDATE — replaces 891k individual queries per cycle.
            # Joins trade_analytics against price_data to find the closing price
            # at prediction_time, then sets actual_price + prediction_result in one pass.
            # Processes max 5000 rows per cycle to keep each run bounded.
            cursor.execute(
                """
                WITH eligible AS (
                    SELECT ta.id, ta.token, ta.target_price, ta.current_price,
                           ta.prediction_made_time, ta.prediction_time
                    FROM trade_analytics ta
                    WHERE ta.token IN ('BTC', 'ETH', 'SOL')
                      AND ta.prediction_time BETWEEN NOW() - INTERVAL '2 weeks' AND NOW()
                      AND ta.actual_price IS NULL
                      AND ta.prediction_result = 'None'
                    LIMIT 10000
                ),
                with_price AS (
                    SELECT
                        e.id,
                        e.target_price,
                        e.current_price,
                        MAX(pd.high_price)                                   AS period_high,
                        MIN(pd.low_price)                                    AS period_low,
                        (ARRAY_AGG(pd.close_price ORDER BY pd.timestamp DESC))[1] AS last_close
                    FROM eligible e
                    JOIN price_data pd
                      ON pd.instrument = e.token || '-USD'
                     AND pd.timestamp BETWEEN e.prediction_made_time AND e.prediction_time
                    GROUP BY e.id, e.target_price, e.current_price
                )
                UPDATE trade_analytics ta
                SET
                    actual_price      = wp.last_close,
                    prediction_result = CASE
                        WHEN wp.target_price > wp.current_price AND wp.period_high >= wp.target_price THEN 'hit'
                        WHEN wp.target_price < wp.current_price AND wp.period_low  <= wp.target_price THEN 'hit'
                        ELSE 'miss'
                    END
                FROM with_price wp
                WHERE ta.id = wp.id
                RETURNING ta.id
                """
            )
            updated = cursor.rowcount
            conn.commit()
            if updated > 0:
                logging.warning(f"Evaluated {updated} predictions (bulk update)")
        except Exception as e:
            logging.error(f"_runEvaluatePredictions bulk update failed: {e}")
            try:
                conn.rollback()
            except Exception:
                pass
        finally:
            if conn is not None:
                cursor.close()
                database.postgres.putconn(conn)

    async def setupEvaluatePredictions(self):
        try:
            while not shutdown.is_set():
                sleep_duration = 300 - (time() % 300)
                await asyncio.sleep(sleep_duration)
                await asyncio.to_thread(self._runEvaluatePredictions)
        except Exception as e:
            logging.error(e)

    def _seedLastPredictionFromDB(self):
        """On startup, seed last_prediction_fired_at from DB so a restart
        doesn't immediately fail the health check."""
        if database.postgres is None:
            return
        try:
            conn = database.postgres.getconn()
            cur = conn.cursor()
            cur.execute(
                "SELECT prediction_made_time FROM trade_analytics "
                "ORDER BY prediction_made_time DESC LIMIT 1"
            )
            row = cur.fetchone()
            if row and row[0]:
                ts = row[0]
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=datetime.timezone.utc)
                self.last_prediction_fired_at = ts
            cur.close()
            database.postgres.putconn(conn)
        except Exception as e:
            logging.error(f"Could not seed last_prediction_fired_at: {e}")

    async def entry(self):
        await asyncio.to_thread(self._seedLastPredictionFromDB)
        try:
            async with asyncio.TaskGroup() as group:
                group.create_task(self.setupAuthenticationToken())
                group.create_task(self.setupEvaluatePredictions())
                group.create_task(self.setupSocketListener())
                group.create_task(self.setupAPICalls())
        except asyncio.CancelledError as e:
            logging.error(f"Exiting predictions: {e}")
        except Exception as e:
            logging.error(e)

    def start(self):
        asyncio.run(self.entry())


assets = [
    "BTC",
    "ETH",
    "SOL",
    "XRP",
    "AAVE",
    "ACT",
    "ADA",
    "ALGO",
    "APT",
    "ARB",
    "ARKM",
    "ATOM",
    "AVAX",
    "AXGT",
    "AXS",
    "BCH",
    "BNB",
    "BONK",
    "CBETH",
    "CRO",
    "DAI",
    "DOGE",
    "DOT",
    "ENS",
    "ETC",
    "FET",
    "FIL",
    "FLOKI",
    "FOXY",
    "FLR",
    "GOAT",
    "GRT",
    "HBAR",
    "ICP",
    "IMX",
    "INJ",
    "JASMY",
    "JTO",
    "KAS",
    "LAKE",
    "LDO",
    "LINK",
    "LTC",
    "MATIC",
    "MKR",
    "NEAR",
    "OMNINET",
    "ONDO",
    "OP",
    "PEPE",
    "RNDR",
    "RONIN",
    "SAFE",
    "SEI",
    "SHIB",
    "STRK",
    "STX",
    "SUI",
    "TIA",
    "TAO",
    "TON",
    "UNI",
    "USDC",
    "USDT",
    "VET",
    "WBTC",
    "XLM",
    "ZETA",
    "ZRO",
]

predictions = Predictions(assets)
