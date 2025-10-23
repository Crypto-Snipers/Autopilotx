## 1. read trade collection 
## 2. Document Insert type and Type key in the inserted document
    # 2.1 if "Type"== "Entry", then take entry here
    # 2.2 if "Type"== "Exit", then 
    # 2.3 if "Type"== "StopLoss", then send stoploss order to the broker
    # 2.4 if "Type"== "TP", then 

# 3. Document Update type and Type key in the updated document
    # 3.1 if "Type"== "Cancelled", cancel the open stoploss order from the broker

import os
import pymongo
import logging
import time
import traceback
from datetime import datetime
from delta_client import DeltaRestClient
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection settings
MONGO_URL = "mongodb+srv://vipinpal7060:gEfl55JVEWDCZum1@cluster0.fg30pmw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# MongoDB connection settings with increased timeouts
MONGO_CONNECT_PARAMS = {
    "serverSelectionTimeoutMS": 120000,  # 2 minutes
    "connectTimeoutMS": 120000,         # 2 minutes
    "socketTimeoutMS": 120000,          # 2 minutes
    "maxIdleTimeMS": 300000,           # 5 minutes
    "connect": False,                   # Connect lazily when needed
    "readPreference": "primaryPreferred"  # Read from primary, but allow secondary if primary unavailable
}

# Symbol to product ID mapping
# This is a simple mapping for common symbols
# In a production environment, this should be fetched from the exchange API
symbol_to_product_id = {
    "BTCUSDT": 27,  
    "ETHUSDT": 3136,  
}

# Function to get product ID from symbol
def get_product_id_from_symbol(symbol, client):
    """
    Get the product ID for a given symbol.
    
    Args:
        symbol (str): The trading symbol (e.g., 'BTCUSDT')
        client (DeltaRestClient): The Delta Exchange client
        
    Returns:
        int: The product ID for the symbol, or None if not found
    """
    try:
        # First check our local mapping
        if symbol in symbol_to_product_id:
            return symbol_to_product_id[symbol]
            
        # If not in our mapping, try to fetch from the API
        try:
            # Try to get the product by symbol from the API
            product = client.get_product_by_symbol(symbol)
            if product and "id" in product:
                # Cache the result for future use
                symbol_to_product_id[symbol] = product["id"]
                return product["id"]
        except Exception as e:
            logger.error(f"Error fetching product ID from API: {str(e)}")
            
        # If we couldn't get it from the API, try a different approach
        # This is a fallback mechanism - in production, you should implement
        # proper product ID lookup
        
        # For now, we'll use a simple mapping based on common symbols
        # This is just a placeholder and should be replaced with proper API calls
        if symbol.startswith("BTC"):
            return 27  # Example BTC product ID
        elif symbol.startswith("ETH"):
            return 3136  # Example ETH product ID
            
        # If we couldn't determine the product ID, log an error and return None
        logger.error(f"Could not determine product ID for symbol {symbol}")
        return None
        
    except Exception as e:
        logger.error(f"Error in get_product_id_from_symbol: {str(e)}")
        logger.error(traceback.format_exc())
        return None

# MongoDB connection function with retry logic
def get_mongo_connection(max_retries=3, retry_delay=5):
    """
    Establish MongoDB connection with retry logic
    
    Args:
        max_retries (int): Maximum number of connection attempts
        retry_delay (int): Delay between retries in seconds
        
    Returns:
        tuple: (client, db, collections_dict) or (None, None, None) if connection fails
    """
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Attempting MongoDB connection (Attempt {attempt}/{max_retries})")
            
            # Create client
            mongo_client = pymongo.MongoClient(MONGO_URL, **MONGO_CONNECT_PARAMS)
            
            # Test connection with a ping (with timeout)
            mongo_client.admin.command('ping', socketTimeoutMS=10000)
            
            # Get database and collections
            mongo_db = mongo_client["CryptoSniper"]
            collections = {
                "trades": mongo_db["trades"],
                "users": mongo_db["users"],
                "clientTrades": mongo_db["clientTrades"]
            }
            
            logger.info("Successfully connected to MongoDB")
            return mongo_client, mongo_db, collections
            
        except (pymongo.errors.ConnectionFailure, 
                pymongo.errors.ServerSelectionTimeoutError, 
                pymongo.errors.NetworkTimeout) as e:
            logger.error(f"MongoDB connection error (Attempt {attempt}/{max_retries}): {str(e)}")
            if attempt < max_retries:
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error("All connection attempts failed")
                return None, None, None
        except Exception as e:
            logger.error(f"Unexpected error connecting to MongoDB: {str(e)}")
            return None, None, None

