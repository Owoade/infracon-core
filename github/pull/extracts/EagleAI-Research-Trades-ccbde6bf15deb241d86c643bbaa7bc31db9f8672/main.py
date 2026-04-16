import atexit
import sys
import threading

from runners.predictions import predictions

sys.dont_write_bytecode = True

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import find_dotenv, load_dotenv
from flasgger import Swagger
from flask import Flask
from flask_cors import CORS

from docs import SWAGGER_CONFIG, SWAGGER_DOCS
from modules.apex import apex_bp
from modules.binance import binance_bp
from modules.health import health_bp, register_predictions
from modules.main import main_bp
from modules.market import market_bp
from runners.autotrade import breakoutbot, copytrade, signal_broadcaster
from runners.syncpnl import sync_users_pnl
from runners.tweets import fetch_tweets

load_dotenv(find_dotenv())


app = Flask(__name__)
CORS(app)

app.register_blueprint(apex_bp)
app.register_blueprint(binance_bp)
app.register_blueprint(market_bp)
app.register_blueprint(health_bp)
app.register_blueprint(main_bp)

register_predictions(predictions)

app.config["SWAGGER"] = {
    "title": "Eagle AI Labs Trading Service API",
    "uiversion": 3,
    "openapi": "2.0",
}
swagger = Swagger(app, template=SWAGGER_DOCS, config=SWAGGER_CONFIG)

shutdown_event = threading.Event()

scheduler = BackgroundScheduler()
scheduler.add_job(func=fetch_tweets, trigger="interval", minutes=5)
scheduler.add_job(func=sync_users_pnl, trigger="interval", minutes=60)
scheduler.start()

threads = []

threads.append(
    threading.Thread(target=breakoutbot.start, args=(shutdown_event,), daemon=True),
)
threads.append(
    threading.Thread(target=copytrade.start, args=(shutdown_event,), daemon=True),
)
threads.append(
    threading.Thread(
        target=signal_broadcaster.start, args=(shutdown_event,), daemon=True
    ),
)
# threads.append(
#     threading.Thread(target=predictions.start, daemon=True),
# )

for t in threads:
    t.start()


def cleanup():
    shutdown_event.set()
    for t in threads:
        t.join(timeout=2)
    scheduler.shutdown()


atexit.register(cleanup)

if __name__ == "__main__":
    try:
        app.run(port=4001, use_reloader=False)
    except KeyboardInterrupt:
        pass
