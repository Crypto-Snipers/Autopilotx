from datetime import datetime, timezone
import requests
import time
import logging
import socket
import uuid
import os
import sys
import re
from dotenv import load_dotenv
import logging
from pymongo import MongoClient


# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Create a file handler
file_handler = logging.FileHandler("/home/ubuntu/cryptocode/logs/telegram_bot.log")
file_handler.setLevel(logging.INFO)

# Create a formatter and set it for the file handler
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)

# Add the file handler to the logger
logger = logging.getLogger(__name__)
logger.addHandler(file_handler)


load_dotenv(override=True)


if not os.getenv("MONGO_URL"):
    logger.error(
        "MONGO_URL environment variable is not set. Please set it in .env file."
    )
    sys.exit(1)


# MongoDB connection string
MONGO_URL = os.getenv("MONGO_URL")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME") or "CryptoSniper"

logger.info("MongoDB connection string: %s", MONGO_URL)

## Users allowed
allowed_users = [1270445896, 5429456345, 1238722092]


# Debug: Print the connection string (with password masked)
if MONGO_URL:
    # Mask the password in the connection string for security
    debug_url = MONGO_URL
    if "@" in debug_url and ":" in debug_url.split("@")[0]:
        parts = debug_url.split("@")
        user_pass = parts[0].split("://")[1].split(":")
        masked_url = f"{parts[0].split('://')[0]}://{user_pass[0]}:****@{parts[1]}"
        print(f"MongoDB URL format: {masked_url}")
    else:
        print("MongoDB URL is present but in unexpected format")
else:
    print("WARNING: MongoDB URL is None or empty!")

# Connect to MongoDB
try:
    # Connect directly using the full connection string
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=10000)

    # Test the connection
    client.admin.command("ping")  # This will raise an exception if connection fails
    print("MongoDB connection test successful!")
    logger.info("MongoDB connection test successful!")
except Exception as e:
    print(f"MongoDB connection test failed: {e}, full error: {e.__dict__}")
    logger.error(f"MongoDB connection test failed: {e}, full error: {e.__dict__}")


db = client[f"{MONGO_DB_NAME}"]
TradeCollection = db["trades"]
PositionCollection = db["position"]


# Generate a unique session ID
SESSION_ID = str(uuid.uuid4())[:8]
logger.info(f"Starting bot with session ID: {SESSION_ID}")

# Set default socket timeout
socket.setdefaulttimeout(30)

# Your bot token
BOT_TOKEN = "8037936849:AAHtqUdLgr3NmzQpWyGtq5TKeJLeQjsh1zU"
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

# Proxy configuration (set these if you're behind a proxy)
HTTP_PROXY = None
HTTPS_PROXY = None


# Function to create a fresh session
def create_fresh_session():
    new_session = requests.Session()
    if HTTP_PROXY:
        new_session.proxies = {"http": HTTP_PROXY, "https": HTTPS_PROXY or HTTP_PROXY}
    # Add a unique identifier to help avoid conflicts
    new_session.headers.update(
        {"User-Agent": f"CryptoSniperBot/{SESSION_ID}", "X-Session-ID": SESSION_ID}
    )
    return new_session


# Create initial session
session = create_fresh_session()

# Configure proxy if needed
if HTTP_PROXY or HTTPS_PROXY:
    proxies = {}
    if HTTP_PROXY:
        proxies["http"] = HTTP_PROXY
    if HTTPS_PROXY:
        proxies["https"] = HTTPS_PROXY
    session.proxies.update(proxies)
    logger.info(f"Using proxies: {proxies}")


def check_internet_connection():
    """Check if there's an internet connection by trying to connect to a reliable host"""
    try:
        # Try to connect to Google's DNS server
        socket.create_connection(("8.8.8.8", 53), timeout=5)
        return True
    except OSError:
        return False


def reconnect_mongodb():
    """Helper function to reconnect to MongoDB"""
    global client, db, TradeCollection, PositionCollection
    try:
        mongo_url = os.getenv("MONGO_URL")
        if not mongo_url:
            logger.error("MONGO_URL environment variable is empty or not set")
            print("MONGO_URL environment variable is empty or not set")
            return False

        # Connect directly using the full connection string
        client = MongoClient(mongo_url, serverSelectionTimeoutMS=10000)

        # Test the connection
        client.admin.command("ping")
        print("MongoDB reconnection successful!")
        logger.info("MongoDB reconnection successful!")

        db = client[MONGO_DB_NAME]
        TradeCollection = db["trades"]
        PositionCollection = db["position"]
        logger.info("MongoDB reconnection successful")
        print("MongoDB reconnection successful")
        return True
    except Exception as reconnect_err:
        logger.error(f"MongoDB reconnection failed: {reconnect_err}")
        print(f"MongoDB reconnection failed: {reconnect_err}")
        return False


