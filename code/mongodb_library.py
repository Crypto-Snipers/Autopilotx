# mongodb_library.py
"""
MongoDB Library for handling synchronous and asynchronous database operations.

This module provides a robust class for managing MongoDB connections,
initializing both a synchronous (PyMongo) and an asynchronous (Motor)
client from a single configuration. It uses a lazy initialization
pattern, meaning clients are only created when first accessed, ensuring
resource efficiency.
"""

import logging
import os
import argparse
import sys 
import json 
from typing import Any, Dict, List, Optional

from pymongo import MongoClient
from pymongo.collection import Collection
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, OperationFailure


# --- Global Logging Setup ---
def setup_logging(debug_mode: bool=False):
    """
    Setup logging configuration.

    Configures the root logger to output to both a file
    (`mongodb_connections.log`) and the console (stdout).

    Args:
        debug_mode (bool): If True, sets logging level to DEBUG for more
                           verbose output. Otherwise, sets to INFO.
    """
    log_level = logging.DEBUG if debug_mode else logging.INFO
    # Avoid adding duplicate handlers if setup_logging is called multiple times
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=log_level,
            format=(
                "%(asctime)s - %(name)s - %(levelname)s - "
                "%(filename)s:%(lineno)d - %(message)s"
            ),
            handlers=[
                logging.FileHandler("mongodb_connections.log"),
                logging.StreamHandler(),
            ],
        )


