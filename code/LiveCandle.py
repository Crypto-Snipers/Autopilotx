from CoinDcxClient import CoinDcxWebSocketClient
import pymongo
from pymongo import MongoClient
from pymongo.server_api import ServerApi
import time
import json
from datetime import datetime, timezone
import pytz
import logging
import os
import sys
import random
from logging.handlers import RotatingFileHandler
from typing import Dict, Any, Union
from dotenv import load_dotenv

# Silence verbose loggers
# logging.getLogger('engineio.client').setLevel(logging.WARNING)
# logging.getLogger('socketio.client').setLevel(logging.WARNING)

load_dotenv()

MONGO_LINK = os.getenv("MONGO_URL")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Configure logging - minimal configuration as we'll set it up properly in setup_logging()
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def setup_database() -> tuple[MongoClient, Dict[str, pymongo.collection.Collection]]:
    """
    Set up MongoDB connection and ensure required collections and indexes exist.
    
    Returns:
        tuple: (MongoClient instance, dict of collections)
    """
    
    # Connection string with retryWrites and other options
    mongo_uri = MONGO_LINK
    
    # MongoDB client configuration
    client_options = {
        'host': mongo_uri,
        'retryWrites': True,
        'w': 'majority',
        'appname': 'CoinDCX_Data_Collector',
        'serverSelectionTimeoutMS': 10000,  # 10 seconds
        'connectTimeoutMS': 10000,
        'socketTimeoutMS': 30000,
        'maxPoolSize': 100,
        'minPoolSize': 10,
        'maxIdleTimeMS': 30000,
        'server_api': ServerApi('1')
    }
    
    logger.info("Attempting to connect to MongoDB")
    # Create a new client and connect to the server
    client = MongoClient(**client_options)
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
    
    # Get or create the database and collections
    db = client[MONGO_DB_NAME]
    
    # Create collections for each symbol
    candleData_collection = db['candleData']
    ticks_collections = db['ticks']
    
    return client, candleData_collection, ticks_collections


