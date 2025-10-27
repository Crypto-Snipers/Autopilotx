import threading
import traceback
import time
import copy
import pymongo
from typing import Dict
from CoinDcxClient import CoinDcxClient, CoinDcxAPIError
import pydantic
from dotenv import load_dotenv
from datetime import datetime
import os
from Utils import file_path_locator, setup_logger
from os import path
import logging
import sys

load_dotenv()


class User(pydantic.BaseModel):
    broker: str
    credentials: Dict[str, str]


class OrderData(pydantic.BaseModel):
    Symbol: str
    Side: str
    OrderType: str
    Quantity: float
    Price: float
    Leverage: int
    TakeProfit: float = 0.0
    StopLoss: float = 0.0
    StopPrice: float = 0.0
    MarginCurrencyShortName: str
    Strategy: str
    trade_id: str


class MinQty:
    BTCUSDT = 0.0001
    ETHUSDT = 0.01
    SOLUSDT = 1


def format_email_for_db(email):
    """Format email address for use as a MongoDB field name

    Args:
        email (str): Email address to format

    Returns:
        str: Formatted email or empty string if invalid
    """
    if not email or not isinstance(email, str) or "@" not in email:
        return ""

    # Replace special characters that could cause issues in MongoDB field names
    return (email.replace("@", "_at_")).replace(".", "_", 5)


def unformat_email_from_db(formatted_email):
    if not formatted_email or "_at_" not in formatted_email:
        return formatted_email

    email = formatted_email.replace("_at_", "@")

    parts = email.split("@")
    if len(parts) == 2:
        username, domain = parts
        domain = domain.replace("_", ".")
        email = f"{username}@{domain}"

    return email


def get_broker(credentials: dict) -> CoinDcxClient:
    return CoinDcxClient(
        api_key=credentials["api_key"], secret_key=credentials["api_secret"]
    )


def get_users_credentials(strategy_name: str):
    """
    Retrieve users who have the specified strategy active.

    Args:
        strategy_name: Name of the strategy to filter users by (e.g., 'ETH_Multiplier')

    Returns:
        list: List of dictionaries containing user broker data with credentials
    """
    try:
        # Reduced logging - only log at debug level
        # Only log this at warning level if no users found, otherwise debug
        users = list(
            UserCollection.find(
                {
                    "status": "Approved",
                    "is_active": True,
                    "broker_connection": {"$exists": True, "$ne": None},
                    "strategies": {"$type": "object"},
                    f"strategies.{strategy_name}": {"$exists": True},
                    f"strategies.{strategy_name}.status": "active",
                },
                {
                    "_id": 1,  # Include _id field
                    "email": 1,
                    "strategies": 1,
                    "broker_connection": 1,
                    "currency": 1,
                    "name": 1,
                },
            )
        )

        if len(users) == 0:
            logger.warning(f"No users found with strategy: '{strategy_name}'")
        else:
            logger.warning(f"Found {len(users)} users with strategy: '{strategy_name}'")

        # Build credentials list
        credentials_list = []
        for user in users:
            email = user.get("email")
            broker_connection = user.get("broker_connection", {})

            # Extract credentials
            user_id = str(user.get("_id"))
            if not user_id:
                logger.error(f"User ID not found for user with email: {email}")
                continue

            credentials = {
                "email": email,
                "user_id": user_id,
                "name": user.get("name", ""),
                "credentials": {
                    "broker_name": broker_connection.get("broker_name", ""),
                    "broker_id": broker_connection.get("broker_id", ""),
                    "api_key": broker_connection.get("api_key", ""),
                    "api_secret": broker_connection.get("api_secret", ""),
                },
                "currency": user.get("currency", "INR"),
                "strategies": user.get("strategies", {}),
                "strategy_config": {
                    "multiplier": (
                        user.get("strategies", {})
                        .get(strategy_name, {})
                        .get("multiplier", 1)
                        if isinstance(user.get("strategies"), dict)
                        else 1
                    )
                },
                "multiplier": (
                    user.get("strategies", {})
                    .get(strategy_name, {})
                    .get("multiplier", 1)
                    if isinstance(user.get("strategies"), dict)
                    else 1
                ),
            }
            credentials_list.append(credentials)

        return credentials_list

    except Exception as e:
        logger.error(
            f"Error fetching users for strategy {strategy_name}: {str(e)}",
            exc_info=True,
        )
        return []