# --- MongoDBConnection class ---
class MongoDBConnection:
    """
    Manages the MongoDB server connection and provides access to databases.
    It encapsulates the client connection logic, creating both a synchronous
    (PyMongo) and an asynchronous (Motor) client lazily upon first access.
    """

    # SECURITY ISSUE: Hardcoding sensitive information (like this connection
    # string with credentials) is a major security vulnerability. Anyone
    # with access to this code will have direct database access.
    #
    # HOW TO ADDRESS THIS:
    # 1. Use Environment Variables: Load this string from an environment
    #    variable (e.g., `os.getenv("MONGO_CONNECTION_STRING")`). This keeps
    #    sensitive data out of your codebase.
    # 2. Secrets Management Services: For higher security and
    #    enterprise-level applications, integrate with dedicated secrets
    #    management services (e.g., AWS Secrets Manager, Azure Key Vault,
    #    HashiCorp Vault) to retrieve credentials securely at runtime.
    #
    # For demonstration, a hardcoded default is used, but in production,
    # this should be loaded securely.
    
    CONNECTION_STRING = os.getenv("MONGO_URL")

    def __init__(
        self,
        connection_string: Optional[str]=None,
        database_name: Optional[str]=None,
        # New individual components for connection string construction
        scheme: str="mongodb+srv",
        username: Optional[str]=None,
        password: Optional[str]=None,
        host: Optional[str]=None,
        path_db_name: Optional[str]=None,
        options: Optional[str]=None,
        **kwargs,
    ):
        """
        Initializes a new MongoDB connection.

        This constructor supports multiple ways to provide connection
        details, with a clear order of precedence:
        1. A full `connection_string` argument (highest priority).
        2. Individual connection components (`host`, `username`, `password`,
           `scheme`, `path_db_name`, `options`). The `host` parameter is
           essential if using this method.
        3. The environment variable `MONGO_CONNECTION_STRING` or the
        2. Individual connection components (`host`, `username`, `password`,
           `scheme`, `path_db_name`, `options`). The `host` parameter is
           essential if using this method.
        3. The environment variable `MONGO_CONNECTION_STRING` or the
           hardcoded `MongoDBConnection.CONNECTION_STRING` (lowest
           priority/fallback).

        This constructor does NOT establish a connection immediately. It
        prepares the connection details. The actual client objects are
        created and connections are made only when the `client` or
        `async_client` properties are first accessed.

        Args:
            connection_string (Optional[str]): A complete MongoDB connection
                                               URI (e.g.,
                                               "mongodb+srv://user:pass@host/db").
                                               If provided, it takes
                                               precedence over individual
                                               components.
            database_name (Optional[str]): The name of the default database
                                           to connect to upon successful
                                           client connection. This is set on
                                           the `self.database` attribute.
            scheme (str): The protocol scheme for the connection (e.g.,
                          "mongodb", "mongodb+srv"). Defaults to
                          "mongodb+srv". Only used if `connection_string` is
                          not provided.
            username (Optional[str]): Username for database authentication.
                                      Only used if `connection_string` is not
                                      provided.
            password (Optional[str]): Password for database authentication.
                                      Only used if `connection_string` is not
                                      provided.
            host (Optional[str]): The MongoDB host(s) or cluster address
                                  (e.g., "localhost:27017",
                                  "cluster0.xxx.mongodb.net"). Essential if
                                  `connection_string` is not provided and
                                  individual components are used.
            path_db_name (Optional[str]): An optional database name to
                                          include directly in the connection
                                          string's path (e.g.,
                                          "/myDatabase"). This is different
                                          from `database_name` which is used
                                          to set the default database object
                                          on the client.
            options (Optional[str]): A URL-encoded string of connection
                                     options (e.g.,
                                     "retryWrites=true&w=majority&appName=MyApp").
                                     Only used if `connection_string` is not
                                     provided.
            **kwargs: Additional keyword arguments passed directly to both
                      `pymongo.MongoClient` and
                      `motor.motor_asyncio.AsyncIOMotorClient` upon their lazy
                      initialization.

        Raises:
            ValueError: If no valid connection string can be determined (e.g.,
                        if `connection_string` is None, `host` is None, and
                        `CONNECTION_STRING` is also empty/None), or if
                        validation rules for component-based connection fail.
            ConnectionFailure: If the connection to MongoDB fails.
            Exception: For any other unexpected errors during connection.
        """
        self.logger = logging.getLogger(__name__)
        # Private attributes for lazy-loaded clients
        self._client: Optional[MongoClient] = None
        self._async_client: Optional[AsyncIOMotorClient] = None

        self.database: Optional[Database] = None
        self.database_name = database_name

        # Store connection args for lazy initialization
        self._connection_kwargs = kwargs
        
        # Determine if any explicit individual components were passed
        # beyond their default values. Using generator for efficiency.
        explicit_individual_components_passed = (
            any(
                arg is not None
                for arg in [username, password, host, path_db_name, options]
            )
            or scheme != "mongodb+srv"
        )

        # Priority 1: Use provided connection_string if available
        final_connection_string = None
        if connection_string:
            final_connection_string = connection_string
            self.logger.debug(
                "Using full connection string provided directly."
            )
        # Priority 2: Attempt to construct from individual components
        elif explicit_individual_components_passed:
            missing_mandatory_components = []
            provided_component_info = []

            # Check for mandatory 'host'
            if not host:
                missing_mandatory_components.append("host")

            # Check for 'username' if 'password' is provided
            if password is not None:
                if not username:
                    missing_mandatory_components.append(
                        "username (required with password)"
                    )

            # Collect information on all components that were explicitly
            # provided
            if scheme != "mongodb+srv":
                provided_component_info.append(f"scheme='{scheme}'")
            if username is not None:
                provided_component_info.append(f"username='{username}'")
            if password is not None:
                # Mask password for logging/error messages for security
                provided_component_info.append(
                    f"password='{'*' * len(password)}'"
                )
            if host is not None:
                provided_component_info.append(f"host='{host}'")
            if path_db_name is not None:
                provided_component_info.append(
                    f"path_db_name='{path_db_name}'"
                )
            if options is not None:
                provided_component_info.append(f"options='{options}'")

            # If any mandatory components were missing, raise a
            # comprehensive ValueError
            if missing_mandatory_components:
                error_parts = [
                    "Failed to construct MongoDB connection string due to "
                    "missing mandatory components."
                ]
                error_parts.append(
                    "Missing: " f"{', '.join(missing_mandatory_components)}."
                )
                if provided_component_info:
                    error_parts.append(
                        "Components provided: "
                        f"{', '.join(provided_component_info)}."
                    )
                else:
                    error_parts.append(
                        "No other components were explicitly provided."
                    )

                error_msg = "\n".join(error_parts)
                self.logger.error(error_msg)
                raise ValueError(error_msg)

            # Proceed with string construction if validation passes
            credentials_part = ""
            if username:
                credentials_part = username
                if password:
                    credentials_part += f":{password}"
                credentials_part += "@"

            db_path = ""
            if path_db_name:
                db_path = f"/{path_db_name}"

            options_part = ""
            if options:
                options_part = f"?{options}"

            final_connection_string = (
                f"{scheme}://{credentials_part}{host}{db_path}{options_part}"
            )
            self.logger.debug(
                "Constructed connection string from provided components."
            )
        # Priority 3: Fallback to hardcoded default (or env var)
        else:
            final_connection_string = self.CONNECTION_STRING
            self.logger.warning(
                "No connection string or explicit individual components "
                "provided. Falling back to hardcoded default or "
                "MONGO_CONNECTION_STRING environment variable."
            )

        if not final_connection_string:
            error_msg = (
                "MongoDB connection string could not be determined. Cannot "
                "establish connection."
            )
            self.logger.error(error_msg)
            raise ValueError(error_msg)
        
        self._final_connection_string = final_connection_string
        self.logger.debug("MongoDBConnection initialized and ready for lazy connection.")

    @property
    def client(self) -> MongoClient:
        """
        Lazily initializes and returns the synchronous MongoClient.
        The connection is established only on the first access.
        """
        if self._client is None:
            self.logger.debug("Lazily initializing synchronous MongoClient...")
            try:
                self._client = MongoClient(self._final_connection_string, **self._connection_kwargs)
                # The ping command is a one-time check on first access to verify the connection
                self._client.admin.command("ping")
                self.logger.info("Successfully connected synchronous MongoClient.")
                if self.database_name and not self.database:
                    self.database = self._client[self.database_name]
            except Exception:
                self.logger.exception("Failed to initialize synchronous MongoClient.")
                self._client = None  # Ensure it stays None on failure
                raise
        return self._client

    @property
    def async_client(self) -> AsyncIOMotorClient:
        """
        Lazily initializes and returns the asynchronous AsyncIOMotorClient.
        The connection is established by the driver on the first operation.
        """
        if self._async_client is None:
            self.logger.debug("Lazily initializing asynchronous AsyncIOMotorClient...")
            try:
                self._async_client = AsyncIOMotorClient(self._final_connection_string, **self._connection_kwargs)
                # Motor connects lazily, so no ping is needed here.
                # The first operation will establish the connection.
                self.logger.info("Asynchronous AsyncIOMotorClient initialized (will connect on first use).")
            except Exception:
                self.logger.exception("Failed to initialize asynchronous AsyncIOMotorClient.")
                self._async_client = None  # Ensure it stays None on failure
                raise
        return self._async_client

    def get_database(self, db_name: Optional[str]=None) -> Database:
        """
        Retrieves a synchronous database instance from the PyMongo client.
        Triggers lazy initialization of the client if not already connected.
        """
        # Accessing self.client property will trigger lazy initialization
        active_client = self.client
        if active_client is None:
            self.logger.error(
                "Attempted to get sync database but PyMongo client is not "
                "connected."
            )
            raise ConnectionFailure(
                "PyMongo (sync) client is not connected. Please check "
                "connection status."
            )

        db_to_return = None
        if db_name:
            self.logger.debug(
                f"Retrieving sync database '{db_name}' "
                f"specified by argument."
            )
            db_to_return = active_client[db_name]
        elif self.database is not None:
            self.logger.debug(
                f"Retrieving default sync database " f"'{self.database.name}'."
            )
            db_to_return = self.database
        else:
            error_msg = (
                "No database name provided and no default "
                "database was set during connection."
            )
            self.logger.error(error_msg)
            raise ValueError(error_msg)

        if db_to_return is None:
            self.logger.error(
                "Failed to retrieve a sync database object " "(returned None)."
            )
            raise ConnectionFailure("Failed to retrieve a sync database object.")

        self.logger.debug(
            f"Successfully retrieved sync database object for "
            f"'{db_to_return.name}'."
        )
        return db_to_return

    def get_async_database(self, db_name: Optional[str]=None) -> Database:
        """
        Retrieves an asynchronous database instance from the Motor client.
        Triggers lazy initialization of the client if not already connected.
        """
        # Accessing self.async_client property will trigger lazy initialization
        active_async_client = self.async_client
        if active_async_client is None:
            self.logger.error(
                "Attempted to get async database but Motor client is not "
                "connected."
            )
            raise ConnectionFailure(
                "Motor (async) client is not connected. Please check "
                "connection status."
            )

        db_to_return = None
        if db_name:
            self.logger.debug(
                f"Retrieving async database '{db_name}' "
                f"specified by argument."
            )
            db_to_return = active_async_client[db_name]
        elif self.database_name:  # Use the same default database name
            self.logger.debug(
                f"Retrieving default async database "
                f"'{self.database_name}'."
            )
            db_to_return = active_async_client[self.database_name]
        else:
            error_msg = (
                "No database name provided and no default "
                "database was set during connection."
            )
            self.logger.error(error_msg)
            raise ValueError(error_msg)

        if db_to_return is None:
            self.logger.error(
                "Failed to retrieve an async database object "
                "(returned None)."
            )
            raise ConnectionFailure("Failed to retrieve an async database object.")

        self.logger.debug(
            f"Successfully retrieved async database object for "
            f"'{db_to_return.name}'."
        )
        return db_to_return

    def close_connection(self):
        """Closes the MongoDB connection gracefully."""
        if self._client:
            self._client.close()
            self.logger.info("Synchronous MongoDB connection closed.")
            self._client = None
        if self._async_client:
            self._async_client.close()
            self.logger.info("Asynchronous MongoDB connection closed.")
            self._async_client = None

        if not self._client and not self._async_client:
            self.logger.debug("No active MongoDB clients to close (they may not have been initialized).")


