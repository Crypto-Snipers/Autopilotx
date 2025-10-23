
"""
Balance Updater Script

This script updates the futures wallet balances, balance and free margin for all users with verified API credentials.
It runs every two hours and updates the MongoDB database with the latest balance information.
"""

import os
import logging
import pymongo
import pause
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pathlib import Path
from delta_client import DeltaRestClient, DeltaAPIError

# Load environment variables from .env file
script_dir = Path(__file__).parent.parent  # Gets the cryptocode directory
env_path = script_dir / '.env'

load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("balance_updater.log")
    ]
)
logger = logging.getLogger("BalanceUpdater")

# MongoDB connection details
load_dotenv()

MONGO_LINK = os.getenv("MONGO_URL")
if not MONGO_LINK:
    raise ValueError("MONGO_URL environment variable not found in .env file")
    
DB_NAME = os.getenv("MONGO_DB_NAME") or "CryptoSniper"


class BalanceUpdater:

    def __init__(self):
        """Initialize the BalanceUpdater with MongoDB connection."""
        try:
            self.mongo_client = pymongo.MongoClient(MONGO_LINK)
            self.db = self.mongo_client[DB_NAME]
            self.users_collection = self.db["users"]
            logger.info(f"Connected to MongoDB database: {DB_NAME}")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise

    def update_all_users_balances(self, specific_email=None):
        """Update balances for users with verified API credentials.
        
        Args:
            specific_email (str, optional): If provided, only update this specific user's balance.
                                          If None, update all users with verified API credentials.
        """
        if specific_email:
            logger.info(f"Starting balance update for specific user: {specific_email}")
        else:
            logger.info("Starting balance update for all users")
        
        try:
            # Build the query filter
            query_filter = {
                "api_verified": True,
                "broker_connection.status": "connected"
            }
            
            # Add email filter if specific_email is provided
            if specific_email:
                query_filter["email"] = specific_email
            
            # Find users with verified API credentials
            users = self.users_collection.find(query_filter)
            
            user_count = 0
            success_count = 0
            
            for user in users:
                user_count += 1
                email = user.get("email", "Unknown")
                
                try:
                    # Get broker connection details
                    broker_connection = user.get("broker_connection", {})
                    if not broker_connection:
                        logger.warning(f"User {email} has no broker connection configured")
                        continue
                    
                    # Extract API credentials
                    api_key = broker_connection.get("api_key")
                    api_secret = broker_connection.get("api_secret")
                    
                    if not api_key or not api_secret:
                        logger.warning(f"User {email} has incomplete API credentials")
                        continue
                    
                    # Update user's balance
                    if self.update_user_balance(user["_id"], email, api_key, api_secret):
                        success_count += 1
                
                except Exception as e:
                    logger.error(f"Error updating balance for user {email}: {str(e)}")
            
            logger.info(f"Balance update completed. Processed {user_count} users, {success_count} successful updates.")
            
        except Exception as e:
            logger.error(f"Error in update_all_users_balances: {str(e)}")

    def update_user_balance(self, user_id, email, api_key, api_secret):
        """
        Update balance for a specific user.
        
        Args:
            user_id: MongoDB user ID
            email: User's email for logging
            api_key: Delta API key
            api_secret: Delta API secret
            
        Returns:
            bool: True if update was successful, False otherwise
        """
        logger.info(f"Updating balance for user: {email}")
        
        try:
            # Create Delta 
            base_url = "https://api.india.delta.exchange"
            client = DeltaRestClient(api_key=api_key, api_secret=api_secret, base_url=base_url)
            
            # Get futures wallet balances
            futures_wallets = client.get_wallet_balances()

            logger.info(f"Futures wallet balances: {futures_wallets}")
            
            if not futures_wallets:
                logger.warning(f"No futures wallet data returned for user: {email}")
                return False
            
            # Process wallet data
            wallet_data = {}
            for wallet in futures_wallets:
                # Check if we have the new format with asset_symbol
                if "asset_symbol" in wallet:
                    currency = wallet.get("asset_symbol").lower()
                    if currency:
                        wallet_data[currency] = {
                            "id": wallet.get("id"),
                            "asset_symbol": currency,
                            "balance": wallet.get("balance", "0.0"),
                            "available_balance": wallet.get("available_balance", "0.0"),
                            "blocked_margin": wallet.get("blocked_margin", "0.0"),
                            "order_margin": wallet.get("order_margin", "0.0"),
                            "position_margin": wallet.get("position_margin", "0.0")
                        }
                        # Log the extracted data for debugging
                        logger.info(f"Extracted {currency} balance: {wallet_data[currency]['balance']}")

                else:
                    # Handle completely new format where fields might be different
                    logger.info(f"Unrecognized wallet format, trying to extract data: {wallet}")
                    if "asset_id" in wallet and "asset_symbol" in wallet:
                        currency = wallet.get("asset_symbol").lower()
                        if currency:
                            wallet_data[currency] = {
                                "id": wallet.get("id"),
                                "asset_id": wallet.get("asset_id"),
                                "asset_symbol": currency,
                                "balance": wallet.get("balance", "0.0"),
                                "available_balance": wallet.get("available_balance", "0.0")
                            }
                            # Log the extracted data for debugging
                            logger.info(f"Extracted {currency} balance (new format): {wallet_data[currency]['balance']}")
                    else:
                        logger.warning(f"Could not identify currency in wallet data: {wallet}")

            
            if not wallet_data:
                logger.warning(f"No wallet data processed for user: {email}")
                return False
            
            # Calculate balance, used_margin, and free_margin
            balance = {"usd": 0}
            used_margin = {"usd": 0}
            free_margin = {"usd": 0}
            
            # Get user document to access strategies
            user_doc = self.users_collection.find_one({"_id": user_id})
            if not user_doc:
                logger.warning(f"User document not found for ID: {user_id}, email: {email}")
                return False
                
            # Calculate strategy margin allocation
            strategy_margin_usd = 0
            
            # Get strategies from user document
            strategies = user_doc.get('strategies', {})
            if strategies:
                logger.info(f"Found {len(strategies)} strategies for user: {email}")
                
                # Calculate margin allocated to strategies
                for strategy_name, strategy_data in strategies.items():
                    if strategy_data.get('status') == 'active':
                        multiplier = strategy_data.get('multiplier', 1)
                        # Use the same base margin values as in backend.py
                        strategy_margin_usd += multiplier * 500
                        logger.info(f"Strategy '{strategy_name}' with multiplier {multiplier} using margin: USD={multiplier * 500}")
            
            # Update USD balance if available
            if "usd" in wallet_data:
                usd_balance = float(wallet_data["usd"].get("balance", 0))
                balance["usd"] = usd_balance
                used_margin["usd"] = strategy_margin_usd
                free_margin["usd"] = max(0, usd_balance - strategy_margin_usd)
                logger.info(f"USD - Balance: {usd_balance}, Strategy Used: {strategy_margin_usd}, Free: {free_margin['usd']}")
            
            # If we still don't have a USD balance, try to parse it from the raw wallet data
            # This handles the case where the API response format has changed
            elif futures_wallets and isinstance(futures_wallets, list) and len(futures_wallets) > 0:
                for wallet in futures_wallets:
                    if wallet.get("asset_symbol") == "USD":
                        try:
                            usd_balance = float(wallet.get("balance", 0))
                            balance["usd"] = usd_balance
                            used_margin["usd"] = strategy_margin_usd
                            free_margin["usd"] = max(0, usd_balance - strategy_margin_usd)
                            logger.info(f"USD (from raw data) - Balance: {usd_balance}, Strategy Used: {strategy_margin_usd}, Free: {free_margin['usd']}")
                            break
                        except (ValueError, TypeError) as e:
                            logger.error(f"Error parsing USD balance from raw data: {str(e)}")
                
            # If no USD or USDT found, but we have futures_wallets in user_doc, use that
            if balance["usd"] == 0 and "futures_wallets" in user_doc and "usd" in user_doc["futures_wallets"]:
                balance["usd"] = user_doc["futures_wallets"]["usd"]
                free_margin["usd"] = max(0, balance["usd"] - used_margin["usd"])
                logger.info(f"Using existing USD balance from user document: {balance['usd']}")
                
            # If we still don't have a USD balance, log a warning
            if balance["usd"] == 0:
                logger.warning(f"No USD balance found for user: {email}")
                # Don't return False here, as we might still want to update other fields
            
            # Update user document in MongoDB with the new structure
            # Prepare the update document based on the new structure
            update_doc = {
                "updated_at": datetime.now(timezone.utc)
            }
            
            # Update balance fields
            if "usd" in balance:
                update_doc["balance.usd"] = balance["usd"]
                update_doc["free_margin.usd"] = free_margin["usd"]
                update_doc["used_margin.usd"] = used_margin["usd"]
                update_doc["futures_wallets.usd"] = balance["usd"]
            
            # Update the document using dot notation for nested fields
            update_result = self.users_collection.update_one(
                {"_id": user_id},
                {"$set": update_doc}
            )
            
            if update_result.modified_count > 0:
                logger.info(f"Successfully updated balance for user: {email}")
                return True
            else:
                logger.warning(f"No changes made to balance for user: {email}")
                return False
                
        except DeltaAPIError as e:
            logger.error(f"Delta API error for user {email}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error updating balance for user {email}: {str(e)}")
            return False


