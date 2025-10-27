import asyncio
import logging
import argparse
from datetime import datetime
from dotenv import load_dotenv
import os

load_dotenv()

# Import MongoDBConnection from your library
from mongodb_library import MongoDBConnection

# Import Notification model and NotificationService
from Constant import Notification
from notification_service import NotificationService
from pymongo.errors import PyMongoError
# from emailSender import send_welcome_email, send_approval_email

# Configure a logger for this watcher
logger = logging.getLogger("user_notification_watcher")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Add handler only if it's not already present to prevent duplicate logs
if not logger.handlers:
    handler.setFormatter(formatter)
    logger.addHandler(handler)


class UserNotificationWatcher:
    """
    Watches the 'users' collection for new inserts and creates welcome
    notifications for new users.
    """

    def __init__(
        self,
        # Default to MongoDBConnection's string, which handles its own env var
        database_url: str=MongoDBConnection.CONNECTION_STRING,
        # Default to environment variable, then hardcoded value
        db_name: str="CryptoSniperDev",
    ):
        """
        Initializes the UserNotificationWatcher.

        Args:
            database_url (str): MongoDB connection string.
            db_name (str): Name of the database to connect to.
        """
        self.mongo_conn = MongoDBConnection(
            connection_string=database_url, database_name=db_name
        )
        self.users_collection = self.mongo_conn.get_async_database().users
        self.notification_service = NotificationService(
            database_url=database_url, db_name=db_name
        )
        logger.info(f"UserNotificationWatcher initialized for DB: {db_name}")

    async def start_watching(self):
        """Starts watching the users collection for new inserts."""
        logger.info("Starting to watch 'users' collection for new inserts...")

        # Ensure notifications collection indexes are ready
        await self.notification_service.initialize_indexes()

        # Define the pipeline to filter for 'insert' and 'update' operations
        pipeline = [
            {"$match": {"operationType": {"$in": ["insert", "update"]}}}
        ]

        # 'full_document' is set to 'updateLookup' to get the
        # complete document after an update.
        try:
            async with self.users_collection.watch(
                pipeline, full_document="updateLookup"
            ) as change_stream:
                async for change in change_stream:
                    operation_type = change["operationType"]
                    logger.info(
                        f"Change detected in 'users' collection: {operation_type}"
                    )

                    if operation_type == "insert":
                        new_user = change["fullDocument"]
                        await self.process_new_user(new_user)
                    elif operation_type == "update":
                        updated_fields = change.get(
                            "updateDescription", {}
                        ).get("updatedFields", {})
                        full_document = change.get("fullDocument")

                        if (
                            full_document
                            and "status" in updated_fields
                            and full_document.get("status") == "Approved"
                        ):
                            await self.process_approved_user(full_document)
                        # Add other update handlers here if needed
        except PyMongoError as e:
            # Log the error with traceback for better debugging
            logger.error(
                "Error in change stream for 'users' collection: " f"{e}",
                exc_info=True,
            )
            # Attempt to restart the watcher for resilience after a delay
            # This prevents rapid-fire restarts in case of persistent issues
            logger.info("Attempting to restart watcher in 10 seconds...")
            await asyncio.sleep(10)
            await self.start_watching()  # Attempt to restart the watcher

    async def process_new_user(self, user_data: dict):
        """Processes a new user document to create a welcome notification."""
        user_email = user_data.get("email", "unknown@example.com")
        logger.info(
            f"New user '{user_email}' detected. Creating welcome notification."
        )

        # Construct the welcome notification using the Notification model.
        welcome_notification = Notification(
            title="Welcome to CryptoSnipers!",
            message=(
                f"Hello {user_data.get('name', 'there')}, welcome to "
                "CryptoSnipers! We're excited to have you. Explore our "
                "features and start trading."
            ),  # Use the user's email as the user_type for specific targeting
            user_type=user_email,
            is_read=False,
            is_dismissed=False,
            start_time=datetime.utcnow(),  # Use UTC for consistency
            created_by="system@cryptosnipers.com",
            platform="WEB",  # Assuming registration via web
            notification_type="Welcome",
            send_email=False,  # As per requirement, only update collection
        )

        # send_welcome_email(recipient_email=user_email)

        try:
            await self.notification_service.create_notification(
                welcome_notification
            )
            logger.info(f"Welcome notification created for user: {user_email}")
        except Exception as e:
            # Log the failure with user-specific context and traceback
            logger.error(
                "Failed to create welcome notification for "
                f"{user_email}: {e}",
                exc_info=True,
            )

    async def process_approved_user(self, user_data: dict):
        """Processes an approved user document to create an approval notification."""
        user_email = user_data.get("email", "unknown@example.com")
        user_name = user_data.get("name", "there")
        logger.info(
            f"User '{user_email}' status changed to 'approved'. Creating approval notification."
        )

        # Construct the approval notification
        approved_notification = Notification(
            title="Approved",
            message=f"Hello {user_name}, you have been approved for trading!",
            user_type=user_email,
            is_read=False,
            is_dismissed=False,
            start_time=datetime.utcnow(),
            created_by="system@cryptosnipers.com",
            platform="WEB",
            notification_type="Approved",
            send_email=False,
        )

        # send_approval_email(recipient_email=user_email)
        
        try:
            await self.notification_service.create_notification(
                approved_notification
            )
            logger.info(
                f"Approval notification created for user: {user_email}"
            )
        except Exception as e:
            logger.error(
                "Failed to create approval notification for "
                f"{user_email}: {e}",
                exc_info=True,
            )

    async def close(self):
        """
        Closes all underlying connections (notification service and MongoDB).
        Ensures graceful shutdown and resource release.
        """
        await self.notification_service.close_connection()
        await self.mongo_conn.close_connection()
        logger.info("UserNotificationWatcher connections closed.")


# Main execution block
if __name__ == "__main__":
    database_url = os.getenv("MONGO_URL")
    db_name = os.getenv("MONGO_DB_NAME")

    if not database_url:
        logger.error("MONGO_URL environment variable is not set")
        exit(1)

    # Setup argument parser
    parser = argparse.ArgumentParser(
        description="Watches for new user registrations and creates "
        "welcome notifications."
    )
    parser.add_argument(
        "--database-url",
        type=str,
        default=database_url,
        help="MongoDB connection string. Defaults to the value in "
        "MongoDBConnection.",
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default=db_name,
        help="MongoDB database name. Defaults to DATABASE_NAME env var or "
        "'CryptoSniper'.",
    )
    args = parser.parse_args()

    async def main():
        # Instantiate watcher with arguments from command line
        watcher = UserNotificationWatcher(
            database_url=args.database_url, db_name=args.db_name
        )
        try:
            await watcher.start_watching()
        except KeyboardInterrupt:
            logger.info("Watcher stopped by user.")
        finally:
            await watcher.close()

    # Run the main asynchronous function
    asyncio.run(main())