# --- MongoDBCollectionManager class ---
class MongoDBCollectionManager:
    """
    Provides methods for managing MongoDB collections, including creation,
    listing, and potentially dropping. Also includes a method to watch
    collection changes.
    """

    def __init__(self, connection: MongoDBConnection):
        """
        Initializes the MongoDBCollectionManager with an active connection.

        Args:
            connection (MongoDBConnection): An instance of MongoDBConnection
                                            with an established client.

        Raises:
            TypeError: If the provided connection is not a
                       MongoDBConnection instance.
        """
        if not isinstance(connection, MongoDBConnection):
            raise TypeError(
                "Expected an instance of MongoDBConnection for "
                "initialization."
            )
        self.connection = connection
        self.logger = logging.getLogger(self.__class__.__name__)

    def create_collection(
        self,
        collection_name: str,
        db_name: Optional[str]=None,
        validator: Optional[Dict[str, Any]]=None,
        dry_run: bool=False,
        **options,
    ) -> Optional[Collection]:
        """
        Creates a new collection in the specified database.

        Args:
            collection_name (str): The name of the collection to create.
            db_name (Optional[str]): The name of the database. If None,
                                     uses the default database from connection.
            validator (Optional[Dict[str, Any]]): A document validation rule.
            dry_run (bool): If True, the operation will be logged but not
                            executed against the database.
            **options: Additional options for collection creation (e.g., capped).

        Returns:
            Optional[Collection]: The created collection object if not dry_run,
                                  otherwise None.

        Raises:
            ConnectionFailure: If the MongoDB client is not connected.
            OperationFailure: If the MongoDB operation fails (e.g., permissions).
            Exception: For any other unexpected errors.
        """
        if dry_run:
            self.logger.debug(
                "DRY RUN: Would create collection '%s' in database '%s' with "
                "options: %s, validator: %s",
                collection_name,
                db_name or self.connection.database_name,
                options,
                validator,
            )
            return None

        try:
            database = self.connection.get_database(db_name)
            self.logger.debug(
                f"Attempting to create collection "
                f"'{collection_name}' in '{database.name}' "
                f"with options: %s",
                options,
            )

            create_options = {}
            if validator:
                create_options["validator"] = validator
            create_options.update(options)

            collection = database.create_collection(
                collection_name, **create_options
            )
            self.logger.info(
                f"Collection '{collection_name}' created "
                f"successfully in database '{database.name}'."
            )
            return collection
        except ConnectionFailure:
            self.logger.exception(
                f"Failed to create collection: MongoDB "
                f"client not connected."
            )
            raise
        except OperationFailure:
            # SECURITY NOTE: Ensure that error messages from the database
            # (e.g., due to permissions) do not leak sensitive information
            # (like internal collection names, specific data values) if
            # these logs are accessible to external users or less privileged
            # systems. PyMongo generally handles this by providing
            # high-level error messages.
            self.logger.exception(
                f"MongoDB operation failed creating "
                f"collection '{collection_name}' in "
                f"'{database.name}'."
            )
            raise
        except Exception:
            self.logger.exception(
                f"Unexpected error creating collection "
                f"'{collection_name}'."
            )
            raise

    def list_collections(self, db_name: Optional[str]=None) -> List[str]:
        """
        Lists the names of all collections in a specified database.

        Args:
            db_name (Optional[str]): The name of the database. If None,
                                     uses the default database from connection.

        Returns:
            List[str]: A list of collection names.

        Raises:
            ConnectionFailure: If the MongoDB client is not connected.
            OperationFailure: If the MongoDB operation fails (e.g., permissions).
            Exception: For any other unexpected errors.
        """
        try:
            database = self.connection.get_database(db_name)
            self.logger.debug(
                f"Attempting to list collections in "
                f"database: '{database.name}'"
            )
            collections = database.list_collection_names()
            self.logger.info(
                f"Successfully listed collections in database "
                f"'{database.name}'. Found: %s",
                collections,
            )
            return collections
        except ConnectionFailure:
            self.logger.exception(
                "Failed to list collections: MongoDB client " "not connected."
            )
            raise
        except OperationFailure:
            # This type of error (Permission denied) often indicates a user
            # privilege issue, which is an access control security concern.
            # Ensure database users have only the necessary
            # `listCollections` or other roles.
            self.logger.exception(
                f"Permission denied or other MongoDB "
                f"operation failure while listing "
                f"collections for '{database.name}'. "
                f"Verify user privileges."
            )
            raise
        except Exception:
            self.logger.exception(
                f"An unexpected error occurred while " f"listing collections."
            )
            raise

    def get_collection(
        self, collection_name: str, db_name: Optional[str]=None
    ) -> Collection:
        """
        Retrieves a specific collection instance.

        Args:
            collection_name (str): The name of the collection to retrieve.
            db_name (Optional[str]): The name of the database. If None,
                                     uses the default database from connection.

        Returns:
            Collection: The PyMongo Collection object.
        """
        database = self.connection.get_database(db_name)
        self.logger.debug(
            f"Retrieving collection '{collection_name}' from "
            f"database '{database.name}'."
        )
        return database[collection_name]

    def watch_collection(
        self,
        collection_name: str,
        db_name: Optional[str]=None,
        pipeline: Optional[List[Dict[str, Any]]]=None,
        full_document: str="updateLookup",
    ) -> Any:
        """
        Opens a change stream on a specified collection.

        Args:
            collection_name (str): The name of the collection to watch.
            db_name (Optional[str]): The name of the database.
            pipeline (Optional[List[Dict[str, Any]]]): An aggregation pipeline
                                                      to filter change stream
                                                      events.
            full_document (str): The level of detail to return for updated
                                 documents. "updateLookup" is often preferred.

        Returns:
            A ChangeStream cursor.

        Raises:
            Exception: If there's an error opening the change stream.
        """
        try:
            database = self.connection.get_database(db_name)
            collection = database[collection_name]
            self.logger.info(
                f"Opening change stream on '{collection_name}' in "
                f"'{database.name}'."
            )
            return collection.watch(
                pipeline=pipeline, full_document=full_document
            )
        except Exception as e:
            self.logger.error(
                f"Failed to open change stream on '{collection_name}': {e}"
            )
            raise