# Initialize MongoDB connection
try:
    client, db, collections = get_mongo_connection(max_retries=3, retry_delay=5)
    if client is None:
        logger.error("Failed to establish initial MongoDB connection")
        trade_collection, user_collection = None, None
    else:
        trade_collection = collections["trades"]
        user_collection = collections["users"]
        clientTradesCollection = collections["clientTrades"]
        logger.info("MongoDB collections initialized successfully")
except Exception as e:
    logger.error(f"Error during initial MongoDB setup: {str(e)}")
    client, db, trade_collection, user_collection = None, None, None, None


def get_broker_client(user):
    broker_name = user["broker_name"]
    if broker_name == "Delta_Exchange" and "broker_connection" in user:
        # Access API credentials from the broker_connection field
        api_key = user["broker_connection"]["api_key"]
        api_secret = user["broker_connection"]["api_secret"]
        base_url = "https://api.india.delta.exchange"  # Default to India production
        
        logger.info(f"Creating Delta Exchange client with API key: {api_key[:5]}...")
        return DeltaRestClient(base_url, api_key, api_secret)
    else:
        logger.error(f"Missing broker connection data for user: {user['email'] if 'email' in user else 'unknown'}")
        return None




def process_trade(trade):
    if trade["Type"] == "Entry":
        take_entry(trade)
    elif trade["Type"] == "Exit1" or trade["Type"] == "Exit2":
        take_exit(trade)
    elif trade["Type"] == "StopLoss":
        send_stoploss_order(trade)
    else:
        logger.error(f"Unknown trade type: {trade['Type']}")
        return None