def process_candle_data(candle: Dict[str, Any], candleData_collection: pymongo.collection.Collection, ticks_collections: pymongo.collection.Collection, symbol: str) -> None:
    """
    Process and store a single candlestick data point in MongoDB.
    
    Args:
        candle: Dictionary containing candlestick data
        candleData_collection: MongoDB collection for candlestick data
        ticks_collections: MongoDB collection for tick data
        symbol: Trading pair symbol (e.g., 'BTCUSDT')
    """
    print("candle", candle)
    max_retries = 3
    retry_delay = 1  # seconds
    document = None
    formatted_time = None
    
    try:
        # Log the raw candle data for debugging
        logger.debug(f"Processing raw candle data for {symbol}: {candle}")
        
        # Validate required fields
        required_fields = ['open', 'high', 'low', 'close', 'open_time', 'volume']
        missing_fields = [field for field in required_fields if field not in candle]
        if missing_fields:
            logger.error(f"Missing required fields {missing_fields} in candle data: {candle}")
            return
        
        # Convert and validate timestamp
        try:
            # Handle different timestamp formats (seconds or milliseconds)
            open_time = candle['open_time']
            if open_time > 1e12:  # Likely in milliseconds
                timestamp = int(open_time)
            else:  # Likely in seconds
                timestamp = int(float(open_time) * 1000)
                
            if timestamp <= 0:
                logger.error(f"Invalid timestamp in candle data: {open_time}")
                return
                
        except (ValueError, TypeError) as e:
            logger.error(f"Error processing timestamp {candle.get('open_time')}: {e}")
            return
            
        # Convert and validate numeric fields
        try:
            numeric_fields = {}
            for field in ['open', 'high', 'low', 'close']:
                value = candle.get(field)
                if value is None:
                    logger.error(f"Missing required numeric field: {field}")
                    return
                try:
                    numeric_fields[field] = float(value)
                except (ValueError, TypeError) as e:
                    logger.error(f"Error converting {field} value '{value}': {e}")
                    return
            
            # Handle optional fields with defaults
            numeric_fields['volume'] = float(candle.get('volume', 0))
            
            # Validate price data
            if any(price < 0 for price in numeric_fields.values()):
                logger.error(f"Negative values in price data: {numeric_fields}")
                return
                
            # Create datetime objects
            utc_dt = datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc)
            ist = pytz.timezone('Asia/Kolkata')
            ind_time = utc_dt.astimezone(ist)
            formatted_time = ind_time.strftime('%Y-%m-%d %H:%M:%S')
            
            # Prepare document for MongoDB
            document = {
                'timestamp': timestamp,
                'open': numeric_fields['open'],
                'high': numeric_fields['high'],
                'low': numeric_fields['low'],
                'close': numeric_fields['close'],
                'volume': numeric_fields['volume'],
                'date': utc_dt,
                'updated_at': datetime.utcnow(),
            }
            
        except Exception as e:
            logger.error(f"Error preparing document: {e}\nCandle: {candle}", exc_info=True)
            return
        
        # MongoDB operation with retry logic
        for attempt in range(max_retries):
            try:
                if not document:
                    logger.error("No document prepared for MongoDB")
                    return
                    
                # Create a copy of the document without _id to prevent duplicate key errors
                doc_for_upsert = document.copy()
                
                # Create a filter for the update operation
                filter_doc = {
                    'timestamp': document['timestamp'],
                    'symbol': symbol
                }
                
                # Try to update existing document or insert new one
                result = candleData_collection.update_one(
                    filter_doc,
                    {'$set': doc_for_upsert},
                    upsert=True
                )

                # Update the tick collection for this symbol with the latest candle data
                try:
                    tick_data = {
                        '_id': symbol,  # Use symbol as _id for unique document per symbol
                        'symbol': symbol,
                        'close': document['close'],
                        'high': document['high'],
                        'low': document['low'],
                        'open': document['open'],
                        'volume': document['volume'],
                        'timestamp': document['timestamp'],
                        'date': document['date'],
                        'updated_at': datetime.utcnow()
                    }
                    
                    # Log the tick data being inserted/updated
                    logger.debug(f"Updating tick data for {symbol}: {tick_data}")
                    
                    # Update or insert the latest tick data
                    # Use update_one with upsert to handle both insert and update cases
                    result = ticks_collections.update_one(
                        {'_id': symbol},  # Match by _id instead of symbol
                        {'$set': tick_data},
                        upsert=True
                    )
                    
                    logger.debug(f"Updated tick data for {symbol}: matched={result.matched_count}, modified={result.modified_count}")
                    
                except Exception as e:
                    logger.error(f"Error updating tick data for {symbol}: {e}", exc_info=True)
                
                return
                
            except pymongo.errors.DuplicateKeyError as dke:
                logger.warning(
                    f"Duplicate key error for {symbol} at {formatted_time}. "
                    f"This usually means the same candle was processed multiple times. Error: {dke}"
                )
                return 
                
            except (pymongo.errors.AutoReconnect,
                   pymongo.errors.NetworkTimeout,
                   pymongo.errors.ServerSelectionTimeoutError) as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(
                        f"MongoDB connection issue (attempt {attempt + 1}/{max_retries}). "
                        f"Retrying in {wait_time} seconds... Error: {e}"
                    )
                    time.sleep(wait_time)
                else:
                    logger.error(
                        f"Max retries reached. Could not update {symbol} document. "
                        f"Last error: {e}",
                        exc_info=True
                    )
                    return
                    
            except Exception as e:
                logger.error(
                    f"Unexpected error processing {symbol} candle data: {e}\n"
                    f"Document: {document}",
                    exc_info=True
                )
                return
                
    except Exception as e:
        logger.error(
            f"Critical error in process_candle_data for {symbol}: {e}\n"
            f"Candle data: {candle}",
            exc_info=True
        )


