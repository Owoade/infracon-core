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
)
from utils.validation import MarginRequest, OrderRequest, TpslRequest
from modules.services import apex as apex_service

apex_service

from utils import db

logging.basicConfig(
    filename="trades.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

apex_bp = Blueprint("apex", __name__)


@apex_bp.route("/p/v1.1/trades/apex/new", methods=["POST"], strict_slashes=False)
def place_order_v1_1():
    try:
        # Request body validation
        raw_json = request.json
        if not raw_json:
            raise ValueError({"message": "Missing request body"})

        body = OrderRequest(**raw_json)

        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        print("INFO HTTP=Placing order", f"details={body}")

        response = apex_service.place_order_v1_1(
            body,
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data"),
            201
        ))

    except Exception as e:
        print("ERROR HTTP error=Failed to place order", f"details={e}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to place order. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route("/p/v1/trades/apex/new/", methods=["POST"], strict_slashes=False)
def place_order():

    try:
        raw_json = request.json
        if not raw_json:
            raise ValueError({"message": "Missing request body"})

        body = OrderRequest(**raw_json)

         # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.place_order(
            body,
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data"),
        ), 201)

    except Exception as e:
        print("ERROR HTTP error=Failed to place order", f"details={e}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to place order. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route(
    "/p/v1/trades/apex/<string:symbol>/", methods=["PUT"], strict_slashes=False
)
def add_tp_sl(symbol):
    conn = None
    try:
        raw_json = request.json
        if not raw_json:
            raise ValueError({"message": "Missing request body"})

        body = TpslRequest(**raw_json)
        
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.add_tp_sl(
            body,
            user_id,
            symbol
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ),201)

    except Exception as e:
        logging.error(f"Failed to place order. Please try again later: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to place order. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )
   

@apex_bp.route(
    "/p/v1/trades/apex/<string:id>", methods=["DELETE"], strict_slashes=False
)
def delete_order(id):
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.delete_order(
           id,
           user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to delete order. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route("/p/v1/trades/apex/", methods=["GET"], strict_slashes=False)
def get_historical_orders():
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.get_historical_orders(
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to get historical orders",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route("/p/v1/trades/apex/open/", methods=["GET"], strict_slashes=False)
def get_open_orders():
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.get_open_orders(
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to get open orders. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route("/p/v1/trades/apex/fills/", methods=["GET"], strict_slashes=False)
def get_filled_orders():
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.get_filled_orders(
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ),200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to get open orders. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route(
    "/p/v1/trades/apex/historical-pnl", methods=["GET"], strict_slashes=False
)
def get_historical_pnl():
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")
        page = int(request.args.get("page", 1))        
        per_page = int(request.args.get("per_page", 100)) 

        response = apex_service.get_historical_pnl(
            user_id,
            page=page,
            per_page=per_page
        )

        if response.get("error") != None:
            raise response.get("error")
        
        response["data"]["metadata"] = {
            "page": page,
            "per_page": per_page
        }
        
        return (jsonify(
            response.get("data")
        ),200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to get historical pnl",
                    "error": str(e),
                }
            ),
            400,
        )



@apex_bp.route("/p/v1/trades/apex/account", methods=["GET"], strict_slashes=False)
def get_account():
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.get_account(
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to get account",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route(
    "/p/v1/trades/apex/account-balance", methods=["GET"], strict_slashes=False
)
def get_account_balance():
    try:
        # Authentication
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        user_id = decoded.get("user_id")

        response = apex_service.get_account_balance(
            user_id
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
                response.get("data")
            ),
            200
        )

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to get account balance",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route(
    "/p/v1/trades/apex/set-initial-margin", methods=["POST"], strict_slashes=False
)
def set_initial_margin():
    try:
        token = str(request.authorization).replace("Bearer ", "")

        decoded = authentication.validate(token)

        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )

        user_id = decoded.get("user_id")

        raw_json = request.json
        if not raw_json:
            raise ValueError({"message": "Missing request body"})

        body = MarginRequest(**raw_json)

        response = apex_service.set_initial_margin(body, user_id)

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)

    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to set initial margin",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route("/p/v1/trades/apex/assets", methods=["GET"], strict_slashes=False)
def get_assets():
    try:
        response = apex_service.get_assets()

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)
    except Exception as e:
        logging.error(f"fetch assets error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to fetch assets. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route("/p/v1/trades/apex/symbols", methods=["GET"], strict_slashes=False)
def get_symbols():
    try:
        response = apex_service.get_symbols()

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)
    except Exception as e:
        logging.error(f"database error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to fetch symbols. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )


@apex_bp.route(
    "/p/v1/trades/apex/tp-sl/<string:symbol>/", methods=["GET"], strict_slashes=False
)
def get_tpsl(symbol):
    try:
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        
        if decoded is None:
            raise ValueError(
                {
                    "message": "Credentials incorrect. Please check that you're logged in",
                }
            )
        
        user_id = decoded.get("user_id")

        response = apex_service.get_tp_sl(
            user_id,
            symbol
        )

        if response.get("error") != None:
            raise response.get("error")
        
        return (jsonify(
            response.get("data")
        ), 200)
    
    except Exception as e:
        logging.error(f"fetch historical orders error: {str(e)}")
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to retrieve data. Please try again later",
                    "error": str(e),
                }
            ),
            400,
        )