def order_placer(user, client: CoinDcxClient, OrderData):
    try:
        logger.info(f"=== Starting order placement for user {user} ===")
        logger.info(
            f"Order details - Symbol: {OrderData.Symbol}, Side: {OrderData.Side}, Type: {OrderData.OrderType}, Qty: {OrderData.Quantity}"
        )

        # Map order type to CoinDcx format
        order_type_mapping = {
            "MARKET": "market_order",
            "LIMIT": "limit_order",
            "STOP_MARKET": "stop_market",
            "TAKE_PROFIT_MARKET": "take_profit_market",
        }

        if OrderData.OrderType not in order_type_mapping:
            logger.error(f"Unsupported order type: {OrderData.OrderType}")
            return

        # Prepare order parameters
        order_params = {
            "pair": OrderData.Symbol,
            "side": OrderData.Side.lower(),
            "order_type": order_type_mapping.get(
                OrderData.OrderType, OrderData.OrderType.lower()
            ),
            "quantity": OrderData.Quantity,
            "leverage": getattr(OrderData, "Leverage", 10),
            "reduce_only": getattr(OrderData, "PositionType", "").upper() == "CLOSE",
            "time_in_force": (
                "good_till_cancel"
                if OrderData.OrderType == "LIMIT"
                else "immediate_or_cancel"
            ),
            "margin_currency_short_name": getattr(
                OrderData, "MarginCurrencyShortName", "USDT"
            ),
        }

        # Add price for limit orders
        if hasattr(OrderData, "Price") and OrderData.Price is not None:
            order_params["price"] = OrderData.Price

        # Add stop loss for orders
        if hasattr(OrderData, "StopLoss") and OrderData.StopLoss is not None:
            order_params["stop_loss"] = OrderData.StopLoss
        # For backward compatibility, also check StopPrice
        elif hasattr(OrderData, "StopPrice") and OrderData.StopPrice is not None:
            order_params["stop_loss"] = OrderData.StopPrice

        # Add take profit
        if hasattr(OrderData, "TakeProfit") and OrderData.TakeProfit is not None:
            order_params["take_profit"] = OrderData.TakeProfit
        # For backward compatibility, also check Target
        elif hasattr(OrderData, "Target") and OrderData.Target is not None:
            order_params["take_profit"] = OrderData.Target

        logger.info(f"Order details: {order_params} User: {user}")

        # Place the order
        order = client.create_futures_order(**order_params)

        # Handle different response formats
        # Check if response is a list (as seen in the logs)
        if isinstance(order, list) and len(order) > 0:
            order_data = order[0]
            order_id = order_data.get("id")
            if order_id:
                order_confirmation(user, client, OrderData, order_data)
                return

        # Check for the nested data.order format
        elif order and "data" in order and "order" in order["data"]:
            order_id = order["data"]["order"].get("orderId")
            if order_id:
                order_confirmation(user, client, OrderData, order_id)
                return

        # If we get here, there was an issue with the order
        logger.error(f"Failed to place order: {order}")

    except CoinDcxAPIError as e:
        logger.error(f"Error placing order: {e}")
    except Exception as e:
        logger.error(f"Unexpected error in order_placer: {e}")
        print(traceback.format_exc())


