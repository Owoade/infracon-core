import datetime
import os

from flask import Blueprint, jsonify

from database import database

health_bp = Blueprint("health", __name__)

_REQUIRED_ENV_VARS = [
    "TRADEANALYTICS_DB_HOST",
    "TRADEANALYTICS_DB_NAME",
    "TRADEANALYTICS_DB_USER",
    "TRADEANALYTICS_DB_PASS",
    "REDIS_HOST",
    "REDIS_PASSWORD",
    "JWT_SECRET",
    "ENCRYPTION_KEY",
    "OPENAI_API_KEY",
    "MONGO_URI",
    "X_API_KEY",
    "USER_EMAIL",
    "USER_PASSWORD",
]

# Populated by main.py after predictions object is created
_predictions_ref = None


def register_predictions(predictions_instance):
    global _predictions_ref
    _predictions_ref = predictions_instance


def _check_postgres():
    if database.postgres is None:
        return {"ok": False, "detail": "Connection pool not initialised"}
    try:
        conn = database.postgres.getconn()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        database.postgres.putconn(conn)
        return {"ok": True, "detail": "Connected"}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


def _check_redis():
    if database.redis is None:
        return {"ok": False, "detail": "Redis client not initialised"}
    try:
        database.redis.ping()
        return {"ok": True, "detail": "Connected"}
    except Exception as e:
        return {"ok": False, "detail": str(e)}


def _check_predictions():
    if _predictions_ref is None:
        return {"ok": False, "detail": "Predictions object not registered"}

    auth_ok = _predictions_ref.authorization_token is not None
    socket_ok = _predictions_ref.socket_connected
    last_fired = _predictions_ref.last_prediction_fired_at

    if last_fired is None:
        freshness_ok = False
        age_seconds = None
        detail = "No predictions fired since startup"
    else:
        now = datetime.datetime.now(datetime.timezone.utc)
        age_seconds = int((now - last_fired).total_seconds())
        # Predictions fire every 5 min — flag if nothing in 7 min
        freshness_ok = age_seconds < 420
        detail = f"Last fired {age_seconds}s ago"

    return {
        "ok": freshness_ok and auth_ok and socket_ok,
        "auth_token_set": auth_ok,
        "socket_connected": socket_ok,
        "last_fired_at": last_fired.isoformat() if last_fired else None,
        "age_seconds": age_seconds,
        "detail": detail,
    }


def _check_env_vars():
    missing = [v for v in _REQUIRED_ENV_VARS if not os.getenv(v)]
    return {
        "ok": len(missing) == 0,
        "missing": missing,
        "detail": "All required env vars present" if not missing else f"Missing: {', '.join(missing)}",
    }


@health_bp.route("/health", methods=["GET"])
def health():
    postgres = _check_postgres()
    redis = _check_redis()
    predictions = _check_predictions()
    env = _check_env_vars()

    overall_ok = all([
        postgres["ok"],
        redis["ok"],
        predictions["ok"],
        env["ok"],
    ])

    status_code = 200 if overall_ok else 503

    return jsonify({
        "status": "ok" if overall_ok else "degraded",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "checks": {
            "postgres": postgres,
            "redis": redis,
            "predictions": predictions,
            "env_vars": env,
        },
    }), status_code
