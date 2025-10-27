import json
import pymongo
from datetime import datetime, UTC
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os.path
import logging
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

# Ensure logs directory exists
os.makedirs('/home/ubuntu/cryptocode/logs', exist_ok=True)

# Configure logging to file and console
logging.basicConfig(
    level=logging.WARNING,  # Changed from INFO to WARNING
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/ubuntu/cryptocode/logs/googleSheet.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('GoogleSheetsSync')

# MongoDB Configuration

MONGO_URI = os.getenv("MONGO_URL")
DB_NAME = os.getenv("MONGO_URL") or "CryptoSniper"

COLLECTION_NAME = "users"

# Google Sheets Configuration
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
SPREADSHEET_ID = "1oBPeWiU3VQS35Gyhep3XJK-v8HAOoZMt5J2hvCkL90s"
SHEET_NAME = "Sheet1"  # Using the default sheet name

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']


def get_google_sheets_service():
    """Initialize and return Google Sheets API service"""
    try:
        # Path to the service account JSON file
        credentials_path = os.path.join(os.path.dirname(__file__), 'VipinGoogleSheetAPI.json')
        
        # Authenticate with Google Sheets API
        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path, scopes=scope)
        
        # Create and return the service
        return build('sheets', 'v4', credentials=credentials, cache_discovery=False)
    
    except Exception as e:
        logger.error(f"Error initializing Google Sheets service: {e}")
        raise


def format_nested_dict(data, prefix=''):
    """Helper function to flatten nested dictionaries with prefixes"""
    result = {}
    if not isinstance(data, dict):
        return {prefix: str(data) if data is not None else ''}
    
    for key, value in data.items():
        new_key = f"{prefix}_{key}" if prefix else key
        if isinstance(value, dict):
            result.update(format_nested_dict(value, new_key))
        elif isinstance(value, (list, tuple)):
            result[new_key] = json.dumps(value, default=str)
        else:
            result[new_key] = str(value) if value is not None else ''
    return result


def get_existing_user_row(service, email):
    """Check if a user with the given email already exists in the sheet and return its row number."""
    try:
        # Get all emails from column B (index 1)
        sheets_service = service.spreadsheets()
        result = sheets_service.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!B:B"
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return None
            
        # Skip header row (row 1) and check each row
        for i, row in enumerate(values[1:], start=2):  # start=2 because of 1-based indexing and we skipped header
            if row and row[0].strip().lower() == email.strip().lower():
                return i  # Return 1-based row number
                
        return None
    except Exception as e:
        logger.error(f"Error checking for existing user in sheet: {e}")
        return None


def update_google_sheet(service, user_data):
    """Legacy function kept for backward compatibility. Triggers a full sync."""
    logger.debug("Individual update triggered full sync")
    export_mongo_to_sheet()


def format_header_requests():
    """Create format requests for headers with colors"""
    # Define colors for different sections
    colors = {
        'user': {'red': 0.8, 'green': 0.9, 'blue': 1.0},  # Light blue
        'status': {'red': 0.85, 'green': 0.92, 'blue': 0.83},  # Light green
        'balance': {'red': 1.0, 'green': 0.85, 'blue': 0.7},  # Light orange
        'broker': {'red': 0.9, 'green': 0.8, 'blue': 1.0},  # Light purple
        'futures': {'red': 0.8, 'green': 1.0, 'blue': 0.9}  # Light mint
    }
    
    # Get all unique strategy names from the database
    mongo_client = pymongo.MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Get all unique strategy names using a simpler approach
    strategy_names = set()
    try:
        users = collection.find({"strategies": {"$exists": True, "$ne": {}}})
        for user in users:
            if 'strategies' in user:
                strategies = user['strategies']
                # Handle case where strategies might be a list or dict
                if isinstance(strategies, dict):
                    strategy_names.update(strategies.keys())
                elif isinstance(strategies, list):
                    # If strategies is a list, we'll assume each item has a 'name' field
                    for strat in strategies:
                        if isinstance(strat, dict) and 'name' in strat:
                            strategy_names.add(strat['name'])
    except Exception as e:
        logger.error(f"Error getting strategy names: {e}")
        strategy_names = set()
    
    # Convert to sorted list, ensuring we have a list even if empty
    strategy_names = sorted(list(strategy_names)) if strategy_names else []
    
    # Define base headers that match the update_google_sheet function
    base_headers = [
        ('Name', 'user'),
        ('Email', 'user'),
        ('Status', 'status'),
        ('Created At', 'user'),
        ('Is Admin', 'user'),
        ('API Verified', 'status'),
        ('Currency', 'balance'),
        ('Balance USDT', 'balance'),
        ('Balance INR', 'balance'),
        ('Broker Connection Name', 'broker'),
        ('Broker Connection ID', 'broker'),
        ('Futures Wallet Currency', 'futures'),
        ('Futures Wallet Balance', 'futures')
    ]
    
    # Add strategy status and multiplier headers
    for strat in strategy_names:
        base_headers.append((f'{strat} Status', 'status'))
        base_headers.append((f'{strat} Multiplier', 'balance'))
    
    # Generate format requests
    format_requests = []
    for i, (_, section) in enumerate(base_headers):
        color = colors.get(section, {'red': 0.9, 'green': 0.9, 'blue': 0.9})  # Default light gray
        format_requests.append({
            'repeatCell': {
                'range': {
                    'sheetId': 0,
                    'startRowIndex': 0,
                    'endRowIndex': 1,
                    'startColumnIndex': i,
                    'endColumnIndex': i + 1
                },
                'cell': {
                    'userEnteredFormat': {
                        'backgroundColor': color,
                        'textFormat': {
                            'bold': True,
                            'fontSize': 11
                        },
                        'horizontalAlignment': 'CENTER',
                        'verticalAlignment': 'MIDDLE',
                        'wrapStrategy': 'WRAP'
                    }
                },
                'fields': 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)'
            }
        })
    
    # Add filter
    format_requests.append({
        'setBasicFilter': {
            'filter': {
                'range': {
                    'sheetId': 0,
                    'startRowIndex': 0,
                    'endRowIndex': 1,
                    'startColumnIndex': 0,
                    'endColumnIndex': len(base_headers)
                }
            }
        }
    })
    
    # Extract just the header names for the return value
    headers = [header for header, _ in base_headers]
    
    return format_requests, headers