def on_candlestick(data: Union[str, Dict[str, Any]],
                   candleData_collection: pymongo.collection.Collection,
                   ticks_collections: pymongo.collection.Collection) -> None:
    """
    Handle incoming candlestick data from WebSocket.

    Args:
        data: Raw data from WebSocket (can be string or dict)
        client: MongoDB client instance
        candleData_collection: MongoDB collection for candlestick data
        ticks_collections: MongoDB collection for tick data
    """
    try:
        # Only log raw data in debug mode and only if explicitly enabled
        if logger.isEnabledFor(logging.DEBUG) and os.environ.get('VERBOSE_LOGGING') == '1':
            raw_data_str = str(data)[:200]  # Reduced from 500 to 200 chars
            logger.debug(f"Received candlestick data: {raw_data_str}...")

        # Parse the data if it's a string
        if isinstance(data, str):
            try:
                data = json.loads(data)
                logger.debug(f"Parsed candlestick data from string: {data}")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON data: {e}")
                logger.debug(f"Raw data that failed to parse: {data}")
                return

        # Ensure data is a dictionary
        if not isinstance(data, dict):
            logger.error(f"Unexpected data type: {type(data)}. Expected dict or JSON string.")
            return
            
        # Extract the candle data array
        candle_data = None
        if 'data' in data and data['data'] is not None:
            candle_data = data['data']
            # If data is a string, try to parse it as JSON
            if isinstance(candle_data, str):
                try:
                    candle_data = json.loads(candle_data)
                except json.JSONDecodeError:
                    candle_data = None
        
        if not candle_data:
            logger.warning(f"No candle data found in message: {data}")
            return
            
        # Handle case where candle_data is a list
        if isinstance(candle_data, list):
            # If the list has a 'data' key, use that instead
            if len(candle_data) == 1 and isinstance(candle_data[0], dict) and 'data' in candle_data[0]:
                candles = candle_data[0]['data']
                if not isinstance(candles, list):
                    candles = [candles]
            else:
                candles = candle_data
        elif isinstance(candle_data, dict):
            if 'data' in candle_data:
                candles = candle_data['data'] if isinstance(candle_data['data'], list) else [candle_data['data']]
            else:
                candles = [candle_data]
        else:
            logger.warning(f"Unexpected candle data format: {candle_data}")
            return
            
        # Only log candle count if we have more than 1 candle to process
        if len(candles) > 1:
            logger.info(f"Processing {len(candles)} candles")

        for candle in candles:
            try:
                if not isinstance(candle, dict):
                    logger.warning(f"Skipping invalid candle data (not a dict): {candle}")
                    continue
                    
                # Extract symbol from the candle data
                symbol = None
                
                # Try to get symbol from various possible fields
                for field in ['symbol', 's', 'ticker']:
                    if field in candle and candle[field]:
                        symbol = str(candle[field]).upper()
                        break
                        
                # If symbol not found, try to extract from pair
                if not symbol and 'pair' in candle and candle['pair']:
                    pair = str(candle['pair'])
                    # Remove 'B-' or 'F-' prefix if present
                    if pair.startswith(('B-', 'F-')):
                        pair = pair[2:]
                    # Replace '_' with '' and convert to uppercase
                    symbol = pair.replace('_', '').upper()
                
                # If still no symbol, check the channel name
                if not symbol and 'channel' in data and data['channel']:
                    channel = str(data['channel']).upper()
                    if 'BTC_USDT' in channel or 'BTCUSDT' in channel:
                        symbol = 'BTCUSDT'
                    elif 'ETH_USDT' in channel or 'ETHUSDT' in channel:
                        symbol = 'ETHUSDT'
                    elif 'SOL_USDT' in channel or 'SOLUSDT' in channel:
                        symbol = 'SOLUSDT'
                
                if not symbol:
                    logger.warning(f"Could not determine symbol from candle: {candle}")
                    continue
                
                # Clean up the symbol (remove any non-alphanumeric characters except '/')
                symbol = ''.join(c for c in symbol if c.isalnum() or c == '/')
                
                # Pass all tick collections to process_candle_data
                process_candle_data(candle, candleData_collection, ticks_collections, symbol)
                
            except Exception as e:
                logger.error(f"Error processing candle: {e}\nCandle: {candle}", exc_info=True)
            
    except Exception as e:
        logger.error(f"Error in on_candlestick: {e}\nData: {data}", exc_info=True)


