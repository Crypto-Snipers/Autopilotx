import logging
import os
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv

# Import MongoDBConnection from your library
from mongodb_library import MongoDBConnection

# Import the Notification model from Constant.py
from Constant import Notification

# Configure a logger for this service
logger = logging.getLogger("notification_service")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
handler.setFormatter(formatter)
logger.addHandler(handler)

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL") 
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME")


class NotificationService:
    """
    A service for managing user notifications in a MongoDB database.

    This class provides methods to create, retrieve, and update
    notification records.  It utilizes the MongoDBConnection class for
    database interactions and relies on the Notification Pydantic model
    for data structure and validation.
    """

    def __init__(
        self,
        database_url: str=MongoDBConnection.CONNECTION_STRING,
        db_name: str=MONGO_DB_NAME,
    ):
        """
        Initializes the NotificationService.

        Args:
            database_url (str): MongoDB connection string. Defaults to
                MongoDBConnection.CONNECTION_STRING.
            db_name (str): Name of the database to use. Defaults to
                "CryptoSniper".
        """
        self.mongo_conn = MongoDBConnection(
            connection_string=database_url, database_name=db_name
        )
        self.notifications_collection = (
            self.mongo_conn.get_async_database().notifications
        )
        logger.info(f"NotificationService initialized. Using DB: {db_name}")

    async def initialize_indexes(self):
        """
        Ensures necessary indexes are created on the 'notifications'
        collection to optimize query performance.
        """
        try:  # Start a try block to catch any potential errors during index creation.
            # Create an ascending index on the 'user_type' field.
            # This optimizes queries that filter notifications by user type.
            # 'background=True' ensures the index creation doesn't block other
            # database operations.
            await self.notifications_collection.create_index(
                [("user_type", 1)], background=True
            )
            # Create an ascending index on the 'is_read' field.
            # This optimizes queries that filter notifications by their read status.
            await self.notifications_collection.create_index(
                [("is_read", 1)], background=True
            )
            # Create a descending index on the 'created_at' field.
            # This is crucial for efficiently retrieving the most recent
            # notifications, as they are often sorted by creation time.
            await self.notifications_collection.create_index(
                [("created_at", -1)], background=True
            )
            # Create an ascending index on the 'start_time' field.
            # This can be useful for notifications that are scheduled to appear
            # from a certain time.
            await self.notifications_collection.create_index(
                [("start_time", 1)], background=True
            )
            # Log a success message once all indexes have been created or ensured.
            logger.info("Indexes for 'notifications' collection ensured.")
        except (
            Exception
        ) as e:  # Catch any exception that occurs during the process.
            # Log an error message if index creation fails, including the exception.
            logger.error(
                "Error ensuring indexes for 'notifications' collection: %s", e
            )

    async def create_notification(
        self, notification: Notification
    ) -> Notification:
        """Inserts a new notification into the database.

        Args:
            notification (Notification): The notification to create.

        Returns:
            Notification: The created notification with its ID.
        """
        try:
            # Convert the Pydantic model to a dictionary
            notification_dict = notification.model_dump(
                exclude_unset=True, exclude_none=True, by_alias=True
            )
            
            # Remove None _id to let MongoDB generate a new one
            if "_id" in notification_dict and notification_dict["_id"] is None:
                del notification_dict["_id"]

            # Insert the notification into the database
            result = await self.notifications_collection.insert_one(notification_dict)
            
            # Fetch the complete document to ensure we have all fields
            created_doc = await self.notifications_collection.find_one(
                {"_id": result.inserted_id}
            )
            
            # Convert ObjectId to string for the id field
            created_doc["_id"] = str(created_doc["_id"])
            
            # Create the notification model
            created_notification = Notification.model_validate(created_doc)
            
            logger.info(
                "Notification created with ID: %s for user_type: %s",
                created_notification.id,
                created_notification.user_type,
            )
            return created_notification
        except Exception as e:
            logger.error("Error creating notification: %s", str(e))
            raise

    async def get_notification(
        self, notification_id: str
    ) -> Optional[Notification]:
        """Retrieves a single notification from the database by its ID.

        Args:
            notification_id: The unique identifier of the notification.

        Returns:
            The Notification object if found, otherwise None.
        """
        try:
            try:
                obj_id = ObjectId(notification_id)
            except InvalidId:
                logger.warning("Invalid notification ID format: %s", notification_id)
                return None
                
            # Find the document by _id
            doc = await self.notifications_collection.find_one({"_id": obj_id})
            if not doc:
                logger.warning("Notification with ID %s not found", notification_id)
                return None
                
            # Convert ObjectId to string for the id field
            doc['_id'] = str(doc['_id'])
            
            # Convert datetime fields to timezone-aware if they aren't already
            for field in ['start_time', 'created_at', 'last_updated_at']:
                if field in doc and doc[field] and doc[field].tzinfo is None:
                    doc[field] = doc[field].replace(tzinfo=timezone.utc)
            
            # Convert to Notification model
            return Notification.model_validate(doc)
            
        except Exception as e:
            logger.error("Error retrieving notification: %s", str(e))
            return None

    async def get_notifications(
        self,
        user_type: Optional[str]=None,
        is_read: Optional[bool]=None,
        platform: Optional[str]=None,
        notification_type: Optional[str]=None,
        skip: int=0,
        limit: int=100,
    ) -> List[Notification]:
        """Retrieves notifications based on filters.

        Args:
            user_type (Optional[str]): Filter by user type.
            is_read (Optional[bool]): Filter by read status.
            platform (Optional[str]): Filter by platform.
            notification_type (Optional[str]): Filter by notification type.
            skip (int): Number of documents to skip for pagination. Defaults to 0.
            limit (int): Maximum number of documents to return. Defaults to 100.

        Returns:
            List[Notification]: A list of Notification objects matching the criteria.
        """
        try:
            query: Dict[str, Any] = {}
            if user_type:
                query["user_type"] = user_type.upper()
            if is_read is not None:
                query["is_read"] = is_read
            if platform:
                query["platform"] = platform
            if notification_type:
                query["notification_type"] = notification_type

            notifications = []
            cursor = self.notifications_collection.find(query).sort("start_time", -1).skip(skip).limit(limit)
            
            async for doc in cursor:
                try:
                    # Convert ObjectId to string for the id field
                    doc['_id'] = str(doc['_id'])
                    # Convert datetime fields to timezone-aware if they aren't already
                    for field in ['start_time', 'created_at', 'last_updated_at']:
                        if field in doc and doc[field] and doc[field].tzinfo is None:
                            doc[field] = doc[field].replace(tzinfo=timezone.utc)
                    notifications.append(Notification.model_validate(doc))
                except Exception as e:
                    logger.error("Error processing notification %s: %s", doc.get('_id'), str(e))
            
            logger.info(
                "Retrieved %s notifications with query %s",
                len(notifications),
                query,
            )
            return notifications
        except Exception as e:
            logger.error("Error retrieving notifications: %s", str(e))
            raise

    async def mark_notification_as_read(self, notification_id: str) -> bool:
        """
        Marks a notification as read.

        Args:
            notification_id: The ID of the notification to mark as read.

        Returns:
            True if the notification was successfully marked as read,
            False otherwise.
        """
        try:
            try:
                obj_id = ObjectId(notification_id)
            except InvalidId:
                logger.warning("Invalid notification ID format: %s", notification_id)
                return False
            
            update_data = {
                "$set": {
                    "is_read": True,
                    "last_updated_at": datetime.now(timezone.utc),
                }
            }
            
            result = await self.notifications_collection.update_one(
                {"_id": obj_id},
                update_data
            )
            
            if result.modified_count == 1:
                logger.info("Notification %s marked as read.", notification_id)
                return True
            else:
                logger.warning(
                    "Notification %s not found or already marked as read.",
                    notification_id,
                )
                return False
        except Exception as e:
            logger.error("Error marking notification as read: %s", str(e))
            return False

    async def mark_notification_as_dismissed(
        self, notification_id: str
    ) -> bool:
        """
        Marks a notification as dismissed.

        Args:
            notification_id: The ID of the notification to mark as dismissed.

        Returns:
            True if the notification was successfully marked as dismissed,
            False otherwise.
        """
        try:
            try:
                obj_id = ObjectId(notification_id)
            except InvalidId:
                logger.warning("Invalid notification ID format: %s", notification_id)
                return False
            
            update_data = {
                "$set": {
                    "is_dismissed": True,
                    "last_updated_at": datetime.now(timezone.utc),
                }
            }
            
            result = await self.notifications_collection.update_one(
                {"_id": obj_id},
                update_data
            )
            
            if result.modified_count == 1:
                logger.info(
                    "Notification %s marked as dismissed.", notification_id
                )
                return True
            else:
                logger.warning(
                    "Notification %s not found or already dismissed.",
                    notification_id,
                )
                return False
        except Exception as e:
            logger.error("Error marking notification as dismissed: %s", str(e))
            return False

    async def close_connection(self):
        """
        Closes the MongoDB client connection managed by MongoDBConnection.
        """
        if hasattr(self, 'mongo_conn') and self.mongo_conn is not None:
            try:
                await self.mongo_conn.close_connection()
                logger.info("MongoDB connection closed successfully.")
            except Exception as e:
                logger.error("Error closing MongoDB connection: %s", str(e))
            finally:
                self.mongo_conn = None