def order_confirmation(user, client: CoinDcxClient, order_data, order_response):
    try:
        time.sleep(10)
        # Handle both order ID string and order data object
        if isinstance(order_response, str):
            # If order_response is just the order ID
            order_id = order_response
            logger.info(f"Getting status for order ID: {order_id} User: {user}")
            order = client.get_futures_order_status(order_id=order_id)
        else:
            # If order_response is the full order object
            order_id = order_response.get("id")
            if not order_id:
                logger.error("No order ID found in order response")
                return False
            order = order_response  # Use the provided order data directly

        # Calculate executed quantity
        total_qty = float(order.get("total_quantity", 0))
        remaining_qty = float(order.get("remaining_quantity", 0))
        executed_qty = total_qty - remaining_qty

        # Store order details in database
        trade_data = {
            "userId": user["email"],
            "strategyId": (
                order_data.Strategy if hasattr(order_data, "Strategy") else ""
            ),
            "symbol": order_data.Symbol,
            "side": order_data.Side.lower(),
            "leverage": float(order.get("leverage", 1.0)),
            "quantity": total_qty,
            "price": float(order.get("price", 0.0)),
            "avg_price": float(order.get("avg_price", 0.0)),
            "executedQty": executed_qty,
            "status": order.get("status", "unknown").lower(),
            "orderId": order_id,
            "order_type": order.get("order_type", ""),
            "maker_fee": float(order.get("maker_fee", 0.0)),
            "taker_fee": float(order.get("taker_fee", 0.0)),
            "fee_amount": float(order.get("fee_amount", 0.0)),
            "trade_id": order_data.trade_id if hasattr(order_data, "trade_id") else "",
            "timestamp": datetime.now(),
        }

        # Insert into database
        if user:
            clientTradeCollecion.update_one(
                {"orderId": order_id, "userId": user["email"]},
                {"$set": trade_data},
                upsert=True,
            )

        # Also update the original trade document to add this user to the Users field
        # Find the trade document by Symbol, Side, and approximate time
        symbol_normalized = order_data.Symbol.replace("B-", "").replace("_", "-")

        # Find the trade in the TradeCollection
        # Use a more specific query to find the exact trade document
        # The document has fields like Symbol, Side, OrderType, and we can use the Last_Checked field
        # to find the most recently processed document
        trade_query = {
            "Symbol": symbol_normalized,
            "Side": order_data.Side.upper(),
            "OrderType": order_data.OrderType.upper(),
            "Placed": "Order_Checker",  # This indicates it was processed by the Order_Checker
        }

        # Find the most recent trade document that matches our criteria
        trade_doc = TradeCollection.find_one(trade_query, sort=[("Last_Checked", -1)])

        if not trade_doc:
            # If we can't find an exact match, try a more relaxed query
            trade_query = {"Symbol": symbol_normalized, "Side": order_data.Side.upper()}
            trade_doc = TradeCollection.find_one(
                trade_query, sort=[("Last_Checked", -1)]
            )

        if not trade_doc:
            logger.warning(
                f"Could not find matching trade document for {symbol_normalized} {order_data.Side.upper()}"
            )
            return False

        # Update the trade document to add this user to the Users field
        user_email = user.get("email") if isinstance(user, dict) else user

        if user_email and isinstance(user_email, str) and "@" in user_email:
            formatted_user = format_email_for_db(user_email)
            if formatted_user and trade_doc:
                try:
                    # Use a valid field name for MongoDB update
                    user_field = f"Users.{formatted_user}"

                    # Check if the field name is valid
                    if not formatted_user or formatted_user.isspace():
                        logger.error(
                            f"Invalid MongoDB field name generated for user: '{user_email}'"
                        )
                        return False

                    update_data = {
                        "orderId": order_id,
                        "status": order.get("status", "unknown").lower(),
                        "executedQty": executed_qty,
                        "price": float(order.get("price", 0.0)),
                        "timestamp": datetime.now(),
                    }

                    # Perform the update with valid field name
                    TradeCollection.update_one(
                        {"_id": trade_doc["_id"]}, {"$set": {user_field: update_data}}
                    )
                    logger.debug(
                        f"Updated trade document {trade_doc['_id']} with user {user_email} order information"
                    )
                except Exception as update_error:
                    logger.error(
                        f"Failed to update trade document: {str(update_error)}"
                    )
        else:
            logger.warning(
                f"Invalid user identifier '{user_email}' - cannot update trade document"
            )

        # Handle different order statuses
        status = order.get("status", "").lower()

        if status == "filled":
            logger.warning(f"Order {order_id} filled successfully")
            return True

        elif status == "partially_filled":
            logger.warning(
                f"Order {order_id} partially filled: {executed_qty}/{total_qty}"
            )
            return False

        elif status in ["canceled", "rejected", "expired"]:
            logger.warning(f"Order {order_id} {status}")
            return None

        # For new/pending orders
        return False

    except Exception as e:
        logger.error(f"Error in order_confirmation: {str(e)}", exc_info=True)
        return None