def watch_users_collection():
    """Watch the users collection for changes and update Google Sheet on inserts and updates."""
    try:
        # Initialize Google Sheets service
        sheets_service = get_google_sheets_service()
        
        # Initialize MongoDB client
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_collection = db[COLLECTION_NAME]
        
        # Create headers in the sheet if it's empty
        try:
            sheets_service.values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_NAME}!A1:AC1"
            ).execute()
            
        except HttpError as e:
            if e.resp.status == 404:
                # Get formatted headers and create format requests
                format_requests, header_values = format_header_requests()
                
                # First, set the header values
                sheets_service.values().update(
                    spreadsheetId=SPREADSHEET_ID,
                    range=f"{SHEET_NAME}!A1",
                    valueInputOption="USER_ENTERED",
                    body={'values': [header_values]}
                ).execute()
                
                # Then apply formatting
                if format_requests:
                    sheets_service.batchUpdate(
                        spreadsheetId=SPREADSHEET_ID,
                        body={'requests': format_requests}
                    ).execute()
                
                # Set column widths
                sheets_service.batchUpdate(
                    spreadsheetId=SPREADSHEET_ID,
                    body={
                        'requests': [{
                            'updateDimensionProperties': {
                                'range': {
                                    'sheetId': 0,
                                    'dimension': 'COLUMNS',
                                    'startIndex': 0,
                                    'endIndex': len(header_values)
                                },
                                'properties': {
                                    'pixelSize': 150  # Default width
                                },
                                'fields': 'pixelSize'
                            }
                        }]
                    }
                ).execute()
        
        logger.debug("Starting user change watcher")
        
        # Initial sync of all users
        try:
            logger.debug("Starting initial user sync")
            all_users = users_collection.find({})
            for user in all_users:
                try:
                    update_google_sheet(sheets_service, user)
                except Exception as e:
                    logger.error(f"Error syncing user {user.get('email')}: {e}")
            logger.debug("Initial sync completed")
        except Exception as e:
            logger.error(f"Error during initial sync: {e}")
        
        # Watch the users collection for changes (both inserts and updates)
        with users_collection.watch([{
            '$match': {
                '$or': [
                    {'operationType': 'insert'},
                    {'operationType': 'update'},
                    {'operationType': 'replace'}
                ]
            }
        }]) as stream:
            for change in stream:
                try:
                    operation_type = change['operationType']
                    
                    if operation_type == 'insert':
                        user_data = change['fullDocument']
                        logger.debug(f"New user: {user_data.get('email')}")
                        update_google_sheet(sheets_service, user_data)
                        
                    elif operation_type in ['update', 'replace']:
                        # For updates, we need to fetch the full document
                        user_id = change['documentKey']['_id']
                        user_data = users_collection.find_one({'_id': user_id})
                        if user_data:
                            logger.debug(f"Updated user: {user_data.get('email')}")
                            update_google_sheet(sheets_service, user_data)
                            
                except Exception as e:
                    logger.error(f"Error processing change: {e}")
                    continue
                    
    except KeyboardInterrupt:
        logger.debug("Stopping user watcher")
    except Exception as e:
        logger.error(f"Error in watch_users_collection: {e}")
    finally:
        if 'client' in locals():
            client.close()