# --- Argument Parsing Function for Connection (Used by both mains) ---
def add_connection_args(parser: argparse.ArgumentParser):
    """
    Adds standard MongoDB connection arguments to an ArgumentParser.

    Args:
        parser (argparse.ArgumentParser): The parser to add arguments to.
    """
    parser.add_argument(
        "--connection-string",
        type=str,
        default=None,
        help=(
            "Optional: The full MongoDB connection string. If provided, "
            "it takes precedence over individual --db-* parameters."
        ),
    )
    parser.add_argument(
        "--database-name",
        type=str,
        default="CryptoSniperDev",
        help="Default database name to connect to.",
    )
    parser.add_argument(
        "--db-scheme",
        type=str,
        default="mongodb+srv",
        help=(
            "Optional: Protocol scheme (e.g., 'mongodb', 'mongodb+srv'). "
            "Default is 'mongodb+srv'."
        ),
    )
    parser.add_argument(
        "--db-username",
        type=str,
        default=None,
        help="Optional: Username for database authentication.",
    )
    parser.add_argument(
        "--db-password",
        type=str,
        default=None,
        help="Optional: Password for database authentication.",
    )
    parser.add_argument(
        "--db-host",
        type=str,
        default=None,
        help=(
            "Optional: MongoDB host(s) or cluster address "
            "(e.g., 'localhost:27017', 'cluster0.xxx.mongodb.net'). "
            "Required if '--connection-string' is not used and other "
            "individual components are provided."
        ),
    )
    parser.add_argument(
        "--db-path-name",
        type=str,
        default=None,
        help=(
            "Optional: Database name to be included in the connection "
            "string's path (e.g., '/myDatabase')."
        ),
    )
    parser.add_argument(
        "--db-options",
        type=str,
        default=None,
        help=(
            "Optional: URL-encoded options string (e.g., "
            "'retryWrites=true&w=majority&appName=MyApp')."
        ),
    )