def order_checker(user, UserBroker, OrderData, order_id, retry=0, max_retry=3):
    try:
        if retry >= max_retry:
            logger.error(f"Max retry reached for order {order_id}")
            return None

        order = UserBroker.get_order_details(
            symbol=OrderData.Symbol,
            order_id=order_id,
        )

        if not order or "data" not in order:
            logger.error(f"Failed to get order details for {order_id}")
            retry += 1
            time.sleep(1)
            return order_checker(
                user, UserBroker, OrderData, order_id, retry, max_retry
            )

        status = order["data"]["status"]

        if status == "FILLED":
            logger.warning(f"Order {order_id} filled successfully")
            trade_data = {
                "userId": user["email"],
                "strategyId": OrderData.StrategyId,
                "symbol": OrderData.Symbol,
                "side": OrderData.Side,
                "positionType": OrderData.PositionType,
                "quantity": OrderData.Quantity,
                "price": order["data"]["price"],
                "executedQty": order["data"]["executedQty"],
                "status": status,
                "orderId": order_id,
                "timestamp": datetime.now(),
                "type": (
                    "entry"
                    if OrderData.Entry
                    else ("exit" if OrderData.exit else "stop_loss")
                ),
            }

            # Use update_one with upsert=True instead of insert_one
            query = {"orderId": order_id, "userId": user["email"]}
            clientTradeCollecion.update_one(query, {"$set": trade_data}, upsert=True)
            logger.debug(f"Updated/inserted trade data for order {order_id}")
            return True

        elif status in ["CANCELED", "REJECTED", "EXPIRED"]:
            logger.warning(f"Order {order_id} status: {status}")
            return None

        elif status == "PARTIALLY_FILLED":
            logger.warning(f"Order {order_id} partially filled")
            remain_qty = float(OrderData.Quantity) - float(order["data"]["executedQty"])

            trade_data = {
                "userId": user["email"],
                "strategyId": OrderData.StrategyId,
                "symbol": OrderData.Symbol,
                "side": OrderData.Side,
                "positionType": OrderData.PositionType,
                "quantity": order["data"]["executedQty"],
                "price": order["data"]["price"],
                "executedQty": order["data"]["executedQty"],
                "status": "FILLED",
                "orderId": order_id,
                "timestamp": datetime.now(),
                "type": (
                    "entry"
                    if OrderData.Entry
                    else ("exit" if OrderData.exit else "stop_loss")
                ),
            }

            # Use update_one with upsert=True instead of insert_one
            query = {"orderId": order_id, "userId": user["email"]}
            clientTradeCollecion.update_one(query, {"$set": trade_data}, upsert=True)
            logger.debug(f"Updated/inserted trade data for order {order_id}")

            # Place a market order for the remaining quantity
            new_order_data = copy.deepcopy(OrderData)
            new_order_data.Quantity = remain_qty
            new_order_data.OrderType = "MARKET"

            return order_placer(user, UserBroker, new_order_data)

        elif status in ["PENDING", "NEW"]:
            # Order still pending, check if we need to convert to market order
            # Check if order has been pending for too long (e.g., 5 seconds)
            # If so, cancel and replace with market order
            new_order_data = copy.deepcopy(OrderData)
            new_order_data.OrderType = "MARKET"

            # Cancel the existing order
            cancel_result = UserBroker.cancel_order(
                symbol=OrderData.Symbol, order_id=order_id
            )

            if cancel_result and cancel_result.get("code") == 0:
                # Place a new market order
                return order_placer(user, UserBroker, new_order_data)
            else:
                # If cancel failed, check order status again after a delay
                time.sleep(1)
                retry += 1
                return order_checker(
                    user, UserBroker, OrderData, order_id, retry, max_retry
                )

        # For any other status, retry after a delay
        time.sleep(1)
        retry += 1
        return (
            order_checker(user, UserBroker, OrderData, order_id, retry, max_retry)
            if retry < max_retry
            else None
        )

    except Exception as e:
        logger.error(f"Error in order_checker: {str(e)}\n{traceback.format_exc()}")
        retry += 1
        time.sleep(1)
        return (
            order_checker(user, UserBroker, OrderData, order_id, retry, max_retry)
            if retry < max_retry
            else None
        )