def extract_info_from_msg(message: str, username: str, chat_id: str = None):
    # message = 'Crypto: "ETHUSDT"\nPosition: "Long"\nEntry: 2453.21\nStopLoss: 2443.5\nTarget: 2470.5'

    # Crypto
    crypto_pattern = r"Crypto: \"(.*?)\""
    crypto_match = re.search(crypto_pattern, message)
    crypto = crypto_match.group(1) if crypto_match else "N/A"

    # Position
    position_pattern = r"Position: \"(.*?)\""
    position_match = re.search(position_pattern, message)
    position = position_match.group(1) if position_match else "N/A"

    # Entry
    entry_pattern = r"Entry: (\d+(?:\.\d+)?)"
    entry_match = re.search(entry_pattern, message)
    entry = float(entry_match.group(1)) if entry_match else "N/A"

    # StopLoss
    stoploss_pattern = r"StopLoss: (\d+(?:\.\d+)?)"
    stoploss_match = re.search(stoploss_pattern, message)
    stoploss = float(stoploss_match.group(1)) if stoploss_match else "N/A"

    # Target
    target_pattern = r"Target: (\d+(?:\.\d+)?)"
    target_match = re.search(target_pattern, message)
    target = float(target_match.group(1)) if target_match else "N/A"

    qty_pattern = r"Qty: (\d+(?:\.\d+)?)"
    qty_match = re.search(qty_pattern, message)
    qty = float(qty_match.group(1)) if qty_match else "N/A"

    if (
        crypto == "N/A"
        or position == "N/A"
        or entry == "N/A"
        or stoploss == "N/A"
        or target == "N/A"
        or qty == "N/A"
    ):
        logger.error(f"Invalid message from {username}: {message}")
        send_message(
            chat_id=chat_id,
            text='Invalid message format. Please check your input.\n Example: \nCrypto: "ETHUSDT"\nPosition: "Long"\nEntry: 2453.21\nStopLoss: 2443.5\nTarget: 2470.5\nQty: 0.3',
        )

        return

    print(f"Crypto: {crypto}")
    print(f"Position: {position}")
    print(f"Entry: {entry}")
    print(f"StopLoss: {stoploss}")
    print(f"Target: {target}")
    print(f"Qty: {qty}")

    # Position document
    Strategy = "ETH Multiplier" if crypto == "ETHUSDT" else "Unknown Strategy"
    side = "BUY" if position.lower() == "long" else "SELL"

    # Generate ID using timestamp in nanoseconds for uniqueness
    timestamp_ns = int(time.time() * 1_000_000_000)  # Convert to nanoseconds
    ID = str(timestamp_ns)
    Symbol = "ETH-USDT"

    position_doc = {
        "Strategy": Strategy,
        "ID": ID,
        "Symbol": Symbol,
        "Side": side,
        "Condition": "Executed",
        "EntryPrice": entry,
        "Qty": qty,
        "StopLoss": stoploss,
        "Target": target,
        "EntryTime": datetime.now(timezone.utc),
        "Status": "Open",
        "UpdateTime": 0,
        "username": username,
    }

    trades_doc = {
        "Strategy": Strategy,
        "ID": ID,
        "Symbol": Symbol,
        "Side": side,
        "Price": entry,
        "Qty": qty,
        "StopLoss": stoploss,
        "Target": target,
        "OrderTime": datetime.now(timezone.utc),
        "OrderType": "MARKET",
        "UpdateTime": 0,
        "username": username,
        "Users":{}
    }

    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            # Try to insert documents
            position_result = PositionCollection.insert_one(position_doc)
            trade_result = TradeCollection.insert_one(trades_doc)

            # Log successful insertions
            logger.info(
                f"Position document inserted with ID: {position_result.inserted_id}"
            )
            logger.info(f"Trade document inserted with ID: {trade_result.inserted_id}")

            print(f"Position document inserted with ID: {position_result.inserted_id}")
            print(f"Trade document inserted with ID: {trade_result.inserted_id}")

            # If successful, break out of retry loop
            break

        except Exception as e:
            retry_count += 1
            logger.error(
                f"MongoDB insertion error (attempt {retry_count}/{max_retries}): {e}"
            )
            print(
                f"Error inserting data into MongoDB (attempt {retry_count}/{max_retries}): {e}"
            )

            # Check if MongoDB connection is valid
            try:
                # Ping the database to check connection
                client.admin.command("ping")
                logger.info("MongoDB connection is valid but insertion failed")
                print("MongoDB connection is valid but insertion failed")

                # If this is not the last retry, wait before retrying
                if retry_count < max_retries:
                    wait_time = 2**retry_count  # Exponential backoff: 2, 4, 8 seconds
                    logger.info(f"Waiting {wait_time} seconds before retrying...")
                    print(f"Waiting {wait_time} seconds before retrying...")
                    time.sleep(wait_time)

            except Exception as conn_err:
                # Connection is not valid, try to reconnect
                logger.error(f"MongoDB connection error: {conn_err}")
                print(f"MongoDB connection error: {conn_err}")

                # Try to reconnect
                if reconnect_mongodb():
                    logger.info("Reconnected to MongoDB, retrying insertion...")
                    print("Reconnected to MongoDB, retrying insertion...")
                else:
                    logger.error("Failed to reconnect to MongoDB")
                    print("Failed to reconnect to MongoDB")

                # If this is not the last retry, wait before retrying
                if retry_count < max_retries:
                    wait_time = 2**retry_count  # Exponential backoff
                    logger.info(f"Waiting {wait_time} seconds before retrying...")
                    print(f"Waiting {wait_time} seconds before retrying...")
                    time.sleep(wait_time)
        except Exception as conn_err:
            logger.error(f"MongoDB connection error: {conn_err}")
            print(f"MongoDB connection error: {conn_err}")
            # Try to reconnect
            reconnect_mongodb()


