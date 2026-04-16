SWAGGER_DOCS = {
    "swagger": "2.0",
    "info": {
        "title": "Eagle AI Labs Trading Service API",
        "version": "1.0.0",
        "description": "Swagger documentation for trading endpoints served by the Python service. Support limited to Apex currently",
    },
    "schemes": ["https", "http"],
    "basePath": "/",
    "produces": ["application/json"],
    "consumes": ["application/json"],
    "securityDefinitions": {
        "BearerAuth": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "Supply a valid bearer token in the format: Bearer <token>",
        }
    },
    "paths": {
        "/p/v1/trades/apex/new/": {
            "post": {
                "tags": ["Apex Trades"],
                "summary": "Create a new Apex order",
                "security": [{"BearerAuth": []}],
                "parameters": [
                    {
                        "in": "body",
                        "name": "body",
                        "required": True,
                        "schema": {"$ref": "#/definitions/OrderRequest"},
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Order placed successfully",
                        "schema": {"$ref": "#/definitions/StandardResponse"},
                    },
                    "400": {
                        "description": "Order failed to place",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/{id}": {
            "delete": {
                "tags": ["Apex Trades"],
                "summary": "Delete an Apex order by id",
                "security": [{"BearerAuth": []}],
                "parameters": [
                    {
                        "in": "path",
                        "name": "id",
                        "type": "string",
                        "required": True,
                        "description": "Order identifier assigned by Apex",
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Order deleted successfully",
                        "schema": {"$ref": "#/definitions/StandardResponse"},
                    },
                    "400": {
                        "description": "Deletion failed",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/": {
            "get": {
                "tags": ["Apex Trades"],
                "summary": "Fetch historical orders",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Historical orders retrieved",
                        "schema": {"$ref": "#/definitions/DataResponse"},
                    },
                    "400": {
                        "description": "Failed to retrieve orders",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/open/": {
            "get": {
                "tags": ["Apex Trades"],
                "summary": "Fetch open positions/orders",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Open positions retrieved",
                        "schema": {"$ref": "#/definitions/DataResponse"},
                    },
                    "400": {
                        "description": "Failed to retrieve open positions",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/fills/": {
            "get": {
                "tags": ["Apex Trades"],
                "summary": "Fetch filled orders",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Filled orders retrieved",
                        "schema": {"$ref": "#/definitions/DataResponse"},
                    },
                    "500": {
                        "description": "Server error retrieving fills",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/historical-pnl": {
            "get": {
                "tags": ["Apex Trades"],
                "summary": "Fetch historical profit and loss",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Historical P&L retrieved",
                        "schema": {"$ref": "#/definitions/DataResponse"},
                    },
                    "400": {
                        "description": "Failed to retrieve P&L",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/account": {
            "get": {
                "tags": ["Apex Account"],
                "summary": "Fetch account details",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Account details retrieved",
                        "schema": {"$ref": "#/definitions/StandardResponse"},
                    },
                    "400": {
                        "description": "Failed to retrieve account",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/account-balance": {
            "get": {
                "tags": ["Apex Account"],
                "summary": "Fetch account balance",
                "security": [{"BearerAuth": []}],
                "responses": {
                    "200": {
                        "description": "Account balance retrieved",
                        "schema": {"$ref": "#/definitions/StandardResponse"},
                    },
                    "400": {
                        "description": "Failed to retrieve balance",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/set-initial-margin": {
            "post": {
                "tags": ["Apex Account"],
                "summary": "Set initial margin rate",
                "security": [{"BearerAuth": []}],
                "parameters": [
                    {
                        "in": "body",
                        "name": "body",
                        "required": True,
                        "schema": {"$ref": "#/definitions/MarginRequest"},
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Initial margin updated",
                        "schema": {"$ref": "#/definitions/StandardResponse"},
                    },
                    "400": {
                        "description": "Failed to update initial margin",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
        "/p/v1/trades/apex/symbols": {
            "get": {
                "tags": ["Apex Reference"],
                "summary": "Fetch tradable symbols",
                "responses": {
                    "200": {
                        "description": "Symbols retrieved",
                        "schema": {"$ref": "#/definitions/StandardResponse"},
                    },
                    "400": {
                        "description": "Failed to retrieve symbols",
                        "schema": {"$ref": "#/definitions/ErrorResponse"},
                    },
                },
            }
        },
    },
    "definitions": {
        "OrderRequest": {
            "type": "object",
            "required": ["symbol", "side", "size", "type"],
            "properties": {
                "symbol": {
                    "type": "string",
                    "example": "BTC-USDT",
                    "description": "Perpetual contract symbol.",
                },
                "side": {
                    "type": "string",
                    "enum": ["BUY", "SELL"],
                    "description": "Trade direction.",
                },
                "size": {
                    "type": "number",
                    "minimum": 0,
                    "description": "Quantity in contract units.",
                },
                "type": {
                    "type": "string",
                    "enum": ["MARKET", "LIMIT", "TAKE_PROFIT_MARKET", "STOP_LIMIT"],
                    "description": "Order type.",
                },
                "isPositionTpsl": {
                    "type": "boolean",
                    "description": "Set take-profit/stop-loss on the position.",
                },
                "reduceOnly": {
                    "type": "boolean",
                    "description": "Reduce an existing position only.",
                },
                "orderPrice": {
                    "type": "number",
                    "description": "Limit price when type is LIMIT.",
                },
                "triggerPrice": {
                    "type": "number",
                    "description": "Trigger price for STOP_LIMIT orders.",
                },
                "triggerPriceType": {
                    "type": "string",
                    "enum": ["INDEX", "LAST", "MARK"],
                    "description": "Trigger price reference.",
                },
                "tpPrice": {
                    "type": "number",
                    "description": "Take profit price for TPSL strategies.",
                },
                "slPrice": {
                    "type": "number",
                    "description": "Stop loss price for TPSL strategies.",
                },
            },
        },
        "MarginRequest": {
            "type": "object",
            "required": ["symbol", "rate"],
            "properties": {
                "symbol": {
                    "type": "string",
                    "example": "BTC-USDT",
                    "description": "Contract symbol.",
                },
                "rate": {
                    "type": "string",
                    "example": "0.1",
                    "description": "Initial margin rate (1 / leverage).",
                },
            },
        },
        "StandardResponse": {
            "type": "object",
            "properties": {
                "status": {"type": "boolean"},
                "message": {"type": "string"},
                "data": {"type": "object"},
            },
        },
        "DataResponse": {
            "type": "object",
            "properties": {
                "status": {"type": "boolean"},
                "data": {"type": "object"},
            },
        },
        "ErrorResponse": {
            "type": "object",
            "properties": {
                "status": {"type": "boolean", "example": False},
                "message": {"type": "string"},
                "error": {"type": "string"},
            },
        },
    },
}


def all_rules(_):
    return True


SWAGGER_CONFIG = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec_1",
            "route": "/p/swagger/docs.json",
            "rule_filter": all_rules,
            "model_filter": all_rules,
        }
    ],
    "static_url_path": "/p/swagger/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/p/swagger/index.html",
}