def Order_Checker(document: dict, retry=0, max_retry=3):
    try:
        if retry >= max_retry:
            logger.error(
                f"Max retry reached for Order_Checker with document {document['_id']}"
            )
            return None

        # Get all users who should be running this strategy
        STRATEGY = document.get("Strategy", "")
        user_credentials = get_users_credentials(STRATEGY)
        for user in user_credentials:
            userid = user["user_id"]
            UserBroker = get_broker(user["credentials"])

            # Check if user has any open orders for this strategy
            user_orders = clientTradeCollecion.find(
                {
                    "strategyId": document.get("Strategy", ""),
                    "symbol": document["Symbol"],
                    "status": {"$in": ["PENDING", "NEW"]},
                }
            )

            for order in user_orders:
                # Check order status and update accordingly
                order_id = order["orderId"]
                order_data = OrderData(
                    Entry=document.get("Entry", False),
                    exit=document.get("exit", False),
                    stop_loss=document.get("stop_loss", False),
                    Symbol=document["Symbol"],
                    Side=document["Side"],
                    OrderType=order["order_type"],
                    PositionType=order["positionType"],
                    Quantity=order["quantity"],
                    Price=document.get("Price", order.get("price")),
                    Strategy=STRATEGY,
                )

                order_checker(userid, UserBroker, order_data, order_id)

        # Update the document to indicate it's been checked
        TradeCollection.update_one(
            {"_id": document["_id"]}, {"$set": {"Last_Checked": datetime.now()}}
        )
        return True

    except Exception as e:
        logger.error(f"Error in Order_Checker: {str(e)}\n{traceback.format_exc()}")
        retry += 1
        time.sleep(2)
        return Order_Checker(document, retry, max_retry) if retry < max_retry else None


