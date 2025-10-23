import pymongo
import json
from CoinDcxClient import CoinDcxClient
import time
import logging
import os
import sys
import multiprocessing
from multiprocessing import Pool, cpu_count
from datetime import datetime
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Determine the absolute path for the logs directory
# Assumes SQ_OFF.py is in a 'code' directory, and 'logs' is a sibling to 'code'
current_file_path = os.path.abspath(__file__)
code_dir = os.path.dirname(current_file_path)
project_root = os.path.dirname(code_dir)  # up one level from 'code'
log_dir = os.path.join(project_root, 'logs')

# Create logs directory if it doesn't exist
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# Configure logging with rotating file handler
log_file_path = os.path.join(log_dir, 'SQ_OFF.log')

# Create a custom formatter with more detailed information
log_formatter = logging.Formatter(
    '%(asctime)s - %(processName)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
)

# Create a rotating file handler (10MB per file, keep 5 backup files)
file_handler = RotatingFileHandler(
    log_file_path, 
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.INFO)

# Create console handler
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.INFO)

# Get logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Clear any existing handlers to avoid duplicate logs
if logger.hasHandlers():
    logger.handlers.clear()

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Make sure the logger works with multiprocessing
logger = multiprocessing.get_logger()
logger.setLevel(logging.INFO)
for handler in [file_handler, console_handler]:
    if handler not in logger.handlers:
        logger.addHandler(handler)

# Log script start with a clear separator
logger.info("="*80)
logger.info("STARTING SQ_OFF SCRIPT")
logger.info("="*80)

STRATEGY_NAME = "ETH Multiplier"
symbols = ["ETH-USDT"]

# MongoDB connection
MONGO_URL = os.getenv("MONGO_URL")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")

# Log MongoDB connection attempt
logger.info(f"Connecting to MongoDB database: {MONGO_DB_NAME}")

try:
    client = pymongo.MongoClient(MONGO_URL)
    # Ping the server to confirm connection
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
    
    db = client[f"{MONGO_DB_NAME}"]
    users_collection = db["users"]
    strategies_collection = db["strategies"]
    
except Exception as e:
    logger.critical(f"Failed to connect to MongoDB: {str(e)}", exc_info=True)
    logger.critical("Exiting script due to database connection failure")
    sys.exit(1)

# Log the current time for debugging
current_time = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
logger.info(f"Current time: {current_time} UTC")

# First, let's check how many users exist in the database
total_users = users_collection.count_documents({})
logger.info(f"Total users in database: {total_users}")

# Get all active, approved users with verified API access
query = {
    "broker_connection": {"$exists": True},
    f"strategies.{STRATEGY_NAME}.status": "active",
    "is_active": True,
    "status": "Approved",
    "api_verified": True
}


# Log the query for debugging
logger.info(f"User query: {json.dumps(query, indent=2)}")

# Find all matching users
all_users = list(users_collection.find(query))

# Log the number of users found
logger.info(f"Found {len(all_users)} users matching the query")

# Log sample user details (without sensitive data)
if all_users:
    safe_user = {k: v for k, v in all_users[0].items() 
               if k not in ['api_key', 'api_secret', 'password', 'broker_connection']}
    if 'broker_connection' in all_users[0] and 'api_key' in all_users[0]['broker_connection']:
        safe_user['broker_connection'] = {
            'broker_name': all_users[0]['broker_connection'].get('broker_name'),
            'status': all_users[0]['broker_connection'].get('status')
        }
    logger.info(f"Sample user details: {json.dumps(safe_user, default=str, indent=2)}")
else:
    logger.warning("No users found matching the criteria")