def take_entry(trade):
    global clientTradesCollection
    logger.info(f"Taking entry for trade: {trade}")
    
    # Validate trade data
    required_fields = ["Strategy", "Symbol", "Side", "Price", "Qty"]
    for field in required_fields:
        if field not in trade:
            logger.error(f"Missing required field '{field}' in trade data")
            return
    
    STRATEGY = trade["Strategy"]
    SYMBOL = trade["Symbol"]
    SIDE = trade["Side"]
    PRICE = trade["Price"]
    QTY = trade["Qty"]
    
    # Fetch user who has deployed this strategy
    try:
        # Check if we have a valid MongoDB connection
        if user_collection is None:
            logger.error("No valid MongoDB connection for user lookup")
            return
            
        user = user_collection.find_one({"status":"Approved", "api_verified": True, f"strategies.{STRATEGY}.status": "active"})
        
        if not user:
            logger.error(f"No approved user found with active {STRATEGY} strategy")
            return
            
        logger.info(f"User found: {user.get('email', 'unknown')}")
        
        # Get broker client
        broker_client = get_broker_client(user)
        
        if not broker_client:
            logger.error("Failed to create broker client")
            return
        
        # Place entry order using DeltaRestClient
        try:
            logger.info(f"Placing {SIDE} order for {SYMBOL} at {PRICE} with quantity {QTY}")
            
            # Get product ID from symbol
            try:
                # In a real implementation, you would look up the product_id from the symbol
                # For now, we'll use a mapping or fetch it from the API
                # This is a placeholder - you should implement proper product ID lookup
                product_id = get_product_id_from_symbol(SYMBOL, broker_client)
                
                if not product_id:
                    logger.error(f"Could not find product ID for symbol {SYMBOL}")
                    return
                    
                logger.info(f"Found product ID {product_id} for symbol {SYMBOL}")
                
                # Prepare order parameters according to DeltaRestClient format
                order = {
                    "product_id": product_id,
                    "size": int(float(QTY)),  # Size must be an integer
                    "side": SIDE.lower(),  # delta expects lowercase side
                    "order_type": "market_order",  # Using market order for immediate execution
                    "client_order_id": f"crypto_en_{trade['ID']}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
                }
                
                # Add limit price if available
                if PRICE and SIDE.lower() != "market":
                    order["limit_price"] = str(PRICE)  # Price must be a string
            except Exception as e:
                logger.error(f"Error preparing order parameters: {str(e)}")
                return
            
            # Execute order with retry logic
            max_retries = 1
            retry_delay = 2
            
            for attempt in range(1, max_retries + 1):
                try:
                    # Call the Delta Exchange API to place the order
                    response = broker_client.create_order(order)
                    
                    # Log success and order details
                    logger.info(response)
                    
                    clientTrades = {
                        "user_email": user["email"],
                        "strategy": trade["Strategy"],
                        "user_id": user.get("user_id", user.get("_id")),
                        "order_id": response["id"],
                        "symbol": trade["Symbol"],
                        "side": trade["Side"],
                        "price": response["average_fill_price"],
                        "qty": response["size"],
                        "order_time": trade["OrderTime"],
                        "order_type": response["order_type"],
                        "status": response["state"],
                        "update_time": response["updated_at"],
                        "type": trade["Type"],
                        "trade_id": trade["ID"]
                    }
                    
                    # Debug: Check if clientTradesCollection is accessible
                    logger.info(f"clientTradesCollection status: {clientTradesCollection is not None}")
                    
                    if clientTradesCollection is not None:
                        try:
                            result = clientTradesCollection.insert_one(clientTrades)
                            logger.info(f"Successfully inserted trade data into clientTrades collection. Inserted ID: {result.inserted_id}, Order ID: {response['id']}")
                        except Exception as insert_error:
                            logger.error(f"Failed to insert into clientTrades collection: {str(insert_error)}")
                    else:
                        logger.error("clientTradesCollection is None - cannot insert trade data")
                    

                    return response
                    
                except Exception as api_error:
                    logger.error(f"API error on attempt {attempt}/{max_retries}: {str(api_error)}")
                    if attempt < max_retries:
                        logger.info(f"Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff

                    else:
                        logger.error(f"Failed to place order after {max_retries} attempts")
                        # Update trade status to failed
                        if trade_collection is not None:
                            trade_collection.update_one(
                                {"ID": trade["ID"]},
                                {"$set": {
                                    "OrderStatus": "Failed",
                                    "FailureReason": str(api_error),
                                    "FailureTime": datetime.now()
                                }}
                            )
                        raise
        
        except Exception as e:
            logger.error(f"Failed to place entry order: {str(e)}")
            logger.error(traceback.format_exc())
            
        
    except pymongo.errors.PyMongoError as mongo_error:
        logger.error(f"MongoDB error during user lookup: {str(mongo_error)}")
        logger.error(traceback.format_exc())
        

    except Exception as e:
        logger.error(f"Unexpected error in take_entry: {str(e)}")
        logger.error(traceback.format_exc())



def take_exit(trade):
    logger.info(f"Taking exit for trade: {trade}")
    # Validate trade data
    required_fields = ["Strategy", "Symbol", "Side", "Price", "Qty", "ID"]
    for field in required_fields:
        if field not in trade:
            logger.error(f"Missing required field '{field}' in trade data")
            return
    

    STRATEGY = trade["Strategy"]
    SYMBOL = trade["Symbol"]
    # For exit, we need to reverse the side
    SIDE = "Sell" if trade["Side"] == "Buy" else "Buy"
    PRICE = trade["Price"]
    QTY = trade["Qty"]
    
    
    # Fetch user who has deployed this strategy
    try:
        # Check if we have a valid MongoDB connection
        if user_collection is None:
            logger.error("No valid MongoDB connection for user lookup")
            return
            
        users = list(user_collection.find({"status":"Approved", "api_verified": True, f"strategies.{STRATEGY}.status": "active"}))
        
        if not users:
            logger.error(f"No approved user found with active {STRATEGY} strategy")
            return
            
        logger.info(f"User found: {len(users)}")
        
        for user in users:
            
            # Get broker client
            broker_client = get_broker_client(user)
            
            if not broker_client:
                logger.error("Failed to create broker client")
                return
            
            # Place exit order using DeltaRestClient
            try:
                SYMBOL = trade["Symbol"]

                logger.info(f"Placing {SIDE} order for {SYMBOL} at {PRICE} with quantity {QTY}")
                
                # Get product ID from symbol
                product_id = get_product_id_from_symbol(SYMBOL, broker_client)
                
                if not product_id:
                    logger.error(f"Could not find product ID for symbol {SYMBOL}")
                    return
                    
                logger.info(f"Found product ID {product_id} for symbol {SYMBOL}")
                
                # Prepare order parameters according to DeltaRestClient format
                order_params = {
                    "product_id": product_id,
                    "size": int(float(QTY)),  # Size must be an integer
                    "side": SIDE.lower(),  # delta expects lowercase side
                    "order_type": "market_order",  # Using market order for immediate execution
                    "time_in_force": "GTC",  # Good 'til canceled
                    "client_order_id": f"crypto_ex_{trade['ID']}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                }
                
                # Add limit price if available
                if PRICE and SIDE.lower() != "market":
                    order_params["limit_price"] = str(PRICE)  # Price must be a string
                    
                # Execute order with retry logic
                max_retries = 3
                retry_delay = 2
                
                for attempt in range(1, max_retries + 1):
                    try:
                        # Call the Delta Exchange API to place the order
                        response = broker_client.create_order(order_params)
                        
                        # Log success and order details
                        logger.info(f"Exit order placed successfully: {response}")
                        
                        # Update clientTrades in MongoDB if needed
                        if clientTradesCollection is not None:
                            if trade["Type"] == "Exit1":
                                clientTradesCollection.update_one(
                                    {"trade_id": trade["ID"], "user_email": user.get("user_email", user.get("email"))},
                                    {"$set": {
                                        "exit1_order_status": "Closed",
                                        "exit1_time": datetime.now(),
                                        "exit1_order_id": response.get("id", "unknown")
                                    }},
                                    upsert=True
                                )
                            else:
                                clientTradesCollection.update_one(
                                    {"trade_id": trade["ID"], "user_email": user.get("user_email", user.get("email"))},
                                    {"$set": {
                                        "exit2_order_status": "Closed",
                                        "exit2_time": datetime.now(),
                                        "exit2_order_id": response.get("id", "unknown")
                                    }},
                                    upsert=True
                                )
                        
                        return response
                        
                    except Exception as api_error:
                        logger.error(f"API error on attempt {attempt}/{max_retries}: {str(api_error)}")
                        if attempt < max_retries:
                            logger.info(f"Retrying in {retry_delay} seconds...")
                            time.sleep(retry_delay)
                            retry_delay *= 2  # Exponential backoff
                        else:
                            logger.error(f"Failed to place exit order after {max_retries} attempts")

                            # Update clientTrades status to failed
                            if clientTradesCollection is not None:
                                clientTradesCollection.update_one(
                                    {"trade_id": trade["ID"], "user_email": user.get("user_email", user.get("email"))},
                                    {"$set": {
                                        "ExitOrderStatus": "Failed",
                                        "ExitFailureReason": str(api_error),
                                        "ExitFailureTime": datetime.now()
                                    }}
                                )
                            raise
            
            except Exception as e:
                logger.error(f"Failed to place exit order: {str(e)}")
                logger.error(traceback.format_exc())
                
    except pymongo.errors.PyMongoError as mongo_error:
        logger.error(f"MongoDB error during user lookup: {str(mongo_error)}")
        logger.error(traceback.format_exc())
        
    except Exception as e:
        logger.error(f"Unexpected error in take_exit: {str(e)}")
        logger.error(traceback.format_exc())



def send_stoploss_order(trade):
    logger.info(f"Sending stoploss order for trade: {trade}")
    
    # Validate trade data
    required_fields = ["Strategy", "Symbol", "Side", "Qty", "ID"]
    for field in required_fields:
        if field not in trade:
            logger.error(f"Missing required field '{field}' in trade data")
            return
    
    # Check for stop loss price - it could be in "StopLoss" or "Price" field
    if "StopLoss" not in trade and "Price" not in trade:
        logger.error(f"Missing required field 'StopLoss' or 'Price' in trade data")
        return
    
    STRATEGY = trade["Strategy"]
    SYMBOL = trade["Symbol"]
    SIDE = trade["Side"]
    # Get stop loss price from either "StopLoss" or "Price" field
    STOP_PRICE = trade.get("Price", trade.get("StopLoss"))
    QTY = trade["Qty"]
    
    # Fetch user who has deployed this strategy
    try:
        # Check if we have a valid MongoDB connection
        if user_collection is None:
            logger.error("No valid MongoDB connection for user lookup")
            return
            
        user = user_collection.find_one({"status":"Approved", "api_verified": True, f"strategies.{STRATEGY}.status": "active"})
        
        if not user:
            logger.error(f"No approved user found with active {STRATEGY} strategy")
            return
            
        logger.info(f"User found: {user.get('email', 'unknown')}")
        
        # Get broker client
        broker_client = get_broker_client(user)
        
        if not broker_client:
            logger.error("Failed to create broker client")
            return
        
        # Place stop loss order using DeltaRestClient
        try:
            logger.info(f"Placing stop loss {SIDE} order for {SYMBOL} at {STOP_PRICE} with quantity {QTY}")
            
            # Get product ID from symbol
            product_id = get_product_id_from_symbol(SYMBOL, broker_client)
            
            if not product_id:
                logger.error(f"Could not find product ID for symbol {SYMBOL}")
                return
                
            logger.info(f"Found product ID {product_id} for symbol {SYMBOL}")
            
            # Get current market price to validate stop loss price
            try:
                ticker = broker_client.get_ticker(product_id)
                current_price = float(ticker.get('mark_price', ticker.get('close', 0)))
                logger.info(f"Current market price for {SYMBOL}: {current_price}")
                logger.info(f"Stop loss price: {STOP_PRICE}, Side: {SIDE}")
                
                # Validate stop loss price logic
                if SIDE.lower() == "buy" and STOP_PRICE <= current_price:
                    logger.error(f"Invalid Buy stop loss: price {STOP_PRICE} must be ABOVE current price {current_price}")
                    logger.error(f"For a Sell position, Buy stop loss should be above current market price to limit losses")
                    return
                elif SIDE.lower() == "sell" and STOP_PRICE >= current_price:
                    logger.error(f"Invalid Sell stop loss: price {STOP_PRICE} must be BELOW current price {current_price}")
                    logger.error(f"For a Buy position, Sell stop loss should be below current market price to limit losses")
                    return
                    
            except Exception as price_error:
                logger.warning(f"Could not get current market price: {str(price_error)}")
            
            # Prepare order parameters for stop loss according to DeltaRestClient format
            # Use stop market order for Delta Exchange
            order_params = {
                "product_id": product_id,
                "size": int(float(QTY)),  # Size must be an integer
                "side": SIDE.lower(),  # delta expects lowercase side
                "order_type": "market_order",  # Use market order that triggers at stop price
                "stop_price": str(STOP_PRICE),  # Trigger price must be a string
                "stop_order_type": "stop_loss_order",  # Specify this is a stop loss
                "client_order_id": f"crypto_sl_{trade['ID']}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            }
            
            # Execute order with retry logic
            max_retries = 3
            retry_delay = 2
            
            for attempt in range(1, max_retries + 1):
                try:
                    # Call the Delta Exchange API to place the order
                    response = broker_client.create_order(order_params)
                    
                    # Log success and order details
                    logger.info(f"Stop loss order placed successfully: {response}")
                    
                    # Update clientTrades status in MongoDB if needed
                    if clientTradesCollection is not None:
                        clientTradesCollection.update_one(
                            {"trade_id": trade["ID"],"user_email": user["email"]},
                            {"$set": {
                                "StopLossOrderStatus": "Active",
                                "StopLossOrderTime": datetime.now(),
                                "StopLossOrderId": response.get("id", "unknown")
                            }}
                        )
                    
                    return response
                    
                except Exception as api_error:
                    logger.error(f"API error on attempt {attempt}/{max_retries}: {str(api_error)}")
                    if attempt < max_retries:
                        logger.info(f"Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        logger.error(f"Failed to place stop loss order after {max_retries} attempts")
                        # Update trade status to failed
                        if clientTradesCollection is not None:
                            clientTradesCollection.update_one(
                                {"trade_id": trade["ID"],"user_email": user["email"]},
                                {"$set": {
                                    "StopLossOrderStatus": "Failed",
                                    "StopLossFailureReason": str(api_error),
                                    "StopLossFailureTime": datetime.now()
                                }}
                            )
                        raise
        
        except Exception as e:
            logger.error(f"Failed to place stop loss order: {str(e)}")
            logger.error(traceback.format_exc())
            
    except pymongo.errors.PyMongoError as mongo_error:
        logger.error(f"MongoDB error during user lookup: {str(mongo_error)}")
        logger.error(traceback.format_exc())
        
    except Exception as e:
        logger.error(f"Unexpected error in send_stoploss_order: {str(e)}")
        logger.error(traceback.format_exc())



def cancel_order(trade):
    logger.info(f"Canceling order for trade: {trade}")
    
    # Validate trade data
    required_fields = ["Strategy", "ID"]
    for field in required_fields:
        if field not in trade:
            logger.error(f"Missing required field '{field}' in trade data")
            return
    
    STRATEGY = trade["Strategy"]
    
    # Fetch user who has deployed this strategy
    try:
        # Check if we have a valid MongoDB connection
        if user_collection is None:
            logger.error("No valid MongoDB connection for user lookup")
            return
            
        users = list(user_collection.find(
            {"status":"Approved", 
            "api_verified": True, 
            f"strategies.{STRATEGY}.status": "active"}))
        
        if not users:
            logger.error(f"No approved user found with active {STRATEGY} strategy")
            return
        logger.info(f"User found: {len(users)}")

        for user in users:
            try:
                # Get broker client
                broker_client = get_broker_client(user)
                
                if not broker_client:
                    logger.error("Failed to create broker client")
                    continue  # Continue with next user if broker client creation fails
                
                user_record = clientTradesCollection.find_one(
                    {"trade_id": trade["ID"], "user_email": user["email"], "StopLossOrderStatus": "Active"}
                )

                if not user_record:
                    logger.error(f"No client trades found for trade {trade['ID']} and user {user['email']}")
                    continue  # Continue with next user if no matching trade found

                order_id = user_record.get("StopLossOrderId")

                # Cancel order using DeltaRestClient
                try:
                    logger.info(f"Canceling order {order_id}")
                    
                    # Get product ID from symbol
                    SYMBOL = trade["Symbol"]
                    product_id = get_product_id_from_symbol(SYMBOL, broker_client)
                    
                    if not product_id:
                        logger.error(f"Could not find product ID for symbol {SYMBOL}")
                        continue  # Continue with next user if product ID not found
                        
                    logger.info(f"Found product ID {product_id} for symbol {SYMBOL}")
                    
                    # Execute cancel with retry logic
                    max_retries = 3
                    retry_delay = 2
                
                    for attempt in range(1, max_retries + 1):
                        try:
                            # Call the Delta Exchange API to cancel the order
                            # DeltaRestClient.cancel_order expects product_id and order_id
                            response = broker_client.cancel_order(product_id, order_id)
                        
                            # Log success and order details
                            logger.info(f"Order canceled successfully: {response}")
                            
                            # Update client trade status in MongoDB if needed
                            if clientTradesCollection is not None:
                                clientTradesCollection.update_one(
                                    {"trade_id": trade["ID"], "user_email": user["email"]},
                                    {"$set": {
                                        "StopLossOrderStatus": "Cancelled",
                                        "CancelTime": datetime.now()
                                    }}
                                )
                            
                            return response
                        
                        except Exception as api_error:
                            logger.error(f"API error on attempt {attempt}/{max_retries}: {str(api_error)}")
                            if attempt < max_retries:
                                logger.info(f"Retrying in {retry_delay} seconds...")
                                time.sleep(retry_delay)
                                retry_delay *= 2  # Exponential backoff
                            else:
                                logger.error(f"Failed to cancel order after {max_retries} attempts")
                                # Update client trade status to failed
                                if clientTradesCollection is not None:
                                    clientTradesCollection.update_one(
                                        {"trade_id": trade["ID"], "user_email": user["email"]},
                                        {"$set": {
                                            "CancelStatus": "Failed",
                                            "CancelFailureReason": str(api_error),
                                            "CancelFailureTime": datetime.now()
                                        }}
                                    )
                                raise
                
                except pymongo.errors.PyMongoError as mongo_error:
                    logger.error(f"MongoDB error during order cancellation: {str(mongo_error)}")
                    logger.error(traceback.format_exc())
                    continue  # Continue with next user on MongoDB error

                except Exception as e:
                    logger.error(f"Unexpected error in cancel_order: {str(e)}")
                    logger.error(traceback.format_exc())
                    continue  # Continue with next user on unexpected error
                    
            except Exception as user_loop_error:
                logger.error(f"Error processing user {user.get('email', 'unknown')}: {str(user_loop_error)}")
                logger.error(traceback.format_exc())
                continue  # Continue with next user if there's an error in the user loop
                
    except Exception as e:
        logger.error(f"Unexpected error in cancel_order: {str(e)}")
        logger.error(traceback.format_exc())



def watch_trade_collection():
    global client, db, trade_collection, user_collection
    
    logger.info("Starting trade collection watch")
    
    # Initial backoff parameters
    max_backoff = 60  # Maximum backoff in seconds
    initial_backoff = 1  # Initial backoff in seconds
    backoff = initial_backoff
    
    while True:
        try:
            # Check if we have a valid MongoDB connection
            if trade_collection is None:
                logger.warning("No valid MongoDB connection, attempting to reconnect...")
                client, db, collections = get_mongo_connection(max_retries=3, retry_delay=5)
                
                if client is None:
                    logger.error("Failed to reconnect to MongoDB, will retry")
                    time.sleep(backoff)
                    backoff = min(backoff * 2, max_backoff)  # Exponential backoff
                    continue
                else:
                    trade_collection = collections["trades"]
                    user_collection = collections["users"]
                    logger.info("Successfully reconnected to MongoDB")
                    backoff = initial_backoff  # Reset backoff after successful connection
            
            # Start watching the trade collection
            logger.info("Starting change stream on trade collection")
            with trade_collection.watch(full_document="updateLookup") as change_stream:
                # Reset backoff after successful watch setup
                backoff = initial_backoff
                
                for change in change_stream:
                    try:
                        if change["operationType"] == "insert":
                            trade = change["fullDocument"]
                            logger.info(f"New trade detected: {trade['ID'] if 'ID' in trade else 'unknown'}")
                            process_trade(trade)
                        
                        elif change["operationType"] == "update":
                            # For updates, we need the full document
                            if "fullDocument" in change:
                                trade = change["fullDocument"]
                                
                                # Check if the Type field was updated to Cancelled
                                if "updateDescription" in change and "updatedFields" in change["updateDescription"]:
                                    updated_fields = change["updateDescription"]["updatedFields"]
                                    if "Status" in updated_fields and updated_fields["Status"] == "Cancelled":
                                        logger.info(f"Cancellation detected for trade: {trade['ID'] if 'ID' in trade else 'unknown'}")
                                        cancel_order(trade)
                            else:
                                logger.warning(f"Update detected but fullDocument not available: {change}")
                    
                    except Exception as process_error:
                        logger.error(f"Error processing change: {str(process_error)}")
                        logger.error(traceback.format_exc())
                        # Continue processing other changes even if one fails
                        continue
        
        except pymongo.errors.PyMongoError as mongo_error:
            logger.error(f"MongoDB error in change stream: {str(mongo_error)}")
            logger.error(traceback.format_exc())
            
            # For MongoDB errors, we should reconnect
            try:
                if client:
                    client.close()
            except:
                pass
            
            client = None
            db = None
            trade_collection = None
            user_collection = None
            
            time.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)  # Exponential backoff
            
        except Exception as e:
            logger.error(f"Unexpected error in trade collection watch: {str(e)}")
            logger.error(traceback.format_exc())
            time.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)  # Exponential backoff


# Start the trade collection watch
if __name__ == "__main__":
    watch_trade_collection()