def setup_logging() -> logging.Logger:
    """Configure logging with file rotation and console output."""
    # Silence verbose third-party loggers
    logging.getLogger('engineio').setLevel(logging.ERROR)
    logging.getLogger('socketio').setLevel(logging.ERROR)
    logging.getLogger('engineio.client').setLevel(logging.ERROR)
    logging.getLogger('socketio.client').setLevel(logging.ERROR)
    
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Create a custom logger
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    
    # Prevent adding multiple handlers if function is called multiple times
    if logger.hasHandlers():
        return logger
    
    # Create formatters with minimal format
    log_format = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'  # Shorter timestamp format
    )
    
    # Console handler - minimal output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(log_format)
    
    # File handler with rotation (5MB per file, keep 2 backups)
    log_file = os.path.join(log_dir, 'coindcx_data.log')
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,  # 5MB (reduced from 10MB)
        backupCount=2,  # Reduced from 3 to 2
        encoding='utf-8'
    )

    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(log_format)
    
    # Add handlers to the logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    # Log uncaught exceptions
    def handle_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        logger.critical("Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))
    
    sys.excepthook = handle_exception
    
    logger.info("Logging initialized")
    return logger


if __name__ == "__main__":

    def main():
        # Setup logging first
        logger = setup_logging()
        
        # Initialize WebSocket client
        api_key = "e0f9e665752ccb4f38ec70ad746657359b20ae6fdae1b4af"
        secret_key = "4056f29eab20731c1023ad2339f52b1d3ffb108446b26f136c91c1f867c0316e"
        
        # Reconnection parameters
        max_reconnect_attempts = 100  # High number to keep trying for a long time
        initial_reconnect_delay = 5  # Start with 5 seconds delay
        max_reconnect_delay = 120  # Maximum delay between reconnection attempts (2 minutes)
        reconnect_attempt = 0
        connected = False
        last_disconnect_time = 0  # Track when the last disconnect happened
        
        try:
            # Setup database connections and get collections
            client, candleData_collection, ticks_collections = setup_database()
            logger.info("Successfully connected to MongoDB and initialized collections")
            
            # List of pairs to subscribe to
            pairs = ["BTC_USDT", "ETH_USDT", "SOL_USDT"]
            channels = [f"B-{pair}_1m-futures" for pair in pairs]
            logger.info(f"Will subscribe to channels: {channels}")
            
            # Create a closure to handle candlestick events with the current client
            def make_candlestick_handler(candleData_collection, ticks_collections):

                def handler(data):
                    try:
                        # Don't log the full data payload to reduce log size
                        on_candlestick(data, candleData_collection, ticks_collections)
                        # Reset reconnect attempt counter on successful data receipt
                        nonlocal reconnect_attempt
                        reconnect_attempt = 0
                    except Exception as e:
                        logger.error(f"Error in handle_candlestick: {e}")

                return handler
            
            # Function to initialize and configure WebSocket client
            def initialize_websocket():
                nonlocal connected
                # Initialize WebSocket client with minimal logging
                ws_client = CoinDcxWebSocketClient(
                    api_key=api_key,
                    secret_key=secret_key,
                    log_to_file=False,  # Disable separate log file for WebSocket client
                    log_level=logging.ERROR  # Only log errors
                )
                
                # Create the handler
                handle_candlestick = make_candlestick_handler(candleData_collection, ticks_collections)
                
                # Register the candlestick event handler - with minimal logging
                @ws_client.sio.on('candlestick')
                def on_candlestick_event(data):
                    # Don't log every candlestick event
                    handle_candlestick(data)
                
                # Function to handle connection and subscribe to channels
                @ws_client.sio.on('connect')
                def on_connect_event():
                    nonlocal connected
                    connected = True
                    logger.info("Connected to CoinDCX WebSocket")
                    # Subscribe to all channels without logging each one
                    for channel in channels:
                        ws_client.sio.emit('join', {'channelName': channel})
                    logger.info(f"Subscribed to {len(channels)} channels")
                
                # Register disconnect handler
                @ws_client.sio.on('disconnect')
                def on_disconnect():
                    nonlocal connected, last_disconnect_time
                    connected = False
                    last_disconnect_time = time.time()
                    logger.warning("Disconnected from WebSocket. Will attempt to reconnect after delay.")
                
                return ws_client
            
            # Initialize WebSocket client
            coinDCX = initialize_websocket()
            
            # Start WebSocket connection
            coinDCX.start()
            
            # Main loop with reconnection logic
            running = True
            while running:
                try:
                    # Check if connected
                    if not connected:
                        reconnect_attempt += 1
                        
                        if reconnect_attempt > max_reconnect_attempts:
                            logger.error(f"Failed to reconnect after {max_reconnect_attempts} attempts. Exiting.")
                            break
                        
                        # Calculate delay with exponential backoff (with jitter)
                        delay = min(initial_reconnect_delay * (2 ** (reconnect_attempt - 1)), max_reconnect_delay)
                        # Add some randomness to prevent thundering herd problem
                        delay = delay * (0.8 + 0.4 * random.random())
                        
                        # Ensure minimum time between reconnection attempts
                        time_since_disconnect = time.time() - last_disconnect_time
                        if time_since_disconnect < delay:
                            # Calculate remaining wait time
                            remaining_wait = delay - time_since_disconnect
                            if remaining_wait > 0:
                                # Only log reconnection attempts at certain intervals to reduce log spam
                                if reconnect_attempt == 1 or reconnect_attempt % 5 == 0 or reconnect_attempt >= max_reconnect_attempts - 5:
                                    logger.info(f"Attempting to reconnect (attempt {reconnect_attempt}/{max_reconnect_attempts}) in {remaining_wait:.2f} seconds...")
                                time.sleep(remaining_wait)
                        
                        # Clean up old connection
                        try:
                            coinDCX.stop()
                        except Exception as e:
                            # Only log detailed errors for the first few attempts
                            if reconnect_attempt <= 3:
                                logger.warning(f"Error stopping previous WebSocket client: {e}")
                            else:
                                logger.warning("Error stopping previous WebSocket client. Continuing with reconnection...")
                        
                        # Create new connection
                        if reconnect_attempt == 1 or reconnect_attempt % 5 == 0 or reconnect_attempt >= max_reconnect_attempts - 5:
                            logger.info(f"Initializing new WebSocket connection (attempt {reconnect_attempt}/{max_reconnect_attempts})...")
                        coinDCX = initialize_websocket()
                        coinDCX.start()
                    
                    # Small sleep to prevent CPU hogging
                    time.sleep(1)
                    
                except KeyboardInterrupt:
                    logger.info("\nStopping WebSocket client...")
                    running = False
                except Exception as e:
                    logger.error(f"An error occurred in main loop: {e}", exc_info=True)
                    time.sleep(1)  # Prevent tight loop in case of recurring errors
            
            # Cleanup
            try:
                if 'coinDCX' in locals():
                    try:
                        coinDCX.stop()
                        logger.info("WebSocket client stopped")
                    except Exception as e:
                        logger.error(f"Error stopping WebSocket client: {e}")
                
                if 'client' in locals() and client is not None:
                    try:
                        client.close()
                        logger.info("MongoDB connection closed")
                    except Exception as e:
                        logger.error(f"Error closing MongoDB connection: {e}")
                    
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")
            finally:
                logger.info("Application shutdown complete")

        except Exception as e:
            logger.error(f"Failed to start application: {e}")

    try:
        main()

    except Exception as e:
        logger.critical(f"Fatal error in main execution: {e}")
        raise  # Re-raise to see the full traceback in the console