def process_user_positions(user, symbol):
    """Process and close positions for a specific user and trading symbol.
    
    Args:
        user (dict): User document from MongoDB
        symbol (str): Trading symbol in format 'COIN-QUOTE' (e.g., 'ETH-USDT')
    """
    try:
        logger.info(f"Processing user: {user['email']}")
        
        # Get broker connection details
        broker = user.get('broker_connection', {})
        if not broker:
            logger.warning(f"No broker connection found for user: {user['email']}")
            return
            
        try:
            # Initialize CoinDCX client
            logger.debug(f"Initializing CoinDCX client for user {user['email']}")
            coindcx_client = CoinDcxClient(
                api_key=broker['api_key'],
                secret_key=broker['api_secret']
            )
            logger.info(f"CoinDCX client initialized successfully for user {user['email']}")
            
            logger.info(f"=======================  {user['email']}  ==============================")
            
            # Format symbol for CoinDCX (e.g., 'ETH-USDT' -> 'B-ETH_USDT')
            coin, quote = symbol.split('-')
            coindcx_symbol = f"B-{coin}_{quote}"
            
            # Step 1: Cancel all active orders
            logger.info(f"[ORDER CANCELLATION] Starting cancellation of active orders for {user['email']} on {symbol}")
            try:
                # Get all open orders
                orders = coindcx_client.get_futures_orders(
                    status='open',
                    margin_currency_short_name=[user.get('currency', 'USDT')]
                )
                
                if orders and 'data' in orders and orders['data']:
                    active_orders = [order for order in orders['data'] if order.get('pair') == coindcx_symbol]
                    logger.info(f"Found {len(active_orders)} active orders for {user['email']} on {coindcx_symbol}")
                    
                    for order in active_orders:
                        order_id = order.get('id')
                        order_side = order.get('side', 'unknown')
                        order_price = order.get('price', 'market')
                        order_qty = order.get('quantity', 'unknown')
                        
                        logger.info(f"Cancelling order {order_id} for {user['email']} - Side: {order_side}, Price: {order_price}, Qty: {order_qty}")
                        
                        try:
                            cancel_response = coindcx_client.cancel_futures_order(order_id=order_id)
                            if cancel_response and cancel_response.get('status') == 200:
                                logger.info(f"Successfully cancelled order {order_id} for {user['email']}")
                            else:
                                logger.warning(f"Failed to cancel order {order_id}: {json.dumps(cancel_response)}")
                        except Exception as cancel_err:
                            logger.error(f"Exception cancelling order {order_id}: {str(cancel_err)}", exc_info=True)
                            
                        time.sleep(0.2)  # Rate limiting
                else:
                    logger.info(f"No active orders found for {user['email']} on {coindcx_symbol}")
            except Exception as e:
                logger.error(f"Error cancelling orders for {user['email']}: {str(e)}", exc_info=True)
            
            # Step 2: Close all open positions
            logger.info(f"[POSITION CLOSURE] Checking for open positions for {user['email']} on {coindcx_symbol}")
            try:
                # Get all open positions
                positions = coindcx_client.get_positions(
                    margin_currency_short_name=[user.get('currency', 'USDT')]
                )
                
                if positions and isinstance(positions, list):
                    # Log total number of positions
                    logger.info(f"Found {len(positions)} total positions for {user['email']}")
                    
                    # Filter positions for the target symbol
                    target_positions = [p for p in positions if p.get('pair', '') == coindcx_symbol]
                    logger.info(f"Found {len(target_positions)} positions for {coindcx_symbol}")
                    
                    for position in positions:
                        pair = position.get('pair', '')
                        active_pos = float(position.get('active_pos', 0))
                        position_id = position.get('id')
                        
                        # Check if this is a position we want to close
                        if active_pos != 0 and pair == coindcx_symbol:
                            logger.info(f"Found open position: {position_id} on {pair} (Size: {active_pos})")
                            
                            try:
                                # Log position details before closing
                                position_details = {
                                    'pair': pair,
                                    'size': active_pos,
                                    'avg_price': position.get('avg_price'),
                                    'leverage': position.get('leverage'),
                                    'margin_type': position.get('margin_type'),
                                    'liquidation_price': position.get('liquidation_price'),
                                    'mark_price': position.get('mark_price')
                                }
                                logger.info(f"Position details: {json.dumps(position_details, indent=2)}")
                                
                                # Close the position
                                direction = "LONG" if active_pos > 0 else "SHORT"
                                logger.info(f"Closing {direction} position {position_id} (Size: {abs(active_pos)}) for {user['email']} on {pair}")
                                
                                # Add retry mechanism for position closing
                                max_retries = 3
                                for attempt in range(1, max_retries + 1):
                                    try:
                                        close_response = coindcx_client.exit_position(position_id)
                                        logger.info(f"Close position response (Attempt {attempt}/{max_retries}): {close_response}")
                                        
                                        # Check if the position was closed successfully
                                        if close_response and close_response.get('status') == 200:
                                            logger.info(f"Successfully closed position {position_id}. Group ID: {close_response.get('data', {}).get('group_id')}")
                                            break
                                        else:
                                            error_msg = close_response.get('message', 'Unknown error')
                                            logger.warning(f"Failed to close position on attempt {attempt}: {error_msg}")
                                            
                                    except Exception as close_error:
                                        logger.error(f"Error on attempt {attempt} to close position: {str(close_error)}")
                                    
                                    if attempt < max_retries:
                                        wait_time = 1 * attempt  # Exponential backoff
                                        logger.info(f"Retrying in {wait_time} seconds...")
                                        time.sleep(wait_time)
                                else:
                                    logger.error(f"Failed to close position {position_id} after {max_retries} attempts")
                                
                                time.sleep(1)  # Rate limiting between position closures
                                
                            except Exception as close_error:
                                logger.error(f"Error closing position {position_id}: {str(close_error)}", exc_info=True)
                        elif active_pos == 0:
                            logger.info(f"Skipping position {position_id} with zero size on {pair}")
                        else:
                            logger.debug(f"Skipping position on {pair} (not matching target symbol {coindcx_symbol})")
                else:
                    logger.info(f"No open positions found for {user['email']}")
                    
            except Exception as e:
                logger.error(f"Error fetching/closing positions for {user['email']}: {str(e)}", exc_info=True)
            
            # Update user's last processed time
            try:
                update_result = users_collection.update_one(
                    {"_id": user["_id"]},
                    {"$set": {
                        "last_processed_at": datetime.utcnow(),
                        "last_sq_off_status": "completed"
                    }}
                )
                logger.info(f"Updated user record: matched={update_result.matched_count}, modified={update_result.modified_count}")
            except Exception as update_err:
                logger.error(f"Failed to update user record: {str(update_err)}", exc_info=True)
            
        except Exception as e:
            logger.error(f"Error processing user {user['email']}: {str(e)}", exc_info=True)
        
        logger.info("======================================================")
        time.sleep(1)  # Increased rate limiting between users
        
    except Exception as e:
        logger.error(f"Error processing user {user.get('email', 'unknown')}: {str(e)}", exc_info=True)