def get_updates(offset=None, max_retries=5):
    """Get updates from Telegram API with retry mechanism"""
    global session

    # First check if we have internet connectivity
    if not check_internet_connection():
        logger.error("No internet connection available")
        return None

    url = f"{BASE_URL}/getUpdates"
    params = {
        "timeout": 30,  # Increased timeout
        "allowed_updates": [
            "message",
            "edited_message",
            "callback_query",
        ],  # Specify what updates we want
    }
    if offset:
        params["offset"] = offset

    retries = 0
    while retries < max_retries:
        try:
            # Increased timeout values for better reliability
            response = session.get(url, params=params, timeout=(10, 30))
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 409:
                # Handle conflict specifically
                logger.warning(
                    "Conflict detected in getUpdates, getting clean offset..."
                )
                clean_offset = get_clean_offset()
                if clean_offset is not None:
                    # Try again with the clean offset
                    params["offset"] = clean_offset
                    continue
                else:
                    # If we couldn't get a clean offset, try to reset the connection
                    reset_bot_connection()
                    # Wait a bit for the reset to take effect
                    time.sleep(5)
                    continue
            else:
                logger.error(
                    f"Error in getUpdates: {response.status_code} - {response.text}"
                )

            # If we get here, there was an error but not a 409 conflict
            retries += 1
            if retries < max_retries:
                # Exponential backoff
                wait_time = 2**retries
                logger.info(f"Retrying getUpdates in {wait_time} seconds...")
                time.sleep(wait_time)
        except requests.exceptions.Timeout:
            logger.warning("Timeout in getUpdates, retrying...")
            retries += 1
            if retries < max_retries:
                # Exponential backoff for timeouts
                wait_time = 2**retries
                logger.info(f"Retrying getUpdates in {wait_time} seconds...")
                time.sleep(wait_time)
        except requests.exceptions.RequestException as e:
            logger.error(f"Request exception in getUpdates: {e}")
            retries += 1
            if retries < max_retries:
                # Exponential backoff for request exceptions
                wait_time = 2**retries
                logger.info(f"Retrying getUpdates in {wait_time} seconds...")
                time.sleep(wait_time)

                # Check if we need to reset the connection
                if retries >= max_retries // 2:
                    logger.info("Attempting to reset connection...")
                    reset_bot_connection()
                    # Create a new session just to be safe
                    session = create_fresh_session()
        except Exception as e:
            logger.error(f"Unexpected error in getUpdates: {e}")
            retries += 1
            if retries < max_retries:
                # Exponential backoff for unexpected errors
                wait_time = 2**retries
                logger.info(f"Retrying getUpdates in {wait_time} seconds...")
                time.sleep(wait_time)

    logger.error("Max retries exceeded for getting updates")
    return None


