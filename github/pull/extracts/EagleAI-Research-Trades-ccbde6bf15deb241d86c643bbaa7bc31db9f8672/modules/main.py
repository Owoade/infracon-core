import logging 
from flask import Blueprint, jsonify, request
from utils.validation import OrderRequest, MarginRequest, TpslRequest
from binance_common.configuration import ConfigurationRestAPI
from binance_common.constants import DERIVATIVES_TRADING_USDS_FUTURES_REST_API_PROD_URL
from binance_sdk_derivatives_trading_usds_futures.derivatives_trading_usds_futures import DerivativesTradingUsdsFutures
from binance_sdk_derivatives_trading_usds_futures.rest_api.models import NewOrderSideEnum, NewAlgoOrderPriceMatchEnum, NewOrderTimeInForceEnum
from utils.authentication import authentication
from database import database
from modules.services import binance as binance_service
from modules.services import apex as apex_service
from utils import db

logging.basicConfig(
    filename="trades.main.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

main_bp = Blueprint("main", __name__)
@main_bp.route("/p/v1/trades/new/", methods=["POST"], strict_slashes=False)
def place_order():
    raw_json = request.json
    if not raw_json:
        return (jsonify({
            "status": False,
            "message": "Missing request body"
        }), 400)
    
    if request.authorization is None:
        return (jsonify({
            "status": False,
            "message": "Authorization header not set!"
        }), 400)
    
    token = str(request.authorization).replace("Bearer ", "")
    decoded = authentication.validate(token)

    if decoded is None:
        return (jsonify({
            "status": False,
            "message": "Credentials incorrect. Please check that you're logged in"
        }), 401)
    
    try: 
        body = OrderRequest(**raw_json)
        if database.postgres is None:
            logging.error("Unable to connect to database")
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "001"
            }), 500)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.place_order(body, user_id)
        else: 
            response = binance_service.place_order(body, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to place order. Please try again later",
                    "error": e.error_message if hasattr(e, "error_message") else str(e),
                }
            ),
            400,
        )

@main_bp.route("/p/v1/trades/open/<string:symbol>", methods=["GET"], strict_slashes=False)
def get_open_position(symbol):
    try:
        symbol = symbol.replace("-", "")
        if request.authorization is None:
            return (jsonify({
                "status": False,
                "message": "Authorization header not set!"
            }), 400)
        
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
    
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_open_orders(user_id)
        else: 
            response = binance_service.get_open_position(symbol, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
       return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)
        
@main_bp.route("/p/v1/trades/account-balance", methods=["GET"], strict_slashes=False)
def get_account_summary():
    try:
        if request.authorization is None:
            return (jsonify({
                "status": False,
                "message": "Authorization header not set!"
            }), 400)
            
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_account_balance(user_id)
        else: 
            response = binance_service.get_account_summary(user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)

@main_bp.route("/p/v1/trades/set-initial-margin", methods=["POST"], strict_slashes=False)
def set_leverage():
    try:
        raw_json = request.json
        if not raw_json:
            raise ValueError({"error_message": "Missing request body"})
        
        body = MarginRequest(**raw_json)
        symbol = body.symbol
        leverage = body.rate

        if symbol is None or leverage is None:
            raise ValueError({"error_message": "Invalid payload"})
        
        symbol = symbol.replace("-", "")
        
        if request.authorization is None:
            return (jsonify({
                "status": False,
                "message": "Authorization header not set!"
            }), 400)
            
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.set_initial_margin(body, user_id)
        else: 
            response = binance_service.set_leverage(body, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)


@main_bp.route("/p/v1/trades/symbols", methods=["GET"], strict_slashes=False)
def get_tradeable_symbols():
    try:
        if request.authorization is None:
            return (jsonify({
                "status": False,
                "message": "Authorization header not set!"
            }), 400)
            
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_symbols()
        else: 
            response = binance_service.get_tradeable_symbols(user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return response.get("data")

    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)