def order_runner(document: dict):
    try:
        logger.info("=== Starting order_runner ===")
        logger.info(f"Processing document: {document}")

        STRATEGY = document.get("Strategy", "")
        if not STRATEGY:
            logger.error("No strategy found in document")
            return None

        logger.info(f"Looking for active users with strategy: {STRATEGY}")

        # Find users with the specified active strategy
        users_cursor = UserCollection.find(
            {
                "status": "Approved",
                f"strategies.{STRATEGY}.status": "active",
                "is_active": True,
            },
            {
                "_id": 0,
                "name": 1,
                "email": 1,
                "user_id": 1,
                f"strategies.{STRATEGY}": 1,
                "currency": 1,
                "credentials": 1,
            },
        )

        # Convert cursor to list to avoid cursor timeout issues
        users = list(users_cursor)
        logger.info(f"Found {len(users)} active users for strategy {STRATEGY}")

        if not users:
            logger.warning(f"No active users found for strategy: {STRATEGY}")
            return

        # Get user credentials for the strategy
        user_credentials = get_users_credentials(STRATEGY)
        logger.info(f"Retrieved credentials for {len(user_credentials)} users")

        if not user_credentials:
            logger.error("No user credentials found for the strategy")
            return

        processed_users = 0

        for user in user_credentials:
            try:
                user_id = user.get("user_id")
                user_email = user.get("email", "unknown")

                if not user_id:
                    logger.error(
                        f"User ID not found in credentials for user {user_email}"
                    )
                    continue

                logger.info(f"Processing order for user: {user_id} ({user_email})")

                # Get currency from user dictionary, with INR as fallback
                currency = user.get("currency", "INR")

                # Get the client with credentials
                if "credentials" not in user or not user["credentials"]:
                    logger.error(
                        f"No credentials found for user {user_id} ({user_email})"
                    )
                    continue

                # Validate API credentials
                credentials = user["credentials"]
                if not all(key in credentials for key in ["api_key", "api_secret"]):
                    logger.error(
                        f"Missing API credentials for user {user_id} ({user_email})"
                    )
                    continue

                logger.info(f"Initializing client for user {user_id} ({user_email})")
                try:
                    client = get_broker(credentials)
                    # Test the connection
                    client.get_balances()  # This will raise an exception if credentials are invalid
                except Exception as e:
                    logger.error(
                        f"Failed to initialize client for user {user_id} ({user_email}): {str(e)}"
                    )
                    continue

                # Get multiplier from strategy settings
                multiplier = float(
                    user.get("strategies", {}).get(STRATEGY, {}).get("multiplier", 1.0)
                )
                logger.info(f"Using multiplier: {multiplier} for user {user_id}")

                # Log strategy configuration
                strategy_config = user.get("strategies", {}).get(STRATEGY, {})
                logger.info(f"Strategy config for {STRATEGY}: {strategy_config}")

                # Prepare order pair and price
                pair = "B-" + document["Symbol"].replace("-", "_")
                entry_price = document.get("Price")

                if entry_price is None:
                    entry_price = (
                        0 if document.get("OrderType", "").upper() == "MARKET" else 0
                    )
                    logger.info(
                        f"Using default price {entry_price} for {document.get('OrderType')} order"
                    )

                # Create order data object
                trade_id = document.get("ID")
                # Convert trade_id to string if it's not None
                trade_id_str = str(trade_id) if trade_id is not None else ""

                # Get values with defaults
                take_profit = (
                    float(document.get("Target", 0.0))
                    if document.get("Target") is not None
                    else 0.0
                )
                stop_loss = (
                    float(document.get("StopLoss", 0.0))
                    if document.get("StopLoss") is not None
                    else 0.0
                )

                order_data = OrderData(
                    Symbol=pair,
                    Side=document["Side"],
                    OrderType=document["OrderType"],
                    Quantity=round(float(document["Qty"]) * multiplier, 2),
                    Price=entry_price,
                    Leverage=document.get("Leverage", 10),
                    TakeProfit=take_profit,
                    StopLoss=stop_loss,
                    StopPrice=stop_loss,  # Using same as StopLoss as per previous logic
                    MarginCurrencyShortName=currency,
                    Strategy=STRATEGY,
                    trade_id=trade_id_str,
                )

                logger.info(
                    f"Created order data for user {user_id}: {order_data.model_dump()}"
                )

                # Start a thread to place the order
                logger.info(f"Starting order placement thread for user {user_id}")
                thread = threading.Thread(
                    target=order_placer, args=(user, client, order_data)
                )
                thread.start()
                processed_users += 1

                # Small delay to avoid hitting rate limits
                time.sleep(0.1)

            except Exception as e:
                logger.error(
                    f"Error processing order for user {user.get('user_id', 'unknown')}: {str(e)}"
                )
                logger.error(traceback.format_exc())

        logger.info(
            f"Successfully processed orders for {processed_users}/{len(user_credentials)} users"
        )

    except Exception as e:
        logger.error(f"Critical error in order_runner: {str(e)}")
        logger.error(traceback.format_exc())