def get_connection_kwargs_from_args(
    args: argparse.Namespace,
) -> Dict[str, Any]:
    """
    Extracts MongoDBConnection initialization arguments from parsed argparse
    namespace.

    Args:
        args (argparse.Namespace): The parsed command-line arguments.

    Returns:
        Dict[str, Any]: A dictionary of keyword arguments suitable for
                        MongoDBConnection's constructor.
    """
    mongo_conn_kwargs = {}
    if args.connection_string:
        mongo_conn_kwargs["connection_string"] = args.connection_string
    elif args.db_host:
        mongo_conn_kwargs["scheme"] = args.db_scheme
        mongo_conn_kwargs["username"] = args.db_username
        mongo_conn_kwargs["password"] = args.db_password
        mongo_conn_kwargs["host"] = args.db_host
        mongo_conn_kwargs["path_db_name"] = args.db_path_name
        mongo_conn_kwargs["options"] = args.db_options
    else:
        # If neither connection_string nor db_host, MongoDBConnection will
        # use its internal CONNECTION_STRING default.
        pass
    return mongo_conn_kwargs


def validate_connection_args(args: argparse.Namespace):
    """
    Performs initial validation of connection arguments before attempting
    to create a MongoDBConnection.

    Args:
        args (argparse.Namespace): The parsed command-line arguments.

    Raises:
        SystemExit: If invalid combinations of arguments are detected,
                    exits the program with a non-zero status.
    """
    parser_logger = logging.getLogger(__name__ + ".argparse")

    individual_components_given = any(
        [
            args.db_username,
            args.db_password,
            args.db_host,
            args.db_path_name,
            args.db_options,
        ]
    )

    if args.connection_string and individual_components_given:
        parser_logger.warning(
            "Both '--connection-string' and individual '--db-*' components "
            "were provided. The '--connection-string' will take precedence "
            "and other components will be ignored."
        )

    if not args.connection_string:
        if args.db_password and not args.db_username:
            parser_logger.error(
                "Error: '--db-password' cannot be used without "
                "'--db-username'."
            )
            sys.exit(2)

        if not args.db_host and individual_components_given:
            parser_logger.error(
                "Error: If any individual connection components "
                "('--db-username', '--db-password', '--db-path-name', "
                "'--db-options') are provided, '--db-host' must also be "
                "given."
            )
            sys.exit(2)