def fetch_sheet_rows(service):
    result = service.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=f"{SHEET_NAME}"
    ).execute()
    values = result.get('values', [])
    return values


def format_user_row(user):
    """Format a single user's data into a row for the sheet."""
    flat_data = format_nested_dict(user)
    
    # Create a row with all required fields
    row = [
        flat_data.get('name', ''),
        flat_data.get('email', ''),
        flat_data.get('status', ''),
        flat_data.get('created_at', datetime.utcnow().isoformat()),
        flat_data.get('is_admin', ''),
        flat_data.get('api_verified', ''),
        flat_data.get('currency', ''),
        flat_data.get('balance_usdt', ''),
        flat_data.get('balance_inr', ''),
        flat_data.get('broker_connection_broker_name', ''),
        flat_data.get('broker_connection_broker_id', ''),
        flat_data.get('futures_wallets_INR_currency_short_name', ''),
        flat_data.get('futures_wallets_INR_balance', ''),
    ]
    
    # Add strategy status and multiplier values
    strategies = user.get('strategies', {})
    if isinstance(strategies, dict):
        for strat in sorted(strategies.keys()):
            row.append(str(strategies[strat].get('status', '')))
            row.append(str(strategies[strat].get('multiplier', '')))
    
    return row


def get_headers(users):
    """Generate headers based on the available user data."""
    base_headers = [
        'Name', 'Email', 'Status', 'Created At', 'Is Admin',
        'API Verified', 'Currency', 'Balance USDT', 'Balance INR',
        'Broker Connection Name', 'Broker Connection ID',
        'Futures Wallet Currency', 'Futures Wallet Balance'
    ]
    
    # Collect all unique strategy names
    strategy_headers = []
    strategy_set = set()
    
    for user in users:
        strategies = user.get('strategies', {})
        if isinstance(strategies, dict):
            for strat in strategies.keys():
                strategy_set.add(strat)
    
    # Add strategy status and multiplier headers
    for strat in sorted(strategy_set):
        strategy_headers.append(f'{strat} Status')
        strategy_headers.append(f'{strat} Multiplier')
    
    return base_headers + strategy_headers


def export_mongo_to_sheet():
    """Synchronize all users from MongoDB to Google Sheet by rebuilding the entire sheet."""
    try:
        logger.debug("Starting MongoDB sync")
        # Initialize Google Sheets service
        service = get_google_sheets_service()
        sheets_service = service.spreadsheets()
        
        # Initialize MongoDB client
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_collection = db[COLLECTION_NAME]
        
        # Get all users from MongoDB
        users = list(users_collection.find({}))
        
        if not users:
            logger.debug("No users in MongoDB")
            return
        
        # Generate headers and rows
        headers = get_headers(users)
        rows = []
        
        # Format each user's data
        for user in users:
            try:
                user_email = user.get('email', '').strip().lower()
                if not user_email:
                    logger.warning(f"Skipping user with missing email: {user.get('_id')}")
                    continue
                
                row = format_user_row(user)
                rows.append(row)
                
            except Exception as e:
                logger.error(f"Error formatting user {user.get('email')}: {e}")
                continue
        
        # Clear the entire sheet
        try:
            sheets_service.values().clear(
                spreadsheetId=SPREADSHEET_ID,
                range=SHEET_NAME,
                body={}
            ).execute()
        except Exception as e:
            logger.warning(f"Error clearing sheet: {e}")
        
        # Add headers and data in a single batch update
        if rows:
            # Combine headers and data
            data = [headers] + rows
            
            # Update the sheet with all data at once
            sheets_service.values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_NAME}!A1",
                valueInputOption="USER_ENTERED",
                body={"values": data}
            ).execute()
            
            # Apply formatting to headers
            format_requests, _ = format_header_requests()
            if format_requests:
                try:
                    sheets_service.batchUpdate(
                        spreadsheetId=SPREADSHEET_ID,
                        body={'requests': format_requests}
                    ).execute()
                except Exception as e:
                    logger.error(f"Error applying formatting: {e}")
            
            logger.info(f"Synced {len(rows)} users")
        else:
            logger.warning("No valid user data to sync.")
        
    except Exception as e:
        logger.error(f"Error in export_mongo_to_sheet: {e}")
        raise