def process_user_with_symbols(user_data):
    """Process a single user with all symbols - used for multiprocessing.
    
    Args:
        user_data (dict): User document from MongoDB
        
    Returns:
        tuple: (success, user_email) where success is a boolean indicating if processing was successful
    """
    user = user_data
    user_email = user.get('email', 'unknown')
    
    try:
        logger.info(f"Processing user: {user_email} in process {os.getpid()}")
        for symbol in symbols:
            process_user_positions(user, symbol)
        return (True, user_email)
    except Exception as e:
        logger.error(f"Failed to process user {user_email}: {str(e)}", exc_info=True)
        return (False, user_email)


# Configure process pool initialization
def init_worker():
    """Initialize worker process with signal handling."""
    import signal
    signal.signal(signal.SIGINT, signal.SIG_IGN)


# Main execution
if __name__ == "__main__":
    start_time = datetime.utcnow()
    
    # Determine optimal number of processes
    # Use fewer processes than available CPUs to avoid overwhelming the API
    num_cpus = cpu_count()
    num_processes = min(num_cpus - 1, 4)  # Use at most 4 processes or (CPU count - 1)
    if num_processes < 1:
        num_processes = 1
    
    logger.info(f"Starting position closure for {len(all_users)} users at {start_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    logger.info(f"Using {num_processes} processes for parallel execution (out of {num_cpus} available CPUs)")
    
    results = []
    
    try:
        # Create a process pool
        with Pool(processes=num_processes, initializer=init_worker) as pool:
            # Map users to the process_user_with_symbols function
            results = pool.map(process_user_with_symbols, all_users)
    except KeyboardInterrupt:
        logger.critical("Process interrupted by user. Shutting down...")
        sys.exit(1)
    except Exception as e:
        logger.critical(f"Error in multiprocessing: {str(e)}", exc_info=True)
    
    # Count successful and failed users
    successful_users = sum(1 for success, _ in results if success)
    failed_users = sum(1 for success, _ in results if not success)
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    logger.info("="*80)
    logger.info(f"Position closure process completed at {end_time.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    logger.info(f"Duration: {duration:.2f} seconds")
    logger.info(f"Summary: {successful_users} users processed successfully, {failed_users} users failed")
    logger.info("="*80)