def run_balance_updater(specific_email=None):
    """Run the balance updater once.
    
    Args:
        specific_email (str, optional): If provided, only update this specific user's balance.
                                      If None, update all users with verified API credentials.
    """
    try:
        updater = BalanceUpdater()
        updater.update_all_users_balances(specific_email=specific_email)
    except Exception as e:
        logger.error(f"Error running balance updater: {str(e)}")


def main():
    """Main function to run the balance updater every 5 minutes."""
    logger.info("Balance Updater started")
    
    # Set the specific email to update (can be changed to None to update all users)
    specific_email = "vipinpal7060@gmail.com"
    logger.info(f"Configured to update balance for specific user: {specific_email}")
    
    try:
        while True:
            try:
                # Calculate next run time (5 minutes from now)
                next_run = datetime.now() + timedelta(minutes=5)
                
                # Run the balance updater with specific email
                run_balance_updater(specific_email=specific_email)
                
                # Log next scheduled run time
                logger.info(f"Next balance update scheduled for {next_run}")
                
                # Pause until the next scheduled run time
                pause.until(next_run)
                
            except KeyboardInterrupt:
                logger.info("Balance Updater stopped by user")
                break
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {str(e)}")
                # In case of error, wait for 5 minutes before retrying
                logger.info("Retrying in 5 minutes...")
                pause.until(next_run)
                
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
    finally:
        logger.info("Balance Updater stopped")


if __name__ == "__main__":
    main()