# --- Refactored Main Example Logic ---
def parse_mongodb_example_arguments() -> argparse.Namespace:
    """
    Parses command-line arguments for the MongoDB library's example main.

    This function sets up the ArgumentParser, defines common arguments
    like --debug and --dry-run, and configures subparsers for various
    CRUD operations (list-collections, insert-document, find-documents,
    update-document, delete-document).

    Returns:
        argparse.Namespace: The parsed arguments.
    """
    parser = argparse.ArgumentParser(
        description="MongoDB Library Exploration Tool."
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging for more verbose output.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform a dry run for write operations (log, but don't execute).",
    )

    # Add connection arguments
    add_connection_args(parser)

    subparsers = parser.add_subparsers(
        dest="command", help="Available commands"
    )

    # Command: list-collections
    list_parser = subparsers.add_parser(
        "list-collections", help="List all collections in a database."
    )
    list_parser.add_argument(
        "--target-db",
        type=str,
        help="Optional: Database name to list collections from.",
    )

    # Command: insert-document
    insert_parser = subparsers.add_parser(
        "insert-document",
        help="Insert a sample document into a collection.",
    )
    insert_parser.add_argument(
        "--collection",
        type=str,
        required=True,
        help="Target collection name.",
    )
    insert_parser.add_argument(
        "--data",
        type=str,
        required=True,
        help='JSON string of the document to insert (e.g., \'{"name": "test"}\')',
    )
    insert_parser.add_argument(
        "--target-db",
        type=str,
        help="Optional: Database name to insert into.",
    )

    # Command: find-documents
    find_parser = subparsers.add_parser(
        "find-documents",
        help="Find documents in a collection.",
    )
    find_parser.add_argument(
        "--collection",
        type=str,
        required=True,
        help="Target collection name.",
    )
    find_parser.add_argument(
        "--query",
        type=str,
        default="{}",
        help='JSON string of the query (e.g., \'{"name": "test"}\')',
    )
    find_parser.add_argument(
        "--target-db",
        type=str,
        help="Optional: Database name to find from.",
    )

    # Command: update-document
    update_parser = subparsers.add_parser(
        "update-document",
        help="Update documents in a collection.",
    )
    update_parser.add_argument(
        "--collection",
        type=str,
        required=True,
        help="Target collection name.",
    )
    update_parser.add_argument(
        "--query",
        type=str,
        required=True,
        help='JSON string of the filter query (e.g., \'{"name": "old"}\')',
    )
    update_parser.add_argument(
        "--update",
        type=str,
        required=True,
        help='JSON string of the update operation (e.g., \'{"$set": {"name": "new"}}\')',
    )
    update_parser.add_argument(
        "--upsert",
        action="store_true",
        help="Create a new document if no document matches the query.",
    )
    update_parser.add_argument(
        "--target-db",
        type=str,
        help="Optional: Database name to update in.",
    )

    # Command: delete-document
    delete_parser = subparsers.add_parser(
        "delete-document",
        help="Delete a document from a collection.",
    )
    delete_parser.add_argument(
        "--collection",
        type=str,
        required=True,
        help="Target collection name.",
    )
    delete_parser.add_argument(
        "--query",
        type=str,
        required=True,
        help='JSON string of the query to identify the document to delete (e.g., \'{"name": "test"}\')',
    )
    delete_parser.add_argument(
        "--target-db",
        type=str,
        help="Optional: Database name to delete from.",
    )

    return parser.parse_args()


def execute_mongodb_example_command(
    args: argparse.Namespace,
    collection_manager: MongoDBCollectionManager,
    logger: logging.Logger,
):
    """
    Executes the specified MongoDB command based on parsed arguments.

    Args:
        args (argparse.Namespace): The parsed command-line arguments.
        collection_manager (MongoDBCollectionManager): An instance of the
                                                      collection manager.
        logger (logging.Logger): The logger instance for output.

    Raises:
        SystemExit: If an invalid JSON string is provided for data, query,
                    or update arguments.
    """
    logger.info(
        "MongoDB Library Example: Command '%s' selected.", args.command
    )

    if args.command == "list-collections":
        collections = collection_manager.list_collections(
            db_name=args.target_db
        )
        logger.info("Collections: %s", collections)

    elif args.command == "insert-document":
        try:
            data_to_insert = json.loads(args.data)
        except json.JSONDecodeError as e:
            logger.error("Invalid JSON data provided: %s", e)
            sys.exit(1)

        collection = collection_manager.get_collection(
            args.collection, db_name=args.target_db
        )
        if args.dry_run:
            logger.debug(
                "DRY RUN: Would insert document %s into collection '%s' "
                "in database '%s'",
                data_to_insert,
                args.collection,
                args.target_db or collection_manager.connection.database_name,
            )
        else:
            result = collection.insert_one(data_to_insert)
            logger.info(
                "Inserted document with ID: %s into collection '%s'.",
                result.inserted_id,
                args.collection,
            )

    elif args.command == "find-documents":
        try:
            query = json.loads(args.query)
        except json.JSONDecodeError as e:
            logger.error("Invalid JSON query provided: %s", e)
            sys.exit(1)

        collection = collection_manager.get_collection(
            args.collection, db_name=args.target_db
        )
        found_docs = list(collection.find(query))
        logger.info(
            "Found %d documents in collection '%s' with query %s: %s",
            len(found_docs),
            args.collection,
            query,
            found_docs,
        )

    elif args.command == "update-document":
        try:
            query = json.loads(args.query)
            update_op = json.loads(args.update)
        except json.JSONDecodeError as e:
            logger.error("Invalid JSON query or update provided: %s", e)
            sys.exit(1)

        collection = collection_manager.get_collection(
            args.collection, db_name=args.target_db
        )
        if args.dry_run:
            logger.debug(
                "DRY RUN: Would update documents in collection '%s' "
                "in database '%s' with query %s, update %s, upsert=%s",
                args.collection,
                args.target_db or collection_manager.connection.database_name,
                query,
                update_op,
                args.upsert,
            )
        else:
            result = collection.update_many(
                query, update_op, upsert=args.upsert
            )
            logger.info(
                "Matched %d documents, modified %d, upserted ID: %s in "
                "collection '%s'.",
                result.matched_count,
                result.modified_count,
                result.upserted_id,
                args.collection,
            )

    elif args.command == "delete-document":
        try:
            query = json.loads(args.query)
        except json.JSONDecodeError as e:
            logger.error("Invalid JSON query provided: %s", e)
            sys.exit(1)

        collection = collection_manager.get_collection(
            args.collection, db_name=args.target_db
        )
        if args.dry_run:
            logger.debug(
                "DRY RUN: Would delete documents from collection '%s' "
                "in database '%s' with query %s",
                args.collection,
                args.target_db or collection_manager.connection.database_name,
                query,
            )
        else:
            result = collection.delete_many(query)
            logger.info(
                "Deleted %d documents from collection '%s'.",
                result.deleted_count,
                args.collection,
            )
    else:
        logger.error(f"Unknown command: {args.command}")
        sys.exit(1)


def main_example():
    """
    Main function for demonstrating basic MongoDB library operations.

    This function allows users to test connection, list collections,
    insert, find, update, and delete documents in a specified collection.
    It supports a dry-run mode for write operations.
    """
    args = parse_mongodb_example_arguments()
    setup_logging(debug_mode=args.debug)
    logger = logging.getLogger(__name__)

    # Validate connection arguments (common to all commands)
    validate_connection_args(args)

    mongo_conn = None
    try:
        conn_kwargs = get_connection_kwargs_from_args(args)
        mongo_conn = MongoDBConnection(
            database_name=args.database_name, **conn_kwargs
        )
        collection_manager = MongoDBCollectionManager(mongo_conn)

        execute_mongodb_example_command(args, collection_manager, logger)

    except ConnectionFailure:
        logger.critical("MongoDB connection failed.", exc_info=True)
        sys.exit(1)
    except ValueError as e:
        logger.critical("Configuration error: %s", e)
        sys.exit(1)
    except Exception:
        logger.exception("An unexpected error occurred during execution.")
        sys.exit(1)
    finally:
        if mongo_conn:
            mongo_conn.close_connection()
        logger.info("MongoDB Library Example finished.")


if __name__ == "__main__":
    main_example()