def send_message(chat_id, text, max_retries=3):
    """Send message to a specific chat with retry mechanism"""
    # First check if we have internet connectivity
    if not check_internet_connection():
        logger.error("No internet connection available")
        return None

    url = f"{BASE_URL}/sendMessage"
    params = {"chat_id": chat_id, "text": text}

    retries = 0
    while retries < max_retries:
        try:
            # Use the session for better connection reuse
            response = session.post(url, params=params, timeout=(3, 10))
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(
                    f"API returned status code {response.status_code}: {response.text}"
                )
                return None
        except requests.exceptions.Timeout:
            retries += 1
            logger.warning(f"Connection timeout, retrying ({retries}/{max_retries})...")
            time.sleep(2)  # Wait before retrying
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {e}")
            return None
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return None

    logger.error("Max retries exceeded for sending message")
    return None


def handle_message(message):
    """Process incoming message"""
    chat_id = message["chat"]["id"]
    user = message["from"]
    text = message.get("text", "")

    # Print message info
    username = user.get("first_name") or user.get("username")
    logger.info(f"[{chat_id}] {username}")
    logger.info(f"\n {user}")

    # Handle /start command
    if text == "/start":
        if chat_id not in allowed_users:
            send_message(chat_id, "You are not authorized to use this bot.")
            return

        send_message(chat_id, "Bot is running and listening to messages!")

    elif text.lower() in ["hi", "hello", "hey", "hi there", "hello there", "hey there"]:
        if chat_id not in allowed_users:
            send_message(chat_id, "You are not authorized to use this bot.")
            return
        send_message(chat_id, "Hello! I'm CryptoSniperBot. How can I help you?")

    elif text.lower() in ["bye", "goodbye", "bye-bye", "bye-bye", "bye-bye"]:
        if chat_id not in allowed_users:
            send_message(chat_id, "You are not authorized to use this bot.")
            return
        send_message(chat_id, "Goodbye! Have a great day!")
    else:
        if chat_id not in allowed_users:
            send_message(chat_id, "You are not authorized to use this bot.")
            return

        extract_info_from_msg(text, username, chat_id)


def reset_bot_connection():
    """Attempt to reset the bot connection quickly"""
    global session

    logger.info("Performing fast bot connection reset")
    print("Resetting bot connection...")

    # Create a new session
    old_session = session
    session = create_fresh_session()

    # Test the new connection with a longer timeout
    try:
        # Use getMe as a lightweight API call to test the connection
        response = session.get(f"{BASE_URL}/getMe", timeout=10)
        if response.status_code == 200:
            logger.info("Bot connection reset successful")
            print("Bot connection reset successful")

            # Close the old session if it exists
            if old_session:
                try:
                    old_session.close()
                except:
                    pass

            return True
        else:
            # Try to delete webhook if there's an issue
            try:
                delete_response = session.get(
                    f"{BASE_URL}/deleteWebhook?drop_pending_updates=true", timeout=10
                )
                if delete_response.status_code == 200:
                    logger.info(
                        "Successfully reset webhook and dropped pending updates"
                    )
                    time.sleep(2)  # Small delay to ensure reset takes effect
                    return True
            except Exception as webhook_err:
                logger.error(f"Error deleting webhook: {webhook_err}")

            logger.error(
                f"Bot connection reset failed with status code: {response.status_code}"
            )
            print(
                f"Bot connection reset failed with status code: {response.status_code}"
            )
            return False
    except Exception as e:
        logger.error(f"Error during connection reset: {e}")
        print(f"Error during connection reset: {e}")
        return False