if __name__ == "__main__":
    import asyncio
    import sys

    async def main_test_notification_service():
        try:
            load_dotenv()
            MONGO_URI = os.getenv("MONGO_URL")
            DB_NAME = os.getenv("MONGO_DB_NAME")

            if not MONGO_URI or not DB_NAME:
                print("Error: MONGO_URL and MONGO_DB_NAME must be set in .env file")
                sys.exit(1)

            service = NotificationService(database_url=MONGO_URI, db_name=DB_NAME)
            
            print("Initializing indexes...")
            await service.initialize_indexes()

            # Test creating a notification
            print("\n--- Creating Test Notification ---")
            new_notif = Notification(
                title="System Maintenance",
                message="Scheduled maintenance will occur on Saturday at 2 AM UTC.",
                user_type="ADMIN",
                start_time=datetime.now(timezone.utc),
                created_by="system@example.com",
                platform="WEB",
                notification_type="INFO"
            )
            
            created_notif = await service.create_notification(new_notif)
            print(f"Created notification with ID: {created_notif.id}")
            print(f"Notification details: {created_notif.model_dump_json(indent=2)}")

            # Test retrieving the notification by ID
            print("\n--- Retrieving Notification by ID ---")
            retrieved = await service.get_notification(created_notif.id)
            if retrieved:
                print(f"Retrieved notification: {retrieved.model_dump_json(indent=2)}")
            else:
                print("Failed to retrieve the created notification")

            # Test getting all notifications
            print("\n--- Listing All Notifications ---")
            all_notifs = await service.get_notifications()
            print(f"Found {len(all_notifs)} notifications:")
            for i, notif in enumerate(all_notifs, 1):
                print(f"{i}. {notif.title} ({notif.notification_type}) - {notif.message[:50]}...")

            # Test marking as read
            print("\n--- Marking Notification as Read ---")
            if all_notifs:
                success = await service.mark_notification_as_read(all_notifs[0].id)
                print(f"Marked as read: {success}")
                
                # Verify read status
                updated = await service.get_notification(all_notifs[0].id)
                print(f"Read status updated: {updated.is_read if updated else 'Not found'}")

        except Exception as e:
            print(f"Error in test: {str(e)}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            return 1
        finally:
            if 'service' in locals():
                await service.close_connection()
        return 0

    # Run the test
    sys.exit(asyncio.run(main_test_notification_service()))
