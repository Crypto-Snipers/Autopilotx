#!/usr/bin/env python3
import pymongo
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB connection details
MONGO_URI = os.getenv("MONGO_URL")
DB_NAME = os.getenv("MONGO_DB_NAME")


def update_referral_code_index():
    """
    Update the referral_code index to be sparse, which will only enforce uniqueness
    for documents that actually have a non-null referral_code value.
    """
    try:
        # Connect to MongoDB
        client = pymongo.MongoClient(MONGO_URI)
        db = client[DB_NAME]
        users_collection = db["users"]
        
        # Check if the index exists
        existing_indexes = list(users_collection.list_indexes())
        index_exists = False
        
        for index in existing_indexes:
            if "referral_code_1" in index["name"]:
                index_exists = True
                logger.info(f"Found existing index: {index['name']}")
                break
        
        if index_exists:
            # Drop the existing index
            logger.info("Dropping existing referral_code index...")
            users_collection.drop_index("referral_code_1")
            logger.info("Existing index dropped successfully.")
        
        # Create a new sparse unique index
        logger.info("Creating new sparse unique index for referral_code...")
        users_collection.create_index(
            [("referral_code", pymongo.ASCENDING)],
            unique=True,
            sparse=True,
            name="referral_code_1"
        )
        logger.info("New sparse unique index created successfully.")
        
        # Verify the new index
        new_indexes = list(users_collection.list_indexes())
        for index in new_indexes:
            if "referral_code_1" in index["name"]:
                logger.info(f"New index details: {index}")
        
        return True
    except Exception as e:
        logger.error(f"Error updating index: {str(e)}")
        return False
    finally:
        client.close()


if __name__ == "__main__":
    logger.info("Starting MongoDB index update script...")
    success = update_referral_code_index()
    if success:
        logger.info("MongoDB index update completed successfully.")
    else:
        logger.error("MongoDB index update failed.")