def poll_sheet_for_status_changes(interval=30):
    service = get_google_sheets_service()
    status_cache = {}
    logger.info("Starting Google Sheet status polling...")
    while True:
        try:
            rows = fetch_sheet_rows(service)
            if not rows or len(rows) < 2:
                logger.info("Sheet is empty or only has header.")
                time.sleep(interval)
                continue
            header = rows[0]
            email_idx = None
            status_idx = None
            for i, col in enumerate(header):
                if col.strip().lower() == 'email':
                    email_idx = i
                if col.strip().lower() == 'status':
                    status_idx = i
            if email_idx is None or status_idx is None:
                logger.error("Could not find 'email' or 'status' column in sheet header.")
                time.sleep(interval)
                continue
            for row in rows[1:]:
                if len(row) <= max(email_idx, status_idx):
                    continue
                email = row[email_idx].strip().lower()
                status = row[status_idx].strip().lower()
                prev_status = status_cache.get(email)
                if prev_status == 'pending' and status == 'approved':
                    update_mongo_status(email, 'approved')
                    logger.info(f"Updated {email} to approved in MongoDB")
                status_cache[email] = status
        except Exception as e:
            logger.error(f"Error in polling loop: {e}")
        time.sleep(interval)


def update_mongo_status(email: str, new_status: str) -> bool:
    """
    Update user status in MongoDB
    
    Args:
        email: User's email address
        new_status: New status to set (e.g., 'approved', 'rejected', 'pending')
        
    Returns:
        bool: True if the update was successful, False otherwise
    """
    client = None
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_collection = db[COLLECTION_NAME]
        
        # Prepare update data
        update_data = {
            'status': new_status,
            'updated_at': datetime.now(UTC).isoformat(),
            'is_active': True
        }
        
        # Additional fields for approved users
        if new_status.lower() == 'approved':
            update_data.update({
                'approved_at': datetime.now(UTC).isoformat(),
                'is_active': True
            })
        
        # Perform the update
        result = users_collection.update_one(
            {'email': email},
            {'$set': update_data}
        )
        
        # Log the result
        if result.matched_count > 0:
            logger.info(f"Successfully updated {email} to status '{new_status}' in MongoDB")
        else:
            logger.warning(f"No user found with email {email} to update status to '{new_status}'")
            
        return result.matched_count > 0
        
    except Exception as e:
        logger.error(f"Error updating MongoDB status for {email} to {new_status}: {e}", exc_info=True)
        return False
        
    finally:
        # Ensure the client is always closed
        if client:
            client.close()


def update_sheet_with_new_pending_users(last_checked=None):
    """Check for new pending users since last check and update the sheet"""
    try:
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_collection = db[COLLECTION_NAME]
        
        # Build query to find new pending users
        query = {"status": "pending"}
        if last_checked:
            query["created_at"] = {"$gt": last_checked}
        
        # Find new pending users sorted by created_at
        new_users = list(users_collection.find(
            query,
            {"referral_code": 0, "invited_by": 0, "referral_count": 0}
        ).sort("created_at", pymongo.ASCENDING))
        
        if not new_users:
            logger.info("No new pending users found.")
            return datetime.utcnow()
            
        logger.info(f"Found {len(new_users)} new pending users to add to sheet.")
        
        # Get existing data to append to
        service = get_google_sheets_service()
        result = service.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}"
        ).execute()
        
        existing_data = result.get('values', [])
        
        # Process new users
        for user in new_users:
            flat_data = format_nested_dict(user)
            row = [
                flat_data.get('_id', ''),
                flat_data.get('name', ''),
                flat_data.get('email', ''),
                flat_data.get('status', ''),
                flat_data.get('approved_at', ''),
                flat_data.get('created_at', ''),
                flat_data.get('is_admin', ''),
                flat_data.get('is_active', ''),
                flat_data.get('api_verified', ''),
                flat_data.get('api_verified_at', ''),
                flat_data.get('currency', ''),
                flat_data.get('balance_usdt', ''),
                flat_data.get('balance_inr', ''),
                flat_data.get('used_margin_usdt', ''),
                flat_data.get('used_margin_inr', ''),
                flat_data.get('free_margin_usdt', ''),
                flat_data.get('free_margin_inr', ''),
                flat_data.get('broker_connection_broker_name', ''),
                flat_data.get('broker_connection_broker_id', ''),
                flat_data.get('broker_connection_app_name', ''),
                flat_data.get('broker_connection_api_key', ''),
                flat_data.get('broker_connection_status', ''),
                flat_data.get('broker_connection_verified_at', ''),
                flat_data.get('futures_wallets_INR_id', ''),
                flat_data.get('futures_wallets_INR_currency_short_name', ''),
                flat_data.get('futures_wallets_INR_balance', ''),
                flat_data.get('futures_wallets_INR_locked_balance', ''),
                flat_data.get('futures_wallets_INR_cross_order_margin', ''),
                flat_data.get('futures_wallets_INR_cross_user_margin', '')
            ]
            
            # Append the new row
            service.values().append(
                spreadsheetId=SPREADSHEET_ID,
                range=f"{SHEET_NAME}!A1",
                valueInputOption="USER_ENTERED",
                insertDataOption="INSERT_ROWS",
                body={"values": [row]}
            ).execute()
        
        logger.info(f"Added {len(new_users)} new pending users to the sheet.")
        return datetime.utcnow()
        
    except Exception as e:
        logger.error(f"Error updating sheet with new pending users: {e}")
        return last_checked or datetime.utcnow()
    finally:
        if 'client' in locals():
            client.close()