def get_clean_offset():
    """Get a clean offset to start polling from, avoiding conflicts"""
    try:
        # Try with a fresh session
        temp_session = create_fresh_session()

        # First try to get just one update with minimal timeout
        params = {"limit": 1, "timeout": 1, "allowed_updates": []}
        response = temp_session.get(
            f"{BASE_URL}/getUpdates", params=params, timeout=(3, 5)
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                # If we got an OK response, that's good enough
                # Empty result means no pending updates, which is ideal for a fresh start
                logger.info("Successfully connected to Telegram API")
                updates = data.get("result", [])
                if updates:
                    # Found an update, use its ID + 1
                    return updates[-1]["update_id"] + 1
                else:
                    # No updates is actually good - we have a clean slate
                    logger.info("No pending updates found - clean slate")
                    return 0  # Start with offset 0

        # If we got a conflict error or any other error, try a different approach
        logger.warning(
            f"Could not get clean offset: {response.status_code} - {response.text}"
        )
        return None
    except Exception as e:
        logger.error(f"Error getting clean offset: {e}")
        return None


def main():
    print(f"Bot is starting... (Session: {SESSION_ID})")
    logger.info(f"Bot is starting... (Session: {SESSION_ID})")

    # Check internet connection first
    if not check_internet_connection():
        logger.error(
            "No internet connection available. Please check your network settings."
        )
        print("No internet connection available. Please check your network settings.")
        return

    # Try to completely reset the connection to avoid conflicts
    reset_attempts = 0
    max_reset_attempts = 3

    while reset_attempts < max_reset_attempts:
        if reset_bot_connection():
            # Wait for the reset to take effect
            wait_time = 5 + (reset_attempts * 5)
            logger.info(f"Waiting {wait_time} seconds for reset to take effect...")
            time.sleep(wait_time)

            # Get a clean offset
            initial_offset = get_clean_offset()
            if initial_offset is not None:
                logger.info(f"Starting with clean offset: {initial_offset}")
                print(f"Starting with clean offset: {initial_offset}")
                break  # Successfully got an offset, break out of the loop
            else:
                # If we couldn't get a clean offset but the connection reset was successful
                # Let's try with a default offset of 0 on the last attempt
                if reset_attempts == max_reset_attempts - 1:
                    logger.info("Using default offset of 0 as fallback")
                    initial_offset = 0
                    break

        # If we get here, either reset_bot_connection() failed or we couldn't get a clean offset
        reset_attempts += 1
        if reset_attempts < max_reset_attempts:
            logger.warning(f"Reset attempt {reset_attempts} failed, trying again...")
            # Wait longer between attempts
            time.sleep(10)  # 10 seconds between attempts

    if reset_attempts >= max_reset_attempts:
        logger.error("Could not establish a clean connection after multiple attempts")
        print("Could not establish a clean connection to Telegram API.")
        print("Please check your network/proxy settings or try again later.")
        return

    # Test the API connection with the initial offset
    test_params = {"timeout": 1, "offset": initial_offset, "limit": 1}
    try:
        test_response = session.get(
            f"{BASE_URL}/getUpdates", params=test_params, timeout=(3, 5)
        )
        if test_response.status_code != 200:
            logger.error(
                f"Test connection failed: {test_response.status_code} - {test_response.text}"
            )
            print(
                "Could not connect to Telegram API. Please check your network/proxy settings."
            )
            print(
                "If you're behind a proxy, update the HTTP_PROXY and HTTPS_PROXY variables in the script."
            )
            return
    except Exception as e:
        logger.error(f"Test connection error: {e}")
        print(
            "Could not connect to Telegram API. Please check your network/proxy settings."
        )
        print(
            "If you're behind a proxy, update the HTTP_PROXY and HTTPS_PROXY variables in the script."
        )
        return

    # Use the initial offset if available, otherwise start with None
    offset = initial_offset
    consecutive_errors = 0
    max_consecutive_errors = 5
    backoff_time = 5  # Start with 5 seconds

    # Set up auto-recovery variables
    last_successful_connection = time.time()
    total_runtime_errors = 0
    max_total_errors = 50  # Maximum errors before full reset
    full_reset_performed = False

    print(f"Bot is now running with session ID: {SESSION_ID}")
    logger.info(f"Bot is now running with session ID: {SESSION_ID}")

    try:
        while True:
            try:
                # Check internet connection periodically
                if not check_internet_connection():
                    logger.error("Internet connection lost. Waiting to reconnect...")
                    print("Internet connection lost. Waiting to reconnect...")
                    time.sleep(30)  # Wait longer for reconnection
                    continue

                # Check if we need a full reset due to too many errors
                if (
                    total_runtime_errors >= max_total_errors
                    and not full_reset_performed
                ):
                    logger.warning(
                        f"Too many total errors ({total_runtime_errors}), performing full reset"
                    )
                    print(
                        "Too many errors encountered, performing full system reset..."
                    )

                    # Try to completely reset everything
                    if reset_bot_connection():
                        time.sleep(10)  # Wait for reset to take effect
                        # Get a fresh offset
                        new_offset = get_clean_offset()
                        if new_offset is not None:
                            offset = new_offset
                            logger.info(
                                f"Full reset successful, continuing with offset: {offset}"
                            )
                            print(f"Reset successful, continuing with fresh connection")

                    # Reset counters
                    total_runtime_errors = 0
                    consecutive_errors = 0
                    backoff_time = 5
                    full_reset_performed = True
                    time.sleep(5)
                    continue

                updates = get_updates(offset)
                if updates and updates.get("ok"):
                    # Success! Reset error counters
                    consecutive_errors = 0
                    backoff_time = 5
                    last_successful_connection = time.time()
                    full_reset_performed = False  # Reset this flag on success

                    # Check if we got a new offset from conflict resolution
                    if "new_offset" in updates:
                        offset = updates["new_offset"]
                        logger.info(
                            f"Updated offset to {offset} after conflict resolution"
                        )
                        print(f"Updated offset to {offset} after conflict resolution")
                        continue

                    # Process updates
                    result = updates.get("result", [])
                    if result:
                        for update in result:
                            # Update offset to acknowledge the update
                            offset = update["update_id"] + 1

                            # Process message if present
                            if "message" in update:
                                handle_message(update["message"])
                else:
                    consecutive_errors += 1
                    total_runtime_errors += 1
                    logger.warning(
                        f"Failed to get updates, consecutive errors: {consecutive_errors}, total: {total_runtime_errors}"
                    )

                    # If we've had too many consecutive errors, implement exponential backoff
                    if consecutive_errors >= max_consecutive_errors:
                        logger.error(
                            f"Too many consecutive errors ({consecutive_errors}), waiting {backoff_time} seconds"
                        )
                        print(
                            f"Connection issues detected, waiting {backoff_time} seconds before retry..."
                        )
                        time.sleep(backoff_time)
                        backoff_time = min(
                            300, backoff_time * 2
                        )  # Double the backoff time, max 5 minutes

                        # After several retries with backoff, try to reset the connection
                        if consecutive_errors >= max_consecutive_errors * 2:
                            logger.warning(
                                "Attempting connection reset after multiple failures"
                            )
                            reset_bot_connection()
                            time.sleep(5)
                    else:
                        time.sleep(5)  # Wait a bit longer between retries

                # Check if we've been running without success for too long
                if time.time() - last_successful_connection > 600:  # 10 minutes
                    logger.warning(
                        "No successful connection for 10 minutes, attempting reset"
                    )
                    print(
                        "No successful connection for 10 minutes, attempting reset..."
                    )
                    reset_bot_connection()
                    time.sleep(10)
                    last_successful_connection = time.time()  # Reset the timer

            except requests.exceptions.ConnectionError as e:
                logger.error(f"Connection error in main loop: {e}")
                print("Network connection error, will retry shortly...")
                consecutive_errors += 1
                total_runtime_errors += 1
                time.sleep(10)

            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                print(f"Unexpected error: {e}. Bot will continue running.")
                consecutive_errors += 1
                total_runtime_errors += 1
                time.sleep(5)

    except KeyboardInterrupt:
        logger.info("Bot stopped manually")
        print("Bot stopped manually")
    except Exception as e:
        logger.critical(f"Critical error in main process: {e}")
        print(f"Critical error: {e}")
        print("Bot will attempt to restart...")

        # Try to restart the bot by calling main() again
        try:
            print("Attempting to restart bot...")
            time.sleep(5)
            main()
        except Exception as restart_error:
            logger.critical(f"Failed to restart bot: {restart_error}")
            print(f"Failed to restart bot: {restart_error}")
            print("Please restart the bot manually.")

    print("Bot has exited. To restart, run the script again.")


# Add a watchdog mechanism to auto-restart the bot if it crashes
def start_bot_with_watchdog():
    """Start the bot with a watchdog to automatically restart it if it crashes"""
    max_restarts = 5
    restart_count = 0
    restart_delay = 10  # seconds

    while restart_count < max_restarts:
        try:
            main()
            # If main() exits normally, break the loop
            break
        except Exception as e:
            restart_count += 1
            logger.critical(
                f"Bot crashed with error: {e}. Restart attempt {restart_count}/{max_restarts}"
            )
            print(f"Bot crashed with error: {e}")
            print(
                f"Automatically restarting in {restart_delay} seconds... (Attempt {restart_count}/{max_restarts})"
            )
            time.sleep(restart_delay)
            restart_delay *= 2  # Exponential backoff for restart delays

    if restart_count >= max_restarts:
        logger.critical(
            f"Bot failed to start after {max_restarts} attempts. Please check the logs."
        )
        print(
            f"Bot failed to start after {max_restarts} attempts. Please check the logs."
        )


if __name__ == "__main__":
    start_bot_with_watchdog()