if __name__ == "__main__":
    try:
        # # mongo config
        load_dotenv()
        MONGO_LINK = os.getenv("MONGO_URL")
        MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

        if not MONGO_LINK or not MONGO_DB_NAME:
            raise ValueError(
                "MongoDB connection string or database name not found in environment variables"
            )

        print(f"Connecting to MongoDB Atlas with database: {MONGO_DB_NAME}")

        # Add server selection timeout and connection timeout
        mongo_client = pymongo.MongoClient(
            MONGO_LINK,
            serverSelectionTimeoutMS=5000,  # 5 second timeout
            socketTimeoutMS=30000,  # 30 second socket timeout
            connectTimeoutMS=10000,  # 10 second connection timeout
        )

        # Test the connection
        mongo_client.server_info()  # This will raise an exception if connection fails
        print("Successfully connected to MongoDB Atlas")

        db_name = MONGO_DB_NAME
        mydb = mongo_client[db_name]

        # Verify collections exist
        required_collections = [
            "live",
            "position",
            "trades",
            "candleData",
            "ticks",
            "users",
            "clientTrades",
        ]
        existing_collections = mydb.list_collection_names()

        print("Available collections:", existing_collections)

        for coll in required_collections:
            if coll not in existing_collections:
                print(f"Warning: Collection '{coll}' not found in database")

        LiveCollection = mydb["live"]
        PositionCollection = mydb["position"]
        TradeCollection = mydb["trades"]
        candleDb = mydb["candleData"]
        ticks_collection = mydb["ticks"]
        UserCollection = mydb["users"]
        clientTradeCollecion = mydb["clientTrades"]

        # Setup logging
        current_file = str(os.path.basename(__file__)).replace(".py", "")
        folder = file_path_locator()
        logs_dir = path.join(path.normpath(folder), "logs")
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir)

        LOG_file = f"{logs_dir}/coindcx_order.log"
        print(f"Log file: {LOG_file}")

        # Set up logger with INFO level to capture all important messages
        logger = setup_logger(
            name=current_file,
            log_level=logging.INFO,
            log_to_file=True,
            log_file=LOG_file,
            capture_print=True,
            log_to_console=True,
        )

        logger.info("=== Starting Order Processor ===")
        logger.info(f"Connected to MongoDB Atlas database: {MONGO_DB_NAME}")
        logger.info(f"Watching for changes in 'trades' collection")

    except pymongo.errors.ServerSelectionTimeoutError as e:
        print(f"Error: Could not connect to MongoDB Atlas: {e}")
        print("Please check your MongoDB Atlas connection string and network settings")
        print(f"Connection string: {MONGO_LINK}")
        sys.exit(1)
    except Exception as e:
        print(f"Error initializing application: {str(e)}")
        print(traceback.format_exc())
        sys.exit(1)

    while True:
        try:
            with TradeCollection.watch(full_document="updateLookup") as stream:
                for change in stream:

                    if change["operationType"] == "insert":

                        # Log only essential information about new documents
                        logger.warning(
                            f"New trade document: {change['fullDocument'].get('Symbol')} {change['fullDocument'].get('Side')} {change['fullDocument'].get('OrderType')}"
                        )

                        order_runner(change["fullDocument"])

                        thread = threading.Thread(
                            target=Order_Checker, args=(change["fullDocument"],)
                        )
                        thread.start()
                        TradeCollection.update_one(
                            {"_id": change["fullDocument"]["_id"]},
                            {"$set": {"Placed": "Order_Checker"}},
                        )

        except Exception as _:
            print(traceback.format_exc())
            break
