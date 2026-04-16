import logging
import os

import requests
from flask import Blueprint, jsonify, request
from flask_cors import CORS

market_bp = Blueprint("market", __name__)
CORS(market_bp)

EODHD_API_KEY = os.environ.get("EODHD_API_KEY", "")
EODHD_BASE = "https://eodhd.com/api"


@market_bp.route(
    "/p/v1/market/eod/<string:ticker>", methods=["GET"], strict_slashes=False
)
def market_eod(ticker):
    """Proxy EODHD end-of-day historical price data to avoid browser CORS restrictions."""
    if not EODHD_API_KEY:
        return jsonify({"status": False, "message": "EODHD_API_KEY not configured on server"}), 500
    try:
        period = request.args.get("period", "d")
        from_date = request.args.get("from", "")
        to_date = request.args.get("to", "")
        params = {
            "api_token": EODHD_API_KEY,
            "period": period,
            "fmt": "json",
        }
        if from_date:
            params["from"] = from_date
        if to_date:
            params["to"] = to_date
        r = requests.get(f"{EODHD_BASE}/eod/{ticker}", params=params, timeout=10)
        r.raise_for_status()
        return jsonify({"status": True, "data": r.json()})
    except Exception as e:
        logging.error(f"EODHD EOD proxy error ({ticker}): {str(e)}")
        return jsonify({"status": False, "message": "Failed to fetch market data", "error": str(e)}), 400


@market_bp.route(
    "/p/v1/market/realtime/<string:ticker>", methods=["GET"], strict_slashes=False
)
def market_realtime(ticker):
    """Proxy EODHD real-time price data to avoid browser CORS restrictions."""
    if not EODHD_API_KEY:
        return jsonify({"status": False, "message": "EODHD_API_KEY not configured on server"}), 500
    try:
        r = requests.get(
            f"{EODHD_BASE}/real-time/{ticker}",
            params={"api_token": EODHD_API_KEY, "fmt": "json"},
            timeout=10,
        )
        r.raise_for_status()
        return jsonify({"status": True, "data": r.json()})
    except Exception as e:
        logging.error(f"EODHD real-time proxy error ({ticker}): {str(e)}")
        return jsonify({"status": False, "message": "Failed to fetch real-time data", "error": str(e)}), 400