def watch_google_sheet_changes():
    """Watch for status changes in the Google Sheet and update MongoDB accordingly"""
    try:
        # Initialize the Google Sheets service
        service = get_google_sheets_service()
        sheets_service = service.spreadsheets()
        
        # Get the current state of the sheet
        result = sheets_service.values().get(
            spreadsheetId=SPREADSHEET_ID,
            range=SHEET_NAME,
            valueRenderOption='FORMATTED_VALUE'
        ).execute()
        
        values = result.get('values', [])
        
        if not values or len(values) < 2:  # Need at least header + 1 row
            logger.info('No data found in sheet or only headers present.')
            return
            
        # Get header indices
        headers = [h.lower() for h in values[0]]
        rows = values[1:]
        
        # Find the status column index
        try:
            status_idx = headers.index('status')
            email_idx = headers.index('email')
        except ValueError as e:
            logger.error(f"Required columns not found in sheet: {e}")
            return
        
        # Process each row
        for i, row in enumerate(rows, start=2):  # +2 for 1-based index and header row
            try:
                if len(row) <= max(status_idx, email_idx):
                    continue  # Skip incomplete rows
                    
                email = row[email_idx].strip()
                status = row[status_idx].strip().lower() if status_idx < len(row) else ''
                
                if not email or not status:
                    continue  # Skip rows without email or status
                
                # Check if status is 'approved' or other status you want to handle
                if status in ['approved', 'rejected', 'pending']:  # Add other statuses as needed
                    # Update MongoDB with the new status
                    update_mongo_status(email, status.capitalize())
                
            except Exception as e:
                logger.error(f"Error processing row {i} (email: {email if 'email' in locals() else 'N/A'}): {str(e)}")
                
    except Exception as e:
        logger.error(f"Error watching Google Sheet changes: {e}")
        raise  # Re-raise to handle in the main loop


def main():
    # Keep only critical startup messages
    logger.info("Starting Google Sheet sync service...")
    logger.info("Starting initial sync from MongoDB to Google Sheets...")
    export_mongo_to_sheet()
    
    logger.info("Status monitor started (Ctrl+C to stop)")
    try:
        while True:
            start_time = time.time()
            
            # Check for status changes in Google Sheet and update MongoDB
            watch_google_sheet_changes()
            
            # Optional: Periodically refresh the sheet from MongoDB (e.g., every hour)
            if int(time.time() - start_time) % 3600 < 30:  # Roughly every hour
                logger.debug("Performing periodic refresh")
                export_mongo_to_sheet()
            
            # Calculate sleep time (30 seconds between checks)
            time_taken = time.time() - start_time
            sleep_time = max(30 - time_taken, 0)
            
            if sleep_time > 0:
                logger.debug(f"Status check completed in {time_taken:.1f}s")
                time.sleep(sleep_time)
                
    except KeyboardInterrupt:
        logger.info("Stopping status monitor...")
    except Exception as e:
        logger.error(f"Fatal error in status monitor: {e}")
        exit(1)


if __name__ == "__main__":
    # Check if the SPREADSHEET_ID environment variable is set
    if not SPREADSHEET_ID:
        logger.error("GOOGLE_SHEET_ID environment variable is not set")
        exit(1)

    # Check if the credentials file exists
    credentials_path = os.path.join(os.path.dirname(__file__), 'VipinGoogleSheetAPI.json')
    if not os.path.exists(credentials_path):
        logger.error(f"VipinGoogleSheetAPI.json file not found at {credentials_path}. Please ensure it exists in the same directory as googleSheet.py")
        exit(1)

    main()