@main_bp.route("/p/v1/trades/<string:symbol>", methods=["POST"], strict_slashes=False)
def add_tp_sl(symbol):
    try:
        raw_json = request.json
        if not raw_json:
            raise ValueError({"error_message": "Missing request body"})

        body = TpslRequest(**raw_json)
        tpPrice = body.tpPrice
        slPrice = body.slPrice

        if tpPrice is None and slPrice is None:
            return (
                jsonify(
                    {
                        "status": False,
                        "message": "Required fields missing. Both tpPrice and slPrice cannot be empty",
                        "data": "REQUIRED-FIELDS-MISSING",
                    }
                ), 
                400
            )

        if request.authorization is None:
            return (jsonify({
                "status": False,
                "message": "Authorization header not set!"
            }), 400)
                
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.add_tp_sl(body, user_id, symbol)
        else: 
            response = binance_service.add_tp_sl(body, symbol, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (
            jsonify(
                {
                    "status": False,
                    "message": "Failed to place order. Please try again later",
                    "error": e.error_message if hasattr(e, "error_message") else str(e),
                }
            ),
            400,
        )
    
@main_bp.route("/p/v1/trades/<string:symbol>", methods=["GET"], strict_slashes=False)
def get_past_orders(symbol):
    try:
        symbol = symbol.replace("-", "")
        if request.authorization is None:
                return (jsonify({
                    "status": False,
                    "message": "Authorization header not set!"
                }), 400)
                    
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_historical_orders(user_id)
        else: 
            response = binance_service.get_past_orders(symbol, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)

    
@main_bp.route("/p/v1/trades/fills/<string:symbol>", methods=["GET"], strict_slashes=False)
def get_filled_orders(symbol):
    try:
        symbol = symbol.replace("-", "")
        if request.authorization is None:
                return (jsonify({
                    "status": False,
                    "message": "Authorization header not set!"
                }), 400)
                    
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
    
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_filled_orders(user_id)
        else: 
            response = binance_service.get_filled_orders(symbol, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)

@main_bp.route("/p/v1/trades/historical-pnl", methods=["GET"], strict_slashes=False)
def get_historical_pnl():
    try:
        if request.authorization is None:
                return (jsonify({
                    "status": False,
                    "message": "Authorization header not set!"
                }), 400)
                    
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        page = int(request.args.get("page", 1))        
        per_page = int(request.args.get("per_page", 100)) 
        
        if trading_platform == "APEX":
            response = apex_service.get_historical_pnl(user_id, page=page, per_page=per_page)
        else: 
            response = binance_service.get_historical_pnl(user_id, page=page, per_page=per_page)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform,
            "page": page,
            "per_page": per_page
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)

@main_bp.route("/p/v1/trades/account", methods=["GET"], strict_slashes=False)
def get_account_details():
    try:
        if request.authorization is None:
                return (jsonify({
                    "status": False,
                    "message": "Authorization header not set!"
                }), 400)
                    
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_account(user_id)
        else: 
            response = binance_service.get_account_details(user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)
    


@main_bp.route(
    "/p/v1/trades/<string:id>", methods=["DELETE"], strict_slashes=False
)
def cancel_order(id):
    try:
        if request.authorization is None:
            return (jsonify({
                "status": False,
                "message": "Authorization header not set!"
            }), 400)
        
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)
        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.delete_order(id, user_id)
        else: 
            response = binance_service.cancel_open_order(id, user_id)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)
    
@main_bp.route(
    "/p/v1/trades/tp-sl/<string:symbol>/", methods=["GET"], strict_slashes=False
)
def get_tpsl(symbol):
    try:
        token = str(request.authorization).replace("Bearer ", "")
        decoded = authentication.validate(token)

        if decoded is None:
            return (jsonify({
                "status": False,
                "message": "Credentials incorrect. Please check that you're logged in"
            }), 401)
        
        user_id = decoded.get("user_id")
        trading_platform = db.get_user_preferred_trading_platform(user_id)
        if trading_platform is None:
            return( jsonify({
                "status": False,
                "message": "Something went wrong",
                "error_code": "002"
            }), 500)
        
        if trading_platform == "APEX":
            response = apex_service.get_tp_sl(user_id, symbol)
        else:
            response = binance_service.get_tpsl(user_id, symbol)

        if response.get("error") is not None:
            raise response.get("error")
        
        response.get("data")["metadata"] = {
            "trading_platform": trading_platform
        }

        return jsonify(response.get("data"))
    
    except Exception as e:
        return (jsonify(
            {
                "status": False,
                "message": e.error_message if hasattr(e, "error_message") else str(e)
            }
        ), 400)



    

        