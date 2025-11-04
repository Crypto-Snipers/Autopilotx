# Standard library imports
from datetime import datetime, timezone, timedelta
import time
import asyncio
import logging
from contextlib import asynccontextmanager
import urllib.parse
from math import ceil
from pydantic import BaseModel, Field
from typing import Literal

# Third-party imports
from fastapi import FastAPI, HTTPException, Request, status, Query

# Import cache-related functionality
from fastapi_cache import coder
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
from jose import JWTError, jwt
from bson import json_util
from bson import ObjectId
from starlette.middleware.sessions import SessionMiddleware
import pymongo
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import sys

# Add the parent directory to the Python path to find local modules
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# Local imports - use absolute imports for better compatibility
try:
    import auth
    from CoinDcxClient import CoinDcxClient
    import routers.admin as admin
    import routers.strategies as strategies_router
    from delta_client import DeltaRestClient 
except ImportError:
    # If running as a module, try with package prefix
    from CoinDcxClient import CoinDcxClient
    from routers import admin
    from delta_client import DeltaRestClient 

# Get the required variables from auth module
JWT_ALGORITHM = auth.JWT_ALGORITHM
JWT_SECRET = auth.JWT_SECRET
session_cache = auth.session_cache

# Configure logging
# Configure logging with WARNING level to reduce verbosity
# Ensure logs directory exists

load_dotenv()

ENV = os.getenv("ENV", "dev")
# DELTA_BASE_URL = os.getenv("DELTA_BASE_URL", "https://api.delta.exchange")

LOG_DIR = f"/home/ubuntu/cryptocode-{ENV}/logs"
LOG_FILE = f"/home/ubuntu/cryptocode-{ENV}/logs/backend_server.log"

os.makedirs(LOG_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api.log"),
        logging.FileHandler(LOG_FILE),
    ],
)

logger = logging.getLogger("crypto-api")

# Configuration


DATABASE_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("MONGO_DB_NAME")

NOTIFICATIONS_COLLECTION = "notifications"
USERS_COLLECTION = "users"

# Email configuration
OTP_EXPIRE_TIME = 5 * 60  # 5 minutes in seconds
your_email_address = "support@thecryptosnipers.com"
your_email_password = "Manisha@ANG#13"
your_smtp_server = "smtpout.secureserver.net"
your_smtp_port = 465
your_company_name = "Crypto Snipers"

# Shared constants
SUPPORTED_SYMBOLS = {"BTCUSDT": "BTC", "ETHUSDT": "ETH", "SOLUSDT": "SOL"}

# Initialize MongoDB with connection pooling
client = AsyncIOMotorClient(
    DATABASE_URL,
    maxPoolSize=500,
    minPoolSize=50,
    maxIdleTimeMS=30000,
    socketTimeoutMS=20000,
    connectTimeoutMS=20000,
    serverSelectionTimeoutMS=20000,
    waitQueueTimeoutMS=10000,
    retryWrites=True,
    retryReads=True,
    w="majority",
    journal=True,
    readPreference="nearest",
)

logger.info(DATABASE_URL)
logger.info(DB_NAME)

# Database references
db = client[f"{DB_NAME}"]
CandleData = db.candleData
trades = db.trades
position = db.position
brokerConnections = db.brokerConnections
strategies = db.strategies
users = db.users
notifications = db.notifications
userNotifications = db.userNotifications
live = db.live
ticks = db.ticks
clientPositions = db.clientPositions
clientTrades = db.clientTrades
trading_configs = db.trading_cnfigs


def convert_objectid(obj):
    if isinstance(obj, list):
        return [convert_objectid(item) for item in obj]
    elif isinstance(obj, dict):
        return {k: convert_objectid(v) for k, v in obj.items()}
    elif isinstance(obj, ObjectId):
        return str(obj)
    else:
        return obj


def serialize_doc(doc):
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                new_doc[k] = str(v)
            elif isinstance(v, (dict, list)):
                new_doc[k] = serialize_doc(v)
            else:
                new_doc[k] = v
        return new_doc
    return doc


# Pydantic models
class User(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    status: str = "Pending"
    approved_at: Optional[datetime] = None
    created_at: datetime = datetime.now()
    broker_name: Optional[str] = None
    strategies: Optional[dict] = {}
    is_admin: bool = False
    is_active: bool = False
    api_verified: bool = False


class SignupRequest(BaseModel):
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    email: EmailStr
    otp: str


class SigninRequest(BaseModel):
    email: EmailStr
    password: str


class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: str
    platform: str
    user_type: str
    start_time: datetime
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    last_updated_at: Optional[datetime] = None
    is_read: bool = False
    is_dismissed: bool = False

class TradingConfig(BaseModel):
    SYMBOL: str = Field(..., description="Trading symbol e.g. BTC or ETH")
    TimeFrame: str = Field(..., description="Timeframe e.g. 1Min, 5Min")
    SMA_PERIOD: int
    PATTERN_PERCENTAGE: float
    SMA_DISTANCE_PERCENTAGE: float
    STOPLOSS_BUFFER_PERCENTAGE: float
    RISK_REWARD_RATIO: float
    TRAIL_RATIO: float
    TARGET_RATIO_FINAL: float
    EXIT_1_PERCENTAGE: float



class NotificationResponse(BaseModel):
    id: str
    title: str
    message: str
    type: str
    time: str
    read: bool


def notification_serializer(notification) -> dict:
    return {
        "id": str(notification["_id"]),
        "title": notification["title"],
        "message": notification["message"],
        "type": notification["notification_type"].lower(),
        "time": notification["start_time"].strftime("%b %d, %I:%M %p"),
        "read": notification.get("is_read", False),
    }




# Utility classes
class BrokerUtils:

    @staticmethod
    async def get_user_credentials(email: str, db) -> tuple:
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Email is required"
            )

        cred = await db.broker_connections.find_one(
            {"userId": email}, {"credentials": 1, "_id": 0}
        )

        if not cred or "credentials" not in cred:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Broker credentials not found",
            )

        return cred["credentials"]

    @staticmethod
    def init_coin_dcx_client(api_key: str, api_secret: str) -> CoinDcxClient:
        try:
            return CoinDcxClient(api_key, api_secret)
        except Exception as e:
            logger.error(f"Error initializing CoinDCX client: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize broker connection",
            )


class MongoDBStorage:

    def __init__(self, db_client, db_name):
        self.client = db_client
        self.db = self.client[db_name]

        self.users_collection = self.db.get_collection(
            "users",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.strategies_collection = self.db.get_collection(
            "strategies",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.positions_collection = self.db.get_collection(
            "position",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.trades_collection = self.db.get_collection(
            "trades",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.client_trades_collection = self.db.get_collection(
            "clientTrades",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.ticks_collection = self.db.get_collection(
            "ticks",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.client_history_collection = self.db.get_collection(
            "clientHistory",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )
        self.trading_configs = self.db.get_collection(
            "trading_configs",
            read_preference=pymongo.ReadPreference.NEAREST,
            write_concern=pymongo.WriteConcern(w="majority", j=True),
        )

        self.cache = {}
        self.cache_ttl = 300
        self.last_cache_cleanup = time.time()

    async def initialize(self):
        await self.init_connection_pool()
        await self.ensure_indexes()
        return self

    async def init_connection_pool(self):
        self.client.get_io_loop = asyncio.get_event_loop
        await self.client.admin.command("ping")

    async def ensure_indexes(self):
        try:
            await self.users_collection.create_index(
                [("email", 1)], unique=True, background=True
            )
            await self.users_collection.create_index(
                [("created_at", -1)], background=True
            )

            await self.strategies_collection.create_index(
                [("userId", 1)], background=True
            )
            await self.strategies_collection.create_index(
                [("name", 1)], background=True
            )
            await self.strategies_collection.create_index(
                [("isDeployed", 1)], background=True
            )

            await self.positions_collection.create_index(
                [("userId", 1)], background=True
            )
            await self.positions_collection.create_index(
                [("symbol", 1)], background=True
            )
            await self.positions_collection.create_index(
                [("timestamp", -1)], background=True
            )

            await self.trades_collection.create_index(
                [("userId", 1), ("timestamp", -1)], background=True
            )
            await self.positions_collection.create_index(
                [("userId", 1), ("symbol", 1)], background=True
            )

        except Exception as e:
            logger.error(f"Error creating indexes: {str(e)}")

    async def update_user(self, user_id, update_data):
        """Update a user document by _id with the provided update_data dict."""
        result = await self.users_collection.update_one(
            {"_id": user_id}, {"$set": update_data}
        )
        return result


class SessionCache:

    def __init__(self, expiry_time=3600):
        self.cache = {}
        self.expiry_time = expiry_time

    def get(self, key):
        if key in self.cache:
            data, timestamp = self.cache[key]
            if time.time() - timestamp > self.expiry_time:
                del self.cache[key]
                return None
            return data
        return None

    def set(self, key, value):
        self.cache[key] = (value, time.time())

    def delete(self, key):
        if key in self.cache:
            del self.cache[key]

    def clear_expired(self):
        current_time = time.time()
        expired_keys = [
            k
            for k, (_, timestamp) in self.cache.items()
            if current_time - timestamp > self.expiry_time
        ]
        for key in expired_keys:
            del self.cache[key]


# Initialize session cache and OTP store
session_cache = SessionCache()

# Initialize OTP store
otp_store = {}


# FastAPI app initialization
async def init_storage():
    storage = MongoDBStorage(client, "Autopilotx")
    await storage.initialize()
    return storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("API server starting")
    try:
        # Cache initialization removed temporarily to fix server startup issues
        app.state.storage = await init_storage()
        logger.debug("Database indexes created")
    except Exception as e:
        logger.error(f"Failed to initialize: {str(e)}")
        raise
    yield
    logger.info("Shutting down the API server")
    client.close()


# Create FastAPI app instance
app = FastAPI(
    title="Crypto Trading API",
    description="High-performance API for crypto trading",
    version="1.0.0",
    openapi_url=None if os.getenv("ENVIRONMENT") == "production" else "/openapi.json",
    docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs",
    lifespan=lifespan,
)

# CORS configuration
origins = [
    # "http://13.201.215.73:7000/",
    # "http://13.201.215.73:3000/",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:7000",
    "http://127.0.0.1:7000",

    
]

# Add middleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key=JWT_SECRET,
    session_cookie="session",
    max_age=1 * 24 * 60 * 60,
    same_site="lax",
    https_only=os.getenv("ENVIRONMENT") == "production",
)

# Include the admin router
app.include_router(admin.router, prefix="/api")
app.include_router(strategies_router.router, prefix="/api")


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    path = request.url.path
    try:
        response = await call_next(request)
        if path.startswith("/api"):
            duration = time.time() - start_time
            logger.info(
                f"{request.method} {path} {response.status_code} in {duration*1000:.2f}ms"
            )
        return response
    except Exception as e:
        logger.error(
            f"Exception in request processing for {request.method} {path}: {e}",
            exc_info=True,
        )
        raise


######################################  USER MANAGEMENT ###################################################


@app.post("/api/auth/complete-profile")
async def complete_profile(user_data: dict, request: Request):
    try:
        logger.debug(f"Processing profile request for user")

        # Validate required fields
        required_fields = ["name", "email"]
        for field in required_fields:
            if field not in user_data or not user_data[field]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": f"Missing required field: {field}"},
                )

        # Normalize email to prevent duplicates due to case differences or extra spaces
        email = user_data["email"].strip().lower()
        name = user_data["name"].strip()

        # Prepare user document with default values matching the schema
        current_time = (
            datetime.now(timezone.utc).isoformat() + "Z"
        )  # ISO format with timezone

        # Use update_one with upsert=True to prevent race conditions
        # This will either update an existing user or create a new one atomically
        update_result = await app.state.storage.users_collection.update_one(
            {"email": email},  # Query to find existing user
            {
                "$setOnInsert": {  # Fields to set only on insert (new user)
                    "email": email,
                    "status": "Pending",
                    "approved_at": None,
                    "created_at": current_time,
                    "broker_name": "",
                    "strategies": {},
                    "is_admin": False,
                    "is_active": False,
                    "api_verified": False,
                    "balance": {"usd": 0, "inr": 0},
                    "used_margin": {"usd": 0, "inr": 0},
                    "free_margin": {"usd": 0, "inr": 0},
                },
                "$set": {  # Fields to update for both new and existing users
                    "name": name,
                    "updated_at": current_time,
                },
            },
            upsert=True,  # Create document if it doesn't exist
        )

        # Get the updated/inserted user document
        user = await app.state.storage.users_collection.find_one({"email": email})

        if update_result.upserted_id:
            logger.info(f"New user created: {email}")
        else:
            logger.debug(f"Updated existing user: {email}")

        # Generate JWT token
        token_data = {
            "sub": email,  # Using the normalized email variable
            "exp": datetime.now() + timedelta(days=30),
        }
        token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)

        # Set token in session
        request.session["token"] = token

        # Convert ObjectId to string for JSON serialization and remove sensitive fields
        if user and "_id" in user:
            user["_id"] = str(user["_id"])
            # Remove any fields not in the schema
            allowed_fields = {
                "_id",
                "name",
                "email",
                "status",
                "approved_at",
                "created_at",
                "broker_name",
                "strategies",
                "is_admin",
                "is_active",
                "api_verified",
                "balance",
                "used_margin",
                "free_margin",
            }
            user = {k: v for k, v in user.items() if k in allowed_fields}

        return {
            "success": True,
            "message": "Profile completed successfully",
            "user": user,
            "token": token,
        }

    except HTTPException:
        raise
    except pymongo.errors.DuplicateKeyError as e:
        error_msg = f"Duplicate key error: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "User with this email already exists"},
        )
    except Exception as e:
        error_msg = f"Error in complete_profile: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "Failed to complete profile", "error": str(e)},
        )


@app.get("/api/auth/user", status_code=status.HTTP_200_OK)
async def get_user(email: str):
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="email is required"
        )

    user = await app.state.storage.users_collection.find_one({"email": email})
    if user:
        session_cache.set(f"email:{email}", user)
        serialized_user = convert_objectid(user)
        return {"status": "user_exists", "user": serialized_user}

    return {"status": "user_not_found"}


@app.get("/api/broker", status_code=status.HTTP_200_OK)
async def get_broker(
    email: str = Query(
        ..., description="Email of the user whose broker info to retrieve"
    )
):
    """
    Get broker connection information for a user.

    Returns:
                    dict: Contains broker connection details including:
                                    - connected: bool - Whether the user has a connected broker
                                    - broker_name: str - Name of the connected broker (if any)
                                    - broker_id: str - Broker-specific user ID (if any)
                                    - app_name: str - Name of the application (if any)
                                    - verified: bool - Whether the broker connection is verified
                                    - verified_at: str - ISO timestamp of when the broker was verified (if any)
                                    - last_verified: str - ISO timestamp of last verification (if any)
                                    - status: str - Connection status (e.g., 'connected', 'disconnected')
                                    - balance: dict - Current account balances by currency
                                    - free_margin: dict - Current free margin by currency
    """
    try:
        logger.debug(f"Fetching broker info for: {email}")

        # Get user from database with only the necessary fields
        user = await app.state.storage.users_collection.find_one(
            {"email": email},
            {
                "broker_connection": 1,
                "api_verified": 1,
                "balance": 1,
                "free_margin": 1,
                "status": 1,
                "created_at": 1,
            },
        )

        if not user:
            logger.warning(f"[Broker Info] User not found: {email}")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "success": False,
                    "message": "User not found",
                    "code": "USER_NOT_FOUND",
                },
            )

        # Check if user has connected broker
        if "broker_connection" not in user:
            logger.info(f"[Broker Info] No broker connected for user: {email}")
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "connected": False,
                    "message": "No broker connected",
                },
            )

        # Prepare response data
        broker_info = {
            "connected": True,
            "broker_name": user["broker_connection"].get("broker_name"),
            "broker_id": user["broker_connection"].get("broker_id"),
            "app_name": user["broker_connection"].get("app_name"),
            "api_verified": user.get("api_verified", False),
            "last_verified": user["broker_connection"].get("last_verified"),
            "status": user["broker_connection"].get("status", "disconnected"),
            "balance": user.get("balance", {}),
            "free_margin": user.get("free_margin", {}),
        }

        # Remove sensitive information
        if "api_key" in user["broker_connection"]:
            broker_info["api_key_configured"] = True
        if "api_secret" in user["broker_connection"]:
            broker_info["api_secret_configured"] = True

        logger.debug(f"Fetched broker info for: {email}")
        return broker_info

    except Exception as e:
        logger.error(
            f"[Broker Info] Error fetching broker info for {email}: {str(e)}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "message": "Failed to fetch broker information",
                "code": "INTERNAL_ERROR",
            },
        )


###########  CRYPTO LIVE DATA    ###########################################################


@app.get("/api/cryptolive-data")
# @cache(expire=30) - temporarily removed
async def get_cryptolive_data():
    try:
        res = []
        symbols = list(SUPPORTED_SYMBOLS.keys())

        # Get current timestamp and 24h ago timestamp
        now = datetime.now(timezone.utc) - timedelta(hours=12)

        for symbol in symbols:
            try:
                # Get the most recent candle
                current_candle = await CandleData.find_one(
                    {"symbol": symbol}, sort=[("date", -1)]
                )

                if not current_candle:
                    logger.warning(f"No current data found for {symbol}")
                    res.append(
                        {
                            "symbol": symbol,
                            "price": 0,
                            "change": 0,
                            "error": "No current data available",
                        }
                    )
                    continue

                current_price = float(current_candle.get("close", 0))
                current_time = current_candle.get("date", "unknown")

                logger.debug(f"Processing {symbol} - Price: {current_price}")

                # Get the earliest available candle for this symbol
                first_candle = await CandleData.find_one(
                    {"symbol": symbol}, sort=[("date", 1)]
                )

                # Get the 24h most recent candle for comparison
                previous_candle = await CandleData.find_one(
                    {"symbol": symbol, "date": {"$lte": now}}, sort=[("date", -1)]
                )

                # Initialize variables
                comparison_price = None
                comparison_time = None
                time_diff_hours = None

                # First try to use the previous candle if it's from a different day
                if previous_candle and "close" in previous_candle:
                    comparison_price = float(previous_candle["close"])
                    comparison_time = previous_candle.get("date")

                    if hasattr(current_time, "__sub__") and comparison_time:
                        time_diff = current_time - comparison_time
                        time_diff_hours = time_diff.total_seconds() / 3600

                        # Only use this comparison if it's from a different day
                        if time_diff_hours >= 24:
                            logger.debug(f"Using previous day's candle for {symbol}")
                        else:
                            # If not a full day, we'll try to use the first candle instead
                            comparison_price = None

                # If we don't have a good comparison yet, use the first available candle
                if (
                    comparison_price is None
                    and first_candle
                    and "close" in first_candle
                    and first_candle["_id"] != current_candle["_id"]
                ):
                    comparison_price = float(first_candle["close"])
                    comparison_time = first_candle.get("date")

                    if hasattr(current_time, "__sub__") and comparison_time:
                        time_diff = current_time - comparison_time
                        time_diff_hours = time_diff.total_seconds() / 3600
                        logger.debug(f"Using first candle for {symbol}")

                # Calculate price change if we have a comparison
                if comparison_price is not None and comparison_price > 0:
                    price_change = (
                        (current_price - comparison_price) / comparison_price
                    ) * 100
                    time_diff_str = (
                        f"{time_diff_hours:.1f} hours"
                        if time_diff_hours
                        else "unknown time"
                    )
                    logger.info(
                        f"Price change for {symbol}: {price_change:.2f}% over {time_diff_str}"
                    )
                else:
                    price_change = 0
                    logger.warning(f"No valid comparison data found for {symbol}")

                # Add the result with debug information
                res.append(
                    {
                        "symbol": symbol,
                        "price": round(current_price, 2),
                        "change": round(price_change, 2),
                        "debug": {
                            "current_time": str(current_time),
                            "comparison_time": (
                                str(comparison_time) if comparison_time else None
                            ),
                            "current_price": current_price,
                            "comparison_price": comparison_price,
                            "time_diff_hours": time_diff_hours,
                            "current_timestamp": (
                                current_time.timestamp()
                                if hasattr(current_time, "timestamp")
                                else None
                            ),
                            "comparison_timestamp": (
                                comparison_time.timestamp()
                                if comparison_time
                                and hasattr(comparison_time, "timestamp")
                                else None
                            ),
                        },
                    }
                )

            except Exception as e:
                logger.error(f"Error processing {symbol}: {str(e)}", exc_info=True)
                res.append({"symbol": symbol, "price": 0, "change": 0, "error": str(e)})

        return JSONResponse(content=res)

    except Exception as e:
        logger.error(f"Error in get_cryptolive_data: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to fetch cryptocurrency data", "details": str(e)},
        )


@app.get("/api/strategies", tags=["strategies"])
async def get_strategies(email: str = Query(...)):
    """
    Get list of available trading strategies

    Returns:
                    List of strategy objects with their details
    """
    try:
        user = await app.state.storage.users_collection.find_one({"email": email})
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")

        # Get all strategies from the collection for debugging
        all_strategies = await app.state.storage.strategies_collection.find({}).to_list(
            100
        )

        ## get user strategies
        user_strategies = user.get("strategies", {})

        final_strategies = []
        # Filter active strategies (case-insensitive check)
        strategies = [
            s for s in all_strategies if s.get("is_active") in [True, "true", "True"]
        ]

        if user_strategies:
            for st in strategies:
                if st.get("name") in user_strategies:
                    st["status"] = user_strategies[st.get("name")].get("status")
                else:
                    st["status"] = ""

        if not strategies:
            logger.warning("No active strategies found in database")
            return JSONResponse(
                status_code=404, content={"error": "No active strategies found"}
            )

        # Convert ObjectId to string for JSON serialization
        for strategy in strategies:
            if "_id" in strategy:
                strategy["id"] = str(strategy.pop("_id"))

        return strategies

    except Exception as e:
        logger.error(f"Error fetching strategies: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch strategies: {str(e)}"
        )


@app.get("/api/strategies/deployed", tags=["strategies"])
async def get_deployed_strategies(
    email: str = Query(
        ..., description="Email of the user whose strategies to retrieve"
    )
):
    """
    Get list of deployed strategies for a specific user.

    Args:
                    email: Email of the user whose strategies to retrieve

    Returns:
                    List of deployed strategy objects with their details
    """
    try:
        logger.info(f"[Get Deployed Strategies] Fetching strategies for email: {email}")

        # Normalize email to lowercase
        email = email.strip().lower()

        # Get user document
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            logger.warning(f"[Get Deployed Strategies] User not found: {email}")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"error": "User not found"},
            )

        # Get user's strategies (default to empty dict if not found)
        user_strategies = user.get("strategies", {})

        if not user_strategies:
            logger.info(
                f"[Get Deployed Strategies] No strategies found for user: {email}"
            )
            return []

        # Convert strategies object to list of strategy objects with names
        strategies_list = []
        for strategy_name, strategy_data in user_strategies.items():
            if not strategy_data:
                continue

            # Create a strategy object with name and data

            strategy_obj = {
                "name": strategy_name,
                "status": strategy_data.get("status", "inactive"),
                "multiplier": strategy_data.get("multiplier", 1),
                "created_at": strategy_data.get("created_at"),
                "updated_at": strategy_data.get("updated_at"),
            }

            # # get template strategy
            template_strategy = await app.state.storage.strategies_collection.find_one(
                {"name": strategy_name}
            )
            logger.debug(f"Processing strategy: {strategy_name}")
            if template_strategy:
                strategy_obj["description"] = template_strategy.get("description", "")
                strategy_obj["Qty"] = template_strategy.get("Qty", 0.0)
                strategy_obj["margin"] = template_strategy.get("margin")

            strategies_list.append(strategy_obj)

        logger.debug(
            f"Found {len(strategies_list)} active strategies for user: {email}"
        )
        return strategies_list

    except Exception as e:
        error_msg = f"[Get Deployed Strategies] Error fetching strategies for user {email}: {str(e)}"
        logger.error(error_msg, exc_info=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch deployed strategies: {str(e)}",
        )


@app.post("/api/add-strategy")
async def add_strategy(
    email: str = Query(..., description="Email of the user"),
    strategy_name: str = Query(
        ...,
        description="Name of the strategy to add (e.g., 'ETH_Multiplier' or 'BTC_Multiplier')",
    ),
    multiplier: int = Query(
        1, description="Multiplier value for the strategy (default: 1)"
    ),
):
    """
    Add or update a trading strategy for a user.
    """
    try:
        logger.info(
            f"[Add Strategy] Attempting to add strategy '{strategy_name}' for user: {email}"
        )

        # Normalize email
        email = email.strip().lower()

        # Fetch user
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            logger.warning(f"[Add Strategy] User not found: {email}")
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"success": False, "message": "User not found"},
            )

        # Ensure strategies dict
        if "strategies" not in user:
            user["strategies"] = {}

        existing_strategy = user["strategies"].get(strategy_name, {})

        # Strategy metadata
        strategy_data = {
            "multiplier": multiplier,
            "status": "active",
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
        }

        # Detect currency
        currency = user.get("broker_connection", {}).get("currency", "USD").upper()
        currency = currency.lower()

        logger.info(f"[Add Strategy] Using currency: {currency} for user: {email}")

        # Balance and margins
        balance = float(user.get("balance", {}).get(currency, 0) or 0)
        used_margin = float(user.get("used_margin", {}).get(currency, 0) or 0)
        free_margin = float(user.get("free_margin", {}).get(currency, balance - used_margin))

        logger.info(
            f"[Add Strategy] User {email} -> Balance: {balance}, Used: {used_margin}, Free: {free_margin}"
        )

        # Base margin requirement
        base_margin = 50 if currency == "usd" else 500
        required_margin = base_margin * multiplier
        is_update = bool(existing_strategy)

        # --- Margin validation ---
        if is_update:
            existing_multiplier = existing_strategy.get("multiplier", 0)
            old_required = base_margin * existing_multiplier
            additional_needed = required_margin - old_required
            if additional_needed > 0 and free_margin < additional_needed:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "success": False,
                        "message": f"Insufficient free margin to update. Additional: {round(additional_needed,2)} {currency}, Available: {round(free_margin,2)} {currency}",
                    },
                )
        else:
            if free_margin < required_margin:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={
                        "success": False,
                        "message": f"Insufficient free margin to add. Required: {round(required_margin,2)} {currency}, Available: {round(free_margin,2)} {currency}",
                    },
                )

        # --- Save strategy ---
        user["strategies"][strategy_name] = {
            **existing_strategy,
            **strategy_data,
            "status": "active",
        }

        # --- Margin adjustments ---
        if is_update:
            existing_multiplier = existing_strategy.get("multiplier", 0)
            old_required = existing_multiplier * base_margin
            new_required = multiplier * base_margin
            margin_adjustment = new_required - old_required
            new_used_margin = used_margin + margin_adjustment
        else:
            new_used_margin = used_margin + required_margin

        # Clamp margins
        new_used_margin = max(0.0, min(balance, new_used_margin))
        new_free_margin = max(0.0, balance - new_used_margin)

        logger.info(
            f"[Add/Update Strategy] {email} -> New Used: {new_used_margin}, New Free: {new_free_margin}"
        )

        # --- Update DB ---
        result = await app.state.storage.users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    f"strategies.{strategy_name}": user["strategies"][strategy_name],
                    f"free_margin.{currency}": new_free_margin,
                    f"used_margin.{currency}": new_used_margin,
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                }
            },
        )

        if result.modified_count == 0 and not result.upserted_id:
            logger.error(
                f"[Add Strategy] Failed to update {email} with {strategy_name}"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"success": False, "message": "Failed to add strategy"},
            )

        updated_user = await app.state.storage.users_collection.find_one({"email": email})
        updated_free_margin = updated_user.get("free_margin", {})
        updated_currency = updated_user.get("currency") or updated_user.get("default_currency") or updated_user.get("usd") or "usd"
        updated_currency = updated_currency.lower() if isinstance(updated_currency, str) else "usd"

        return {
            "success": True,
            "message": f"Successfully added/updated strategy '{strategy_name}'",
            "strategy": {
                "name": strategy_name,
                **updated_user["strategies"][strategy_name],
            },
            "free_margin": updated_free_margin,
            "currency": updated_currency,
        }

    except Exception as e:
        error_msg = f"Error adding strategy '{strategy_name}' for {email}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": error_msg},
        )



# @app.post("/api/add-strategy")
# async def add_strategy(
#     email: str = Query(..., description="Email of the user"),
#     strategy_name: str = Query(
#         ...,
#         description="Name of the strategy to add (e.g., 'ETH_Multiplier' or 'BTC_Multiplier')",
#     ),
#     multiplier: int = Query(
#         1, description="Multiplier value for the strategy (default: 1)"
#     ),
# ):
#     """
#     Add or update a trading strategy for a user.

#     Args:
#                     email: User's email address
#                     strategy_name: Name of the strategy (e.g., 'ETH_Multiplier', 'BTC_Multiplier')
#                     multiplier: Multiplier value for the strategy (default: 1)

#     Returns:
#                     dict: Success/failure status and message
#     """
#     try:
#         logger.info(
#             f"[Add Strategy] Attempting to add strategy '{strategy_name}' for user: {email}"
#         )

#         # Normalize email to lowercase
#         email = email.strip().lower()
#         # Get user and validate
#         user = await app.state.storage.users_collection.find_one({"email": email})
#         if not user:
#             logger.warning(f"[Add Strategy] User not found: {email}")
#             return JSONResponse(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 content={"success": False, "message": "User not found"},
#             )

#         # Ensure strategies dictionary exists
#         if "strategies" not in user:
#             user["strategies"] = {}

#         # Check if strategy already exists
#         existing_strategy = user["strategies"].get(strategy_name, {})

#         # Prepare strategy data
#         strategy_data = {
#             "multiplier": multiplier,
#             "status": "active",
#             "created_at": datetime.utcnow().isoformat() + "Z",
#             "updated_at": datetime.utcnow().isoformat() + "Z",
#         }

#         # # check the user have available margin to add the strategy
#         # Get user's currency

#         currency = user.get("usd")

#         # get free_margin from user data
#         free_margin = user.get("free_margin", {})
#         margin = free_margin.get(currency, 0)
#         used_margin = user.get("used_margin", {}).get(currency, 0)
#         logger.info(
#             f"[Add Strategy] User {email} margins - Free: {margin} {currency}, Used: {used_margin} {currency}"
#         )

#         # Calculate base margin requirement per multiplier
#         base_margin_per_multiplier = 500 if currency == "usd" else 50000

#         # Calculate required margin based on currency and multiplier
#         required_margin = base_margin_per_multiplier * multiplier

#         # Check if this is a new strategy or updating an existing one
#         is_update = bool(existing_strategy)

#         # If updating an existing strategy, account for the margin already allocated
#         if is_update:
#             existing_multiplier = existing_strategy.get("multiplier", 0)
#             existing_margin_allocated = base_margin_per_multiplier * existing_multiplier

#             # Calculate the additional margin needed (could be negative if reducing multiplier)
#             additional_margin_needed = required_margin - existing_margin_allocated

#             # If additional margin is needed, check if there's enough free margin
#             if additional_margin_needed > 0 and margin < additional_margin_needed:
#                 return JSONResponse(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     content={
#                         "success": False,
#                         "message": f"Insufficient free margin to update strategy. Additional required: {round(additional_margin_needed, 2)} {currency}, Available: {round(margin, 2)} {currency}",
#                     },
#                 )
#         else:
#             # For new strategy, check if there's enough free margin for the full requirement
#             if margin < required_margin:
#                 return JSONResponse(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     content={
#                         "success": False,
#                         "message": f"Insufficient free margin to add strategy. Required: {round(required_margin, 2)} {currency}, Available: {round(margin, 2)} {currency}",
#                     },
#                 )

#         # Update or add the strategy
#         user["strategies"][strategy_name] = {
#             **existing_strategy,  # Keep existing data if any
#             **strategy_data,  # Update with new data
#             "status": "active",  # Ensure status is active
#         }

#         # Get base margin per multiplier
#         base_margin = 500 if currency.lower() == "usd" else 50000

#         # Get current used margin
#         used_margin = user.get("used_margin", {}).get(currency, 0)

#         # Calculate margin adjustments based on whether this is a new or updated strategy
#         if is_update:
#             # For update: calculate the difference in margin requirements
#             old_margin_required = existing_multiplier * base_margin
#             new_margin_required = multiplier * base_margin
#             margin_adjustment = new_margin_required - old_margin_required

#             # Update free and used margin based on the adjustment
#             # Ensure free margin is always less than or equal to the total balance
#             balance = user.get("balance", {}).get(currency, 0)
#             new_free_margin = max(0, min(balance, margin - margin_adjustment))
#             new_used_margin = used_margin + margin_adjustment

#             logger.info(
#                 f"[Update Strategy] Adjusting margin for {email}: Old multiplier: {existing_multiplier}, New multiplier: {multiplier}, Adjustment: {margin_adjustment}"
#             )
#         else:
#             # For new strategy: allocate the full margin requirement
#             margin_required = multiplier * base_margin
#             # Ensure free margin is always less than or equal to the total balance
#             balance = user.get("balance", {}).get(currency, 0)
#             new_free_margin = max(0, min(balance, margin - margin_required))
#             new_used_margin = used_margin + margin_required

#             logger.info(
#                 f"[Add Strategy] Allocating margin for {email}: Multiplier: {multiplier}, Required: {margin_required}"
#             )

#         # Update user in database with new strategy and adjusted margins
#         result = await app.state.storage.users_collection.update_one(
#             {"email": email},
#             {
#                 "$set": {
#                     f"strategies.{strategy_name}": user["strategies"][strategy_name],
#                     f"free_margin.{currency}": new_free_margin,
#                     f"used_margin.{currency}": new_used_margin,
#                     "updated_at": datetime.utcnow().isoformat() + "Z",
#                 }
#             },
#         )

#         logger.info(
#             f"[{'Update' if is_update else 'Add'} Strategy] New free margin: {new_free_margin}, New used margin: {new_used_margin}"
#         )

#         if result.modified_count == 0 and not result.upserted_id:
#             logger.error(
#                 f"[Add Strategy] Failed to update user {email} with new strategy {strategy_name}"
#             )
#             return JSONResponse(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 content={"success": False, "message": "Failed to add strategy"},
#             )

#         # Get updated user to include in response
#         updated_user = await app.state.storage.users_collection.find_one(
#             {"email": email}
#         )
#         updated_free_margin = updated_user.get("free_margin", {})
#         updated_currency = updated_user.get("usd")

#         logger.info(
#             f"[Add Strategy] Successfully added/updated strategy '{strategy_name}' for user: {email}"
#         )
#         return {
#             "success": True,
#             "message": f"Successfully added/updated strategy '{strategy_name}'",
#             "strategy": {
#                 "name": strategy_name,
#                 **updated_user["strategies"][strategy_name],
#             },
#             "free_margin": updated_free_margin,
#             "currency": updated_currency,
#         }

#     except Exception as e:
#         error_msg = (
#             f"Error adding strategy '{strategy_name}' for user {email}: {str(e)}"
#         )
#         logger.error(error_msg, exc_info=True)
#         return JSONResponse(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             content={"success": False, "message": f"Failed to add strategy: {str(e)}"},
#         )


# @app.post("/api/add-strategy")
# async def add_strategy(
#     email: str = Query(..., description="Email of the user"),
#     strategy_name: str = Query(
#         ...,
#         description="Name of the strategy to add (e.g., 'ETH_Multiplier' or 'BTC_Multiplier')",
#     ),
#     multiplier: int = Query(
#         1, description="Multiplier value for the strategy (default: 1)"
#     ),
# ):
#     """
#     Add or update a trading strategy for a user.

#     Args:
#                     email: User's email address
#                     strategy_name: Name of the strategy (e.g., 'ETH_Multiplier', 'BTC_Multiplier')
#                     multiplier: Multiplier value for the strategy (default: 1)

#     Returns:
#                     dict: Success/failure status and message
#     """
#     try:
#         logger.info(
#             f"[Add Strategy] Attempting to add strategy '{strategy_name}' for user: {email}"
#         )

#         # Normalize email to lowercase
#         email = email.strip().lower()
#         # Get user and validate
#         user = await app.state.storage.users_collection.find_one({"email": email})
#         if not user:
#             logger.warning(f"[Add Strategy] User not found: {email}")
#             return JSONResponse(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 content={"success": False, "message": "User not found"},
#             )

#         # Ensure strategies dictionary exists
#         if "strategies" not in user:
#             user["strategies"] = {}

#         # Check if strategy already exists
#         existing_strategy = user["strategies"].get(strategy_name, {})

#         # Prepare strategy data
#         strategy_data = {
#             "multiplier": multiplier,
#             "status": "active",
#             "created_at": datetime.utcnow().isoformat() + "Z",
#             "updated_at": datetime.utcnow().isoformat() + "Z",
#         }

#         # # check the user have available margin to add the strategy
#         # Get user's currency

#         currency = user.get("currency", "usd").lower()

#         # get free_margin from user data
#         free_margin = user.get("free_margin", {})
#         margin = free_margin.get(currency, 0)
#         used_margin = user.get("used_margin", {}).get(currency, 0)
#         logger.info(
#             f"[Add Strategy] User {email} margins - Free: {margin} {currency}, Used: {used_margin} {currency}"
#         )

#         # Calculate base margin requirement per multiplier
#         base_margin_per_multiplier = 500 if currency == "usd" else 50000

#         # Calculate required margin based on currency and multiplier
#         required_margin = base_margin_per_multiplier * multiplier

#         # Check if this is a new strategy or updating an existing one
#         is_update = bool(existing_strategy)

#         # If updating an existing strategy, account for the margin already allocated
#         if is_update:
#             existing_multiplier = existing_strategy.get("multiplier", 0)
#             existing_margin_allocated = base_margin_per_multiplier * existing_multiplier

#             # Calculate the additional margin needed (could be negative if reducing multiplier)
#             additional_margin_needed = required_margin - existing_margin_allocated

#             # If additional margin is needed, check if there's enough free margin
#             if additional_margin_needed > 0 and margin < additional_margin_needed:
#                 return JSONResponse(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     content={
#                         "success": False,
#                         "message": f"Insufficient free margin to update strategy. Additional required: {round(additional_margin_needed, 2)} {currency}, Available: {round(margin, 2)} {currency}",
#                     },
#                 )
#         else:
#             # For new strategy, check if there's enough free margin for the full requirement
#             if margin < required_margin:
#                 return JSONResponse(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     content={
#                         "success": False,
#                         "message": f"Insufficient free margin to add strategy. Required: {round(required_margin, 2)} {currency}, Available: {round(margin, 2)} {currency}",
#                     },
#                 )

#         # Update or add the strategy
#         user["strategies"][strategy_name] = {
#             **existing_strategy,  # Keep existing data if any
#             **strategy_data,  # Update with new data
#             "status": "active",  # Ensure status is active
#         }

#         # Get base margin per multiplier
#         base_margin = 500 if currency.lower() == "usd" else 50000

#         # Get current used margin
#         used_margin = user.get("used_margin", {}).get(currency, 0)

#         # Calculate margin adjustments based on whether this is a new or updated strategy
#         if is_update:
#             # For update: calculate the difference in margin requirements
#             old_margin_required = existing_multiplier * base_margin
#             new_margin_required = multiplier * base_margin
#             margin_adjustment = new_margin_required - old_margin_required

#             # Update free and used margin based on the adjustment
#             # Ensure free margin is always less than or equal to the total balance
#             balance = user.get("balance", {}).get(currency, 0)
#             new_free_margin = max(0, min(balance, margin - margin_adjustment))
#             new_used_margin = used_margin + margin_adjustment

#             logger.info(
#                 f"[Update Strategy] Adjusting margin for {email}: Old multiplier: {existing_multiplier}, New multiplier: {multiplier}, Adjustment: {margin_adjustment}"
#             )
#         else:
#             # For new strategy: allocate the full margin requirement
#             margin_required = multiplier * base_margin
#             # Ensure free margin is always less than or equal to the total balance
#             balance = user.get("balance", {}).get(currency, 0)
#             new_free_margin = max(0, min(balance, margin - margin_required))
#             new_used_margin = used_margin + margin_required

#             logger.info(
#                 f"[Add Strategy] Allocating margin for {email}: Multiplier: {multiplier}, Required: {margin_required}"
#             )

#         # Update user in database with new strategy and adjusted margins
#         result = await app.state.storage.users_collection.update_one(
#             {"email": email},
#             {
#                 "$set": {
#                     f"strategies.{strategy_name}": user["strategies"][strategy_name],
#                     f"free_margin.{currency}": new_free_margin,
#                     f"used_margin.{currency}": new_used_margin,
#                     "updated_at": datetime.utcnow().isoformat() + "Z",
#                 }
#             },
#         )

#         logger.info(
#             f"[{'Update' if is_update else 'Add'} Strategy] New free margin: {new_free_margin}, New used margin: {new_used_margin}"
#         )

#         if result.modified_count == 0 and not result.upserted_id:
#             logger.error(
#                 f"[Add Strategy] Failed to update user {email} with new strategy {strategy_name}"
#             )
#             return JSONResponse(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 content={"success": False, "message": "Failed to add strategy"},
#             )

#         # Get updated user to include in response
#         updated_user = await app.state.storage.users_collection.find_one(
#             {"email": email}
#         )
#         updated_free_margin = updated_user.get("free_margin", {})
#         updated_currency = updated_user.get("currency", "usd")

#         logger.info(
#             f"[Add Strategy] Successfully added/updated strategy '{strategy_name}' for user: {email}"
#         )
#         return {
#             "success": True,
#             "message": f"Successfully added/updated strategy '{strategy_name}'",
#             "strategy": {
#                 "name": strategy_name,
#                 **updated_user["strategies"][strategy_name],
#             },
#             "free_margin": updated_free_margin,
#             "currency": updated_currency,
#         }

#     except Exception as e:
#         error_msg = (
#             f"Error adding strategy '{strategy_name}' for user {email}: {str(e)}"
#         )
#         logger.error(error_msg, exc_info=True)
#         return JSONResponse(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             content={"success": False, "message": f"Failed to add strategy: {str(e)}"},
#         )


@app.post("/api/remove-strategy")
async def remove_strategy(
    email: str = Query(..., description="Email of the user"),
    strategy_name: str = Query(
        ..., description="Name of the strategy to remove (e.g., 'ETH_Multiplier')"
    ),
):
    """
    Remove a trading strategy from a user's account and adjust margins accordingly.
    - Free margin should increase by released amount
    - Used margin should decrease by released amount
    """

    try:
        logger.info(
            f"[Remove Strategy] Attempting to remove strategy '{strategy_name}' for user: {email}"
        )

        # Normalize email
        email = email.strip().lower()

        # Get user
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"success": False, "message": "User not found"},
            )

        # Validate strategies
        if "strategies" not in user or not user["strategies"]:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"success": False, "message": "No strategies found for user"},
            )

        if strategy_name not in user["strategies"]:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"success": False, "message": f"Strategy '{strategy_name}' not found"},
            )

        # Get strategy info
        strategy_data = user["strategies"][strategy_name]

        # Get margins
        currency = user.get("broker_connection", {}).get("currency", "USD").upper()
        currency = currency.lower()
        free_margin = float(user.get("free_margin", {}).get(currency, 0))
        used_margin = float(user.get("used_margin", {}).get(currency, 0))

        # Margin released
        multiplier = strategy_data.get("multiplier", 1)
        base_margin = 50 if currency == "usd" else 500
        margin_to_release = multiplier * base_margin

        # ✅ Adjust incrementally (not reset)
        new_used_margin = max(0, used_margin - margin_to_release)
        new_free_margin = free_margin + margin_to_release


        logger.info(
            f"[Remove Strategy] Strategy '{strategy_name}' removed. "
            f"Released {margin_to_release} {currency}. "
            f"Free margin: {free_margin} → {new_free_margin}, "
            f"Used margin: {used_margin} → {new_used_margin}"
        )

        # Update DB
        result = await app.state.storage.users_collection.update_one(
            {"email": email},
            {
                "$unset": {f"strategies.{strategy_name}": ""},
                "$set": {
                    f"free_margin.{currency}": new_free_margin,
                    f"used_margin.{currency}": new_used_margin,
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                },
            },
        )

        if result.modified_count == 0:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"success": False, "message": "Failed to remove strategy"},
            )

        return {
            "success": True,
            "message": f"Successfully removed strategy '{strategy_name}'",
            "released_margin": margin_to_release,
            "free_margin": new_free_margin,
            "used_margin": new_used_margin,
            "currency": currency,
        }

    except Exception as e:
        logger.error(
            f"[Remove Strategy] Error removing strategy '{strategy_name}' for user {email}: {str(e)}",
            exc_info=True,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": str(e)},
        )




@app.get("/api/strategy/deactivate-all")
async def deactivate_all_strategies(
    email: str = Query(..., description="Email of the user")
):
    """
    Deactivate all strategies for a user and release all allocated margin.
    - Free margin increases by total allocated margin
    - Used margin is reset to 0
    """
    try:
        logger.info(f"[Deactivate All Strategies] Attempting to deactivate all strategies for user: {email}")

        # Normalize email
        email = email.strip().lower()

        # Fetch user
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"success": False, "message": "User not found"},
            )

        strategies = user.get("strategies", {})
        if not strategies:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"success": True, "message": "No strategies to deactivate"},
            )

        # Determine currency
        currency = user.get("broker_connection", {}).get("currency", "USD").upper()
        currency = currency.lower()

        free_margin = float(user.get("free_margin", {}).get(currency, 0))
        used_margin = float(user.get("used_margin", {}).get(currency, 0))

        # Base margin
        base_margin = 50 if currency == "usd" else 500

        # Sum up total allocated margin from all strategies
        total_margin_to_release = sum(
            strategy.get("multiplier", 1) * base_margin for strategy in strategies.values()
        )

        # Update margins according to remove-strategy logic
        new_used_margin = 0
        new_free_margin = free_margin + total_margin_to_release

        logger.info(
            f"[Deactivate All Strategies] Total margin released: {total_margin_to_release} {currency}. "
            f"Free margin: {free_margin} → {new_free_margin}, Used margin: {used_margin} → {new_used_margin}"
        )

        # Clear all strategies and update margins
        result = await app.state.storage.users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "strategies": {},
                    f"free_margin.{currency}": new_free_margin,
                    f"used_margin.{currency}": new_used_margin,
                    "updated_at": datetime.utcnow().isoformat() + "Z",
                }
            },
        )

        if result.modified_count == 0:
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"success": False, "message": "Failed to deactivate strategies"},
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "message": "All strategies deactivated successfully",
                "free_margin": new_free_margin,
                "used_margin": new_used_margin,
                "currency": currency,
            },
        )

    except Exception as e:
        logger.error(f"[Deactivate All Strategies] Error for user {email}: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": str(e)},
        )



@app.get("/api/running/trade")
async def get_running_trades(
    strategy_name: str = Query(..., description="Name of the strategy"),
    email: str = Query(..., description="Email of the user"),
):
    try:
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="User email not found"
            )

        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        if strategy_name not in user["strategies"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Strategy not found"
            )

        strategy_name = strategy_name.replace(" ", "_")
        trade = await client[strategy_name].LiveUpdate.find_one({"ID": 0}, {"_id": 0})

        if trade and trade.get("Status") != "Completed":
            return {"status": "success", "message": "Trade is running"}
        else:
            return {"status": "success", "message": "Trade is not running"}
    except Exception as e:
        logger.error(f"Error fetching running trades: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Fetch user balance
@app.get("/api/user/balance")
async def get_user_balance(
    email: str = Query(..., description="Email of the user whose balance to retrieve")
):
    try:
        logger.info(f"Fetching live balance for user: {email}")

        # get user from DB
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            logger.warning(f"User not found: {email}")
            return JSONResponse(
                status_code=200, content={"balance": 0.0, "currency": "usd"}
            )

        # get creds
        creds = user.get("broker_connection", {})
        api_key = creds.get("api_key")
        api_secret = creds.get("api_secret")
        currency_pref = user["broker_connection"]["currency"].upper()
        if not api_key or not api_secret:
            logger.warning(f"No API keys configured for user {email}")
            return JSONResponse(
                status_code=200, content={"balance": 0.0, "currency": "usd"}
            )

        # connect Delta or coindcx
        broker_name = creds.get("broker_name", "delta_exchange").lower()

        if broker_name == "delta_exchange":
            base_url = "https://api.india.delta.exchange"
            client = DeltaRestClient(api_key=api_key, api_secret=api_secret, base_url=base_url)
            balances_response = client.get_wallet_balances()

            # Delta only has USD
            for wallet in balances_response:
                if wallet["asset_symbol"].upper() == "USD":
                    usd_balance = float(wallet["balance"])
                    break
            inr_balance = 0.0

        elif broker_name == "coindcx":
            client = CoinDcxClient(api_key=api_key, secret_key=api_secret)
            balances_response = client.get_balances()

            for wallet in balances_response:
                currency = wallet.get("currency", "").upper()
                balance = float(wallet.get("balance", 0))
                if currency == "USD" or currency == "USDT":
                    usd_balance = balance
                elif currency == "INR":
                    inr_balance = balance
        else:
            # unsupported broker
            return JSONResponse(
                status_code=400,
                content={"balance": 0.0, "currency": "usd", "message": f"Unsupported broker {broker_name}"}
            )

        balance_value = 0.0
        for wallet in balances_response:
            symbol = wallet.get("asset_symbol") or wallet.get("currency", "")
            if symbol.upper() in ["USD", "USDT"] and currency_pref == "USD":
                balance_value = float(wallet.get("balance", 0))
                break
            elif symbol.upper() == "INR" and currency_pref == "INR":
                balance_value = float(wallet.get("balance", 0))
                break


        # update DB with only the existing structure
        await app.state.storage.users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    f"futures_wallets.{currency_pref.lower()}": balance_value,
                    f"balance.{currency_pref.lower()}": balance_value,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )

        logger.info(f"Successfully fetched live balance for {email}: {usd_balance} USD")
        return JSONResponse(
            status_code=200,
            content={
                "balance": round(balance_value, 2),
                "currency": currency_pref.lower(),
            }
        )


    except Exception as e:
        logger.error(f"Error in get_user_balance for user {email}: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=200, content={"balance": 0.0, "currency": "usd"}
        )


# @app.get("/api/user/balance")
# async def get_user_balance(
#     email: str = Query(..., description="Email of the user whose balance to retrieve")
# ):
#     try:
#         logger.info(f"Fetching balance for user: {email}")

#         # Get user document from MongoDB to access futures wallet data
#         user = await app.state.storage.users_collection.find_one({"email": email})

#         if not user:
#             logger.warning(f"User not found: {email}")
#             return JSONResponse(
#                 status_code=200, content={"balance": 0.0, "currency": "usd"}
#             )

#         # Check if user has futures wallet data
#         futures_wallets = user.get("futures_wallets", {})

#         # Get balance from futures wallet according to user's currency
#         currency = user.get("currency", "usd")
#         futures_balance = 0.0

#         # Check if the currency exists in futures wallets
#         if currency in futures_wallets:
#             wallet = futures_wallets[currency]
#             # Get balance and convert to float
#             futures_balance = float(wallet.get("balance", 0.0))
#             logger.info(
#                 f"Found futures wallet {currency} balance for user {email}: {futures_balance}"
#             )
#         else:
#             logger.warning(f"No {currency} futures wallet found for user: {email}")

#             # # Fallback to regular balance if futures wallet not available
#             # regular_balance = user.get('balance', {}).get(currency.lower(), 0.0)
#             # if regular_balance > 0:
#             #     futures_balance = regular_balance
#             #     logger.info(f"Using regular balance for user {email}: {futures_balance} {currency}")

#         # Update user's last activity timestamp
#         await app.state.storage.users_collection.update_one(
#             {"email": email}, {"$set": {"updated_at": datetime.now().isoformat() + "Z"}}
#         )

#         logger.info(f"Successfully fetched balance for user: {email}")
#         return JSONResponse(
#             status_code=200,
#             content={"balance": round(futures_balance, 2), "currency": currency},
#         )

#     except Exception as e:
#         logger.error(
#             f"Error in get_user_balance for user {email}: {str(e)}", exc_info=True
#         )
#         return JSONResponse(
#             status_code=200, content={"balance": 0.0, "currency": currency}
#         )


@app.get("/api/health")
async def health_check():
    try:
        await client.admin.command("ping")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503, content={"status": "unhealthy", "error": str(e)}
        )


@app.post("/api/broker/verify", status_code=status.HTTP_200_OK)
async def verify_broker_endpoint(request: dict):
    """
    Verify and store broker API credentials for a user.

    Request body should contain:
    - email: User's email address
    - broker_name: Name of the broker (e.g., "Delta_Exchange")
    - broker_id: Broker-specific user ID
    - app_name: Name of the application
    - api_key: Broker API key
    - api_secret: Broker API secret
    - currency: Trading currency (USD or INR)

    Returns:
        dict: Verification status and user data
    """
    try:
        logger.info(f"[Broker Verification] Received request with data: {request}")

        # Validate email
        email = request.get("email", "").strip().lower()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Email is required", "code": "EMAIL_REQUIRED"},
            )

        # Get or create user
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            logger.info(f"[Broker Verification] Creating new user for email: {email}")
            current_time = datetime.utcnow().isoformat() + "Z"
            new_user = {
                "email": email,
                "name": email.split("@")[0],
                "status": "Pending",
                "strategies": {},
                "created_at": current_time,
                "updated_at": current_time,
                "is_admin": False,
                "is_active": True,
                "api_verified": False,
                "balance": {"usd": 0, "inr": 0},
                "used_margin": {"usd": 0, "inr": 0},
                "free_margin": {"usd": 0, "inr": 0},
            }
            try:
                result = await app.state.storage.users_collection.insert_one(new_user)
                user = new_user
                user["_id"] = result.inserted_id
            except pymongo.errors.DuplicateKeyError:
                user = await app.state.storage.users_collection.find_one({"email": email})

        # Extract request fields
        api_key = request.get("api_key", "").strip()
        api_secret = request.get("api_secret", "").strip()
        broker_name = request.get("broker_name", "").strip() or "Delta_Exchange"
        broker_id = request.get("broker_id", "").strip()
        app_name = request.get("app_name", "").strip() or "Delta"
        currency = request.get("currency", "USD").strip().upper()

        if not api_key or not api_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "API key and secret are required", "code": "INVALID_CREDENTIALS"},
            )

        if currency not in ["USD", "INR"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Currency must be either USD or INR", "code": "INVALID_CURRENCY"},
            )

        # Validate broker
        usd_balance = 0.0
        inr_balance = 0.0
        futures_wallets = {}

        # Broker - Delta_Exchange
        if broker_name.lower() == "delta_exchange":
            try:
                base_url = "https://api.india.delta.exchange"
                client = DeltaRestClient(base_url=base_url, api_key=api_key, api_secret=api_secret)
                balances_response = client.get_wallet_balances()
                logger.debug(f"[Delta] Wallet balances response: {balances_response}")

                if isinstance(balances_response, list) and len(balances_response) > 0:
                    for wallet in balances_response:
                        if wallet["asset_symbol"].upper() == "USD":
                            usd_balance = float(wallet["balance"])
                            break
                    inr_balance = 0.0
                else:
                    logger.error(f"[Delta] Invalid balances response: {balances_response}")
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Invalid response from Delta API"}
                    )

            except Exception as e:
                logger.error(f"[Delta Verification Failed] {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": "Invalid Delta Exchange credentials", "code": "INVALID_CREDENTIALS"},
                )

        # Broker - CoinDcx
        elif broker_name.lower() == "coindcx":
            try:
                client = CoinDcxClient(api_key=api_key, secret_key=api_secret)
                balances_response = client.get_balances()
                logger.debug(f"[CoinDcx] Wallet balances response: {balances_response}")

                if isinstance(balances_response, list) and len(balances_response) > 0:
                    for wallet in balances_response:
                        w_currency = wallet.get("currency", "").upper()
                        balance = float(wallet.get("balance", 0))
                        if w_currency in ["USD", "USDT"]:
                            usd_balance = balance
                        elif w_currency == "INR":
                            inr_balance = balance
                else:
                    logger.error(f"[CoinDCX] Invalid balances response: {balances_response}")
                    return JSONResponse(
                        status_code=400,
                        content={"error": "Invalid response from CoinDCX API"}
                    )

            except Exception as e:
                logger.error(f"[CoinDcx Verification Failed] {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": "Invalid CoinDcx credentials", "code": "INVALID_CREDENTIALS"},
                )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"Unsupported broker {broker_name}", "code": "BROKER_NOT_SUPPORTED"},
            )

        # Prepare update
        current_time = datetime.utcnow().isoformat()
        update_data = {
            "broker_connection": {
                "broker_name": broker_name,
                "broker_id": broker_id,
                "app_name": app_name,
                "api_key": api_key,
                "api_secret": api_secret,
                "currency": currency,   
                "verified_at": current_time,
                "last_verified": current_time,
                "status": "connected",
            },
            "balance.usd": usd_balance,
            "balance.inr": inr_balance,
            "free_margin.usd": usd_balance,
            "free_margin.inr": inr_balance,
            "api_verified": True,
            "futures_wallets": futures_wallets,
            "api_verified_at": current_time,
            "updated_at": current_time,
        }

        await app.state.storage.users_collection.update_one(
            {"email": email}, {"$set": update_data}, upsert=True
        )

        logger.info(f"[Broker Verification] Successfully verified user: {email}")

        return {
            "success": True,
            "message": "Broker account verified successfully",
            "data": {
                "email": email,
                "api_verified": True,
                "broker_name": broker_name,
                "balance": {"usd": usd_balance, "inr": inr_balance},
                "free_margin": {"usd": usd_balance, "inr": inr_balance},
                "currency": currency, 
            },
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"[Broker Verification] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": "An unexpected error occurred", "code": "INTERNAL_SERVER_ERROR"},
        )



# @app.post("/api/broker/verify", status_code=status.HTTP_200_OK)
# # @cache(expire=60) - temporarily removed
# async def verify_broker_endpoint(request: dict):
#     """
#     Verify and store broker API credentials for a user.

#     Request body should contain:
#     - email: User's email address
#     - broker_name: Name of the broker (e.g., "CoinDCX")
#     - broker_id: Broker-specific user ID
#     - app_name: Name of the application
#     - api_key: Broker API key
#     - api_secret: Broker API secret
#     - currency: Base currency (e.g., "usd")

#     Returns:
#                     dict: Verification status and user data
#     """
#     try:
#         logger.info(f"[Broker Verification] Received request with data: {request}")

#         # Validate required fields
#         email = request.get("email", "").strip().lower()
#         if not email:
#             error_msg = "Email is required"
#             logger.error(f"[Broker Verification] {error_msg}")
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail={"message": error_msg, "code": "EMAIL_REQUIRED"},
#             )

#         # Get user from database
#         logger.info(f"[Broker Verification] Looking up user with email: {email}")
#         try:
#             user = await app.state.storage.users_collection.find_one({"email": email})
#             if not user:
#                 # Instead of returning an error, create a new user
#                 logger.info(
#                     f"[Broker Verification] User with email {email} not found. Creating new user."
#                 )
#                 current_time = datetime.utcnow().isoformat() + "Z"

#                 # Create a basic user document
#                 new_user = {
#                     "email": email,
#                     "name": email.split("@")[0],  # Use part of email as name
#                     "status": "Pending",
#                     "strategies": {},
#                     "created_at": current_time,
#                     "updated_at": current_time,
#                     "is_admin": False,
#                     "is_active": True,
#                     "api_verified": False,
#                     "balance": {"usd": 0, "inr": 0},
#                     "used_margin": {"usd": 0, "inr": 0},
#                     "free_margin": {"usd": 0, "inr": 0},
#                 }

#                 try:
#                     # Insert the new user
#                     result = await app.state.storage.users_collection.insert_one(
#                         new_user
#                     )
#                     user = new_user
#                     user["_id"] = result.inserted_id
#                     logger.info(
#                         f"[Broker Verification] Created new user with email: {email}"
#                     )
#                 except pymongo.errors.DuplicateKeyError:
#                     # If there's a race condition and user was created in between our check and insert
#                     logger.info(
#                         f"[Broker Verification] User was created by another process, fetching again"
#                     )
#                     user = await app.state.storage.users_collection.find_one(
#                         {"email": email}
#                     )
#                     if not user:
#                         raise ValueError(
#                             "User still not found after attempted creation"
#                         )
#                 except Exception as create_error:
#                     logger.error(
#                         f"[Broker Verification] Error creating user: {str(create_error)}"
#                     )
#                     raise HTTPException(
#                         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                         detail={
#                             "message": "Failed to create user account",
#                             "code": "USER_CREATION_ERROR",
#                         },
#                     )
#         except HTTPException:
#             raise
#         except Exception as e:
#             logger.error(
#                 f"[Broker Verification] Database error looking up user: {str(e)}"
#             )
#             raise HTTPException(
#                 status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 detail={"message": "Database error", "code": "DATABASE_ERROR"},
#             )

#         def clean_api_secret(secret: str) -> str:
#             """Clean and extract the API secret from potentially malformed input."""
#             # Try to find a 64-character hex string in the secret
#             import re

#             hex_match = re.search(r"([a-f0-9]{64})", secret, re.IGNORECASE)
#             if hex_match:
#                 return hex_match.group(1)
#             # If no hex string found, try to clean and use the first 64 characters
#             cleaned = re.sub(r"[^a-zA-Z0-9]", "", secret)[:64]
#             if len(cleaned) == 64:
#                 return cleaned
#             # If still not valid, return the original stripped secret
#             return secret.strip()

#         # Extract and validate request data
#         api_key = request.get("api_key", "").strip()
#         raw_api_secret = request.get("api_secret", "")

#         # Clean the API secret
#         api_secret = clean_api_secret(raw_api_secret)

#         # Log the cleaned secret (masked for security)
#         logger.debug(
#             f"[Broker Verification] Original secret length: {len(raw_api_secret)}, "
#             f"Cleaned length: {len(api_secret)}"
#         )

#         broker_name = request.get("broker_name", "").strip() or "CoinDCX"
#         broker_id = request.get("broker_id", "").strip()
#         app_name = request.get("app_name", "").strip() or "CryptoApp"
#         currency = (request.get("currency", "usd") or "usd").strip().upper()

#         logger.info(
#             f"[Broker Verification] Starting verification for user: {email} with {broker_name}"
#         )
#         logger.debug(
#             f"[Broker Verification] Request data - API Key: {'*' * 8 + api_key[-4:] if api_key else 'None'}, "
#             f"Broker: {broker_name}, Currency: {currency}"
#         )

#         # Validate API credentials
#         if not api_key or not api_secret:
#             error_msg = "API key and API secret are required"
#             logger.warning(f"[Broker Verification] {error_msg} for user: {email}")
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail={"message": error_msg, "code": "INVALID_CREDENTIALS"},
#             )

#         # Additional validation for CoinDCX
#         if broker_name.lower() == "coindcx":
#             if len(api_key) < 10 or len(api_secret) != 64:
#                 error_msg = "Invalid API key or secret format for CoinDCX"
#                 logger.warning(f"[Broker Verification] {error_msg} for user: {email}")
#                 logger.debug(
#                     f"[Broker Verification] API Key length: {len(api_key)}, Secret length: {len(api_secret)}"
#                 )
#                 raise HTTPException(
#                     status_code=status.HTTP_400_BAD_REQUEST,
#                     detail={"message": error_msg, "code": "INVALID_CREDENTIALS_FORMAT"},
#                 )

#         # Check if credentials are not placeholders
#         if any(
#             x.lower() in ["api_key", "your_api_key_here"] for x in [api_key, api_secret]
#         ):
#             logger.warning(
#                 f"[Broker Verification] Placeholder API credentials for user: {email}"
#             )
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail={
#                     "message": "Please provide valid API credentials",
#                     "code": "INVALID_CREDENTIALS",
#                 },
#             )

#         try:
#             # Initialize the appropriate broker client based on broker_name
#             if broker_name.lower() == "coindcx":
#                 logger.info(
#                     f"[Broker Verification] Verifying CoinDCX credentials for user: {email}"
#                 )

#                 try:
#                     # Initialize CoinDCX client
#                     logger.info("[Broker Verification] Initializing CoinDCX client")
#                     try:
#                         client = BrokerUtils.init_coin_dcx_client(api_key, api_secret)
#                     except Exception as client_error:
#                         logger.error(
#                             f"[Broker Verification] Error initializing CoinDCX client: {str(client_error)}"
#                         )
#                         raise HTTPException(
#                             status_code=status.HTTP_400_BAD_REQUEST,
#                             detail={
#                                 "message": "Invalid API credentials for CoinDCX",
#                                 "code": "INVALID_CREDENTIALS",
#                             },
#                         )

#                     # Get account balance from CoinDCX
#                     logger.info("[Broker Verification] Fetching balances from CoinDCX")
#                     try:
#                         # Get futures wallet balance
#                         logger.info(
#                             "[Broker Verification] Fetching futures wallet from CoinDCX"
#                         )
#                         futures_wallet_response = client.get_futures_balance()
#                         logger.debug(
#                             f"[Broker Verification] Raw futures wallet response: {futures_wallet_response}"
#                         )

#                         # Store futures wallet information for later use
#                         futures_wallets = {}
#                         inr_balance = 0.0
#                         usd_balance = 0.0
#                         if isinstance(futures_wallet_response, list):
#                             for wallet in futures_wallet_response:
#                                 wallet_currency = wallet.get(
#                                     "currency_short_name", ""
#                                 ).upper()
#                                 if wallet_currency:
#                                     futures_wallets[wallet_currency] = wallet
#                                     if wallet_currency == "INR":
#                                         inr_balance = float(wallet.get("balance", 0.0))
#                                     elif wallet_currency == "usd":
#                                         usd_balance = float(wallet.get("balance", 0.0))

#                             logger.info(
#                                 f"[Broker Verification] Found {len(futures_wallets)} futures wallets"
#                             )
#                             user["futures_wallets"] = futures_wallets

#                         else:
#                             logger.warning(
#                                 f"[Broker Verification] Unexpected futures wallet response format: {type(futures_wallet_response)}"
#                             )

#                     except Exception as api_error:
#                         logger.error(
#                             f"[Broker Verification] Error fetching balances from CoinDCX: {str(api_error)}"
#                         )
#                         raise HTTPException(
#                             status_code=status.HTTP_400_BAD_REQUEST,
#                             detail={
#                                 "message": "Failed to connect to CoinDCX. Please check your API credentials and try again.",
#                                 "code": "BROKER_CONNECTION_FAILED",
#                             },
#                         )

#                     # Process balances
#                     logger.info(
#                         "[Broker Verification] Processing balances from CoinDCX"
#                     )

#                 except Exception as e:
#                     logger.error(
#                         f"[Broker Verification] Error fetching balance from CoinDCX: {str(e)}"
#                     )
#                     raise HTTPException(
#                         status_code=status.HTTP_400_BAD_REQUEST,
#                         detail={
#                             "message": "Failed to fetch balance from CoinDCX. Please check your API credentials.",
#                             "code": "BROKER_CONNECTION_FAILED",
#                         },
#                     )

#             # Prepare user update data
#             current_time = datetime.utcnow().isoformat()

#             # Update user document with broker connection info
#             logger.debug(f"[Broker Verification] Current user document: {user}")

#             # Prepare update data
#             update_data = {
#                 "broker_connection": {
#                     "broker_name": broker_name,
#                     "broker_id": broker_id,
#                     "app_name": app_name,
#                     "api_key": api_key,
#                     "api_secret": api_secret,
#                     "verified_at": current_time,
#                     "last_verified": current_time,
#                     "status": "connected",
#                 },
#                 # Using dot notation to update specific currency in the balance object
#                 f"balance.inr": inr_balance,
#                 f"balance.usd": usd_balance,
#                 f"free_margin.inr": inr_balance,
#                 f"free_margin.usd": usd_balance,
#                 "api_verified": True,
#                 # Add futures wallet information
#                 "futures_wallets": futures_wallets,
#                 "api_verified_at": current_time,
#                 "updated_at": current_time,
#             }

#             # Only update strategies if they don't exist
#             if "strategies" not in user:
#                 update_data["strategies"] = {}

#             if currency:
#                 update_data["currency"] = currency

#             # Define base_balance
#             if currency == "usd":
#                 base_balance = usd_balance
#             elif currency == "INR":
#                 base_balance = inr_balance
#             else:
#                 base_balance = 0.0

#             update_data["api_verified"] = True
#             # Log the update operation details
#             logger.debug(f"[Broker Verification] Update operation data: {update_data}")
#             logger.debug(
#                 f"[Broker Verification] Current balance field type: {type(user.get('balance'))}"
#             )
#             logger.debug(
#                 f"[Broker Verification] Current balance value: {user.get('balance')}"
#             )

#             try:
#                 # First try to update with $set using dot notation
#                 result = await app.state.storage.users_collection.update_one(
#                     {"email": email}, {"$set": update_data}, upsert=False
#                 )

#                 if result.matched_count == 0:
#                     # If no document was matched, try with upsert
#                     logger.debug(
#                         "[Broker Verification] No document matched, trying upsert"
#                     )
#                     update_data.update({"created_at": current_time, "status": "active"})
#                     if "strategies" not in update_data:
#                         update_data["strategies"] = {}

#                     result = await app.state.storage.users_collection.update_one(
#                         {"email": email}, {"$set": update_data}, upsert=True
#                     )

#                 logger.debug(
#                     f"[Broker Verification] Update result: {result.raw_result}"
#                 )

#             except Exception as update_error:
#                 logger.error(
#                     f"[Broker Verification] Error during update operation: {str(update_error)}"
#                 )
#                 logger.error(
#                     f"[Broker Verification] Update data that caused error: {update_data}"
#                 )
#                 logger.error(f"[Broker Verification] Current user document: {user}")
#                 raise

#             logger.info(
#                 f"[Broker Verification] Successfully verified and updated user: {email}"
#             )

#             # Return success response
#             response_data = {
#                 "success": True,
#                 "message": "Broker account verified successfully",
#                 "data": {
#                     "email": email,
#                     "api_verified": True,
#                     "broker_name": broker_name,
#                     "balance": {currency.lower(): base_balance},
#                     "free_margin": {currency.lower(): base_balance},
#                     "currency": currency,
#                 },
#             }

#             return response_data

#         except HTTPException as he:
#             raise he
#         except HTTPException:
#             raise
#         except Exception as e:
#             error_msg = f"[Broker Verification] Error during {broker_name} verification: {str(e)}"
#             logger.error(error_msg, exc_info=True)
#             raise HTTPException(
#                 status_code=status.HTTP_400_BAD_REQUEST,
#                 detail={
#                     "message": f"Failed to verify {broker_name} credentials",
#                     "code": "BROKER_VERIFICATION_FAILED",
#                     "details": str(e),
#                 },
#             )

#     except HTTPException as he:
#         raise he
#     except Exception as e:
#         logger.error(f"[Broker Verification] Unexpected error: {str(e)}", exc_info=True)
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail={
#                 "message": "An unexpected error occurred",
#                 "code": "INTERNAL_SERVER_ERROR",
#             },
#         )


# Cache for strategies data
strategies_cache = {"data": None, "timestamp": 0}
STRATEGIES_CACHE_TTL = 3600  # 1 hour in seconds

@app.get("/api/positions/live")
async def get_live_positions(
    email: str = Query(..., description="Email of the user whose positions to retrieve")
):
    try:
        if not email or not isinstance(email, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Query parameter 'email' is required and must be a string",
            )

        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # now find user strategy deployed
        strategies = user.get("strategies", None)
        if not strategies:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User has no strategies deployed",
            )

        print("strategies", strategies)

        # Handle both string and dictionary strategy formats
        deployed_strategies = []
        for strategy_key, strategy_value in strategies.items():
            if isinstance(strategy_value, dict):
                if strategy_value.get("status") == "active":
                    deployed_strategies.append({
                        "name": strategy_key, 
                        "status": "active",
                        "config": strategy_value
                    })
            elif isinstance(strategy_value, str):
                # If strategy is a string, treat it as an active strategy
                deployed_strategies.append({"name": strategy_key, "status": "active"})

        if not deployed_strategies:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User has no active strategies",
            )

        print("deployed_strategies", deployed_strategies)
        
        # check deployed strategies have any running or open positions
        open_positions = []
        for strategy in deployed_strategies:
            strategy_name = strategy.get("name")
            positions = await app.state.storage.positions_collection.find_one(
                {"Strategy": strategy_name, "Status": "Open"}, sort=[("_id", -1)]
            )
            if positions:
                open_positions.append(positions)

        print("open_positions", open_positions)

        if not open_positions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User has no open positions",
            )

        response_data = []
        for position in open_positions:
            try:
                side = position.get("Side").lower()
                strategy_id = position.get("Strategy")
                position_id = str(position["ID"])
                
                print(f"Processing position - side: {side}, strategy_id: {strategy_id}, position_id: {position_id}")

                # Get the clientTrades collection
                client_trades_collection = app.state.storage.client_trades_collection

                # Try multiple query variations to find the trade
                query_variations = [
                    # Original query
                    {
                        "userId": email,
                        "side": side,
                        "strategyId": strategy_id,
                        "trade_id": position_id,
                    },
                    # Try without trade_id
                    {
                        "userId": email,
                        "side": side,
                        "strategyId": strategy_id,
                    },
                    # Try with different case for side
                    {
                        "userId": email,
                        "side": side.capitalize(),
                        "strategyId": strategy_id,
                    },
                    # Try with original case from position
                    {
                        "userId": email,
                        "side": position.get("Side"),
                        "strategyId": strategy_id,
                    }
                ]

                user_trade = None
                for query in query_variations:
                    print(f"Trying query: {query}")
                    user_trade = await client_trades_collection.find_one(query)
                    if user_trade:
                        print(f"Found trade with query: {query}")
                        break

                # If still no trade found, let's check what trades exist for this user
                if not user_trade:
                    print("No trade found, checking all trades for user...")
                    all_user_trades = await client_trades_collection.find(
                        {"userId": email}
                    ).to_list(length=100)
                    print(f"All user trades: {all_user_trades}")
                    
                    # Try to find by strategy only
                    strategy_trades = await client_trades_collection.find(
                        {"userId": email, "strategyId": strategy_id}
                    ).to_list(length=100)
                    print(f"Strategy trades: {strategy_trades}")
                    
                    # Use the most recent trade for this strategy if available
                    if strategy_trades:
                        user_trade = strategy_trades[-1]  # Get the last one
                        print(f"Using most recent strategy trade: {user_trade}")

                if user_trade:
                    symbol = position.get("Symbol")
                    # Convert symbol format from 'ETH-usd' to 'ETHusd' to match ticks collection
                    ticker_symbol = symbol.replace("-", "") if "-" in symbol else symbol
                    
                    tick = await app.state.storage.ticks_collection.find_one(
                        {"symbol": ticker_symbol}
                    )
                    
                    close_price = float(tick.get("close")) if tick else None
                    
                    # Handle case where close_price is None
                    if close_price is None:
                        print(f"No tick data found for {ticker_symbol}, using entry price")
                        close_price = float(position.get("EntryPrice", 0))
                    
                    # Calculate PnL
                    avg_price = float(user_trade.get("avg_price", user_trade.get("price", position.get("EntryPrice"))))
                    quantity = float(user_trade.get("quantity", position.get("Qty", 0)))
                    
                    pnl_point = (
                        close_price - avg_price
                        if side == "buy" 
                        else avg_price - close_price
                    )
                    
                    position_type = "LONG" if side in ["buy", "Buy"] else "SHORT"
                    
                    # Convert to INR if needed
                    if user.get("currency") == "INR":
                        final_pnl = pnl_point * quantity * 93.0
                    else:
                        final_pnl = pnl_point * quantity

                    response_data.append({
                        "avgPrice": avg_price,
                        "positionSide": position_type,
                        "positionAmt": quantity,
                        "leverage": user_trade.get("leverage", 1),
                        "markPrice": float(user_trade.get("price", avg_price)),
                        "symbol": symbol,
                        "ltp": close_price,
                        "unrealizedProfit": final_pnl,
                    })
                else:
                    print(f"No matching trade found for position {position_id}")
                    # Create a basic response using position data only
                    symbol = position.get("Symbol")
                    entry_price = float(position.get("EntryPrice", 0))
                    quantity = float(position.get("Qty", 0))
                    
                    # Get current price
                    ticker_symbol = symbol.replace("-", "") if "-" in symbol else symbol
                    tick = await app.state.storage.ticks_collection.find_one({"symbol": ticker_symbol})
                    close_price = float(tick.get("close")) if tick else entry_price
                    
                    # Calculate PnL based on position data
                    pnl_point = (
                        close_price - entry_price
                        if side in ["buy", "Buy"]
                        else entry_price - close_price
                    )
                    
                    position_type = "LONG" if side in ["buy", "Buy"] else "SHORT"
                    
                    if "ETH" in symbol:
                        final_pnl = pnl_point * quantity * 0.01
                        final_qty = quantity * 0.01
                    else:
                        final_pnl = pnl_point * quantity * 0.001
                        final_qty = quantity * 0.001

                    response_data.append({
                        "avgPrice": entry_price,
                        "positionSide": position_type,
                        "positionAmt": final_qty,
                        "leverage": 1,  # Default leverage
                        "markPrice": entry_price,
                        "symbol": symbol,
                        "ltp": close_price,
                        "unrealizedProfit": final_pnl,
                    })

            except Exception as e:
                logger.error(f"Error processing position: {str(e)}", exc_info=True)
                continue

        print("response_data", response_data)

        return JSONResponse(status_code=200, content=response_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_live_positions: {str(e)}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": "Internal server error"})

# @app.get("/api/positions/live")
# async def get_live_positions(
#     email: str = Query(..., description="Email of the user whose positions to retrieve")
# ):
#     try:
#         if not email or not isinstance(email, str):
#             raise HTTPException(
#                 status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
#                 detail="Query parameter 'email' is required and must be a string",
#             )

#         user = await app.state.storage.users_collection.find_one({"email": email})
#         if not user:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
#             )

#         # # now find user stategy deployed

#         strategies = user.get("strategies", None)
#         if not strategies:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="User has no strategies deployed",
#             )

#         print(strategies)

#         # Handle both string and dictionary strategy formats
#         deployed_strategies = []
#         open_positions = []
#         for strategy in strategies:
#             if isinstance(strategy, dict):
#                 if strategy.get("status") == "active":
#                     deployed_strategies.append(strategy)
#             elif isinstance(strategy, str):
#                 # If strategy is a string, treat it as an active strategy
#                 deployed_strategies.append({"name": strategy, "status": "active"})

#         if not deployed_strategies:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="User has no active strategies",
#             )

#         print("deployed_strategies", deployed_strategies)
#         # # check deployed strategies have any running or open positions
#         open_positions = []
#         for strategy in deployed_strategies:
#             strategy_name = strategy.get("name")
#             positions = await app.state.storage.positions_collection.find_one(
#                 {"Strategy": strategy_name, "Status": "Open"}, sort=[("_id", -1)]
#             )
#             if positions:
#                 open_positions.append(positions)

#         print("open_positions", open_positions)

#         if not open_positions:
#             raise HTTPException(
#                 status_code=status.HTTP_404_NOT_FOUND,
#                 detail="User has no open positions",
#             )

#         responce_data = []
#         for position in open_positions:
#             try:
#                 side = position.get("Side").lower()
#                 strategy_id = position.get("Strategy")
#                 print("side", side)
#                 print("strategy_id", strategy_id)

#                 # Get the clientTrades collection
#                 client_trades_collection = app.state.storage.client_trades_collection

#                 # Find the trade with exact strategyId match
#                 user_trade = await client_trades_collection.find_one(
#                     {
#                         "userId": email,
#                         "side": side,
#                         "strategyId": strategy_id,
#                         "trade_id": str(position["ID"]),
#                     }
#                 )

#                 print("user_trade", user_trade)
#                 if user_trade:
#                     symbol = position.get("Symbol")
#                     # Convert symbol format from 'ETH-usd' to 'ETHusd' to match ticks collection
#                     ticker_symbol = symbol.replace("-", "")
#                     tick = await app.state.storage.ticks_collection.find_one(
#                         {"symbol": ticker_symbol}
#                     )
#                     close_price = float(tick.get("close")) if tick else None
#                     pnl_point = (
#                         close_price - float(user_trade.get("avg_price"))
#                         if side == "buy"
#                         else float(user_trade.get("avg_price")) - close_price
#                     )
#                     positon_Type = "LONG" if side == "buy" else "SHORT"
#                     if user["currency"] == "INR":
#                         finalPnl = pnl_point * float(user_trade.get("quantity")) * 93.0
#                     else:
#                         finalPnl = pnl_point * float(user_trade.get("quantity"))

#                     responce_data.append(
#                         {
#                             "avgPrice": float(user_trade.get("avg_price")),
#                             "positionSide": positon_Type,  # user_trade.get('side'),
#                             "positionAmt": float(user_trade.get("quantity")),
#                             "leverage": user_trade.get("leverage"),
#                             "markPrice": float(user_trade.get("price")),
#                             "symbol": position.get("Symbol"),
#                             "ltp": close_price,
#                             "unrealizedProfit": finalPnl,
#                         }
#                     )

#             except Exception as e:
#                 logger.error(f"Error processing position: {str(e)}", exc_info=True)
#                 continue

#         print("data", responce_data)

#         return JSONResponse(status_code=200, content=responce_data)

#     except Exception as e:
#         logger.error(f"Unexpected error in get_live_positions: {str(e)}", exc_info=True)
#         return JSONResponse(status_code=200, content={})


@app.post("/api/update-balance")
async def update_balance(
    email: str = Query(..., description="Email of the user"),
    usd_balance: float = Query(..., description="New usd balance"),
    inr_balance: float = Query(0.0, description="New INR balance"),
):
    """
    Update user's balance in the database.

    Args:
                    email: User's email address
                    usd_balance: New usd balance
                    inr_balance: New INR balance (default: 0.0)

    Returns:
                    dict: Success message and updated balances
    """
    try:
        logger.info(f"[Update Balance] Updating balance for user: {email}")

        # Validate balances
        if usd_balance < 0 or inr_balance < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Balance values cannot be negative",
            )

        # Get user and update balances
        update_data = {
            "balance.usd": usd_balance,
            "balance.inr": inr_balance,
            "free_margin.usd": usd_balance,  # Update free margin to match balance
            "updated_at": datetime.now(),
        }

        result = await app.state.storage.users_collection.update_one(
            {"email": email}, {"$set": update_data}
        )

        if result.matched_count == 0:
            logger.error(f"[Update Balance] User not found: {email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        logger.info(f"[Update Balance] Successfully updated balance for user: {email}")

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "message": "Balance updated successfully",
                "data": {
                    "usd_balance": usd_balance,
                    "inr_balance": inr_balance,
                    "updated_at": datetime.now().isoformat(),
                },
            },
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error updating balance: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update balance",
        )

# Check user approval status
@app.get("/api/user/approved")
async def get_approved_users(email: str = Query(..., description="Email of the user")):
    try:
        # Decode email (in case of %40)
        decoded_email = urllib.parse.unquote(email)

        # Find the user
        user = await app.state.storage.users_collection.find_one(
            {"email": decoded_email}, {"_id": 0, "status": 1}
        )

        if not user:
            return {
                "status": "success",
                "message": "User not found.",
                "approved": False,
            }

        # Check if approved
        is_approved = user.get("status") == "Approved"
        logger.info(f"[DEBUG] User {decoded_email} status={user.get('status')} approved={is_approved}")

        return {
            "status": "success",
            "message": (
                "Your account is approved"
                if is_approved
                else "Your account is yet to be approved."
            ),
            "approved": is_approved,
        }

    except Exception as e:
        logger.error(f"Error getting approved users: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get approval status")

# @app.get("/api/user/approved")
# async def get_approved_users(email: str = Query(..., description="Email of the user")):
#     try:
#         # Decode URL-encoded email (convert %40 to @ etc.)
#         decoded_email = urllib.parse.unquote(email)

#         # Find the user document
#         user = await app.state.storage.users_collection.find_one(
#             {"email": decoded_email}, {"_id": 0}
#         )

#         if not user:
#             response_content = {
#                 "status": "success",
#                 "message": "User not found.",
#                 "approved": False,
#             }
#             return response_content

#         # Check if user is approved
#         is_approved = user.get("status") == "Approved"
#         logger.info(f"[DEBUG] User approval status: {is_approved}")

#         # Convert MongoDB document to JSON-serializable format using json_util
#         # This handles both ObjectId and datetime serialization
#         serialized_user = json_util.dumps(user)
#         user_dict = json_util.loads(serialized_user)

#         # Create a clean dictionary with primitive types for the user data
#         # Convert ObjectId to string and datetime to ISO format string
#         clean_user = {}
#         for key, value in user_dict.items():
#             if key == "_id":
#                 clean_user[key] = str(value)
#             elif isinstance(value, dict):
#                 clean_user[key] = (
#                     value  # Nested dictionaries are already converted by json_util
#                 )
#             elif (
#                 key in ["created_at", "updated_at", "approved_at"] and value is not None
#             ):
#                 clean_user[key] = (
#                     value["$date"]
#                     if isinstance(value, dict) and "$date" in value
#                     else value
#                 )
#             else:
#                 clean_user[key] = value

#         # Add additional balance information from futures wallet if available
#         if "futures_wallets" in user and user["futures_wallets"]:
#             # Get user's currency
#             currency = user.get("currency", "usd").upper()

#             # Extract futures wallet balance
#             if currency in user["futures_wallets"]:
#                 wallet = user["futures_wallets"][currency]
#                 futures_balance = float(wallet.get("balance", 0))
#                 locked_balance = float(wallet.get("locked_balance", 0))
#                 total_futures_balance = futures_balance + locked_balance

#                 # Add futures balance to the response
#                 clean_user["futures_balance"] = {
#                     "currency": currency,
#                     "available": futures_balance,
#                     "locked": locked_balance,
#                     "total": total_futures_balance,
#                 }

#                 logger.info(
#                     f"[User Approval] Including futures wallet balance for {email}: {total_futures_balance} {currency}"
#                 )
#             else:
#                 logger.info(
#                     f"[User Approval] No futures wallet found for currency {currency}"
#                 )

#         # Check if user has futures wallet data and extract balance info
#         futures_balance_info = None
#         if "futures_wallets" in user and user["futures_wallets"]:
#             futures_balance_info = {}
#             for currency, wallet in user["futures_wallets"].items():
#                 futures_balance_info[currency] = {
#                     "available": float(wallet.get("balance", 0)),
#                     "locked": float(wallet.get("locked_balance", 0)),
#                     "total": float(wallet.get("balance", 0))
#                     + float(wallet.get("locked_balance", 0)),
#                 }

#         response_content = {
#             "status": "success",
#             "message": (
#                 "Your account is approved"
#                 if is_approved
#                 else "Your account is yet to be approved."
#             ),
#             "approved": is_approved,
#             "user": clean_user,
#             "futures_wallets": futures_balance_info,
#         }

#         return response_content

#     except Exception as e:
#         logger.error(f"Error getting approved users: {str(e)}", exc_info=True)
#         raise HTTPException(status_code=500, detail="Failed to get approval status")


#####################  Notifications #####################


# Get Active Notifications for a User
@app.get("/api/notifications")
async def get_notifications(
    platform: str = "WEB", user_type: str = "ALL", user_email: str = Query(...)
):

    now = datetime.now(timezone.utc)

    # Fetch notifications that match either:
    # 1. General notifications for all users or specific user_types
    # 2. User-specific notifications for this email
    notifications_cursor = notifications.find(
        {
            "$and": [
                {
                    "is_dismissed": False,
                    "platform": platform.upper(),
                    "start_time": {"$lte": now},
                },
                {
                    "$or": [
                        {"user_type": {"$in": [user_type.upper(), "ALL"]}},
                        {"user_type": user_email},  # User-specific notifications
                    ]
                },
            ]
        }
    ).sort("start_time", -1)

    notifications_data = await notifications_cursor.to_list(
        length=100
    )  # Limit to 100 notifications

    results = []

    for notif in notifications_data:
        # Skip if this is a user-specific notification for a different user
        if (
            notif["user_type"] not in ["ALL", user_type.upper()]
            and notif["user_type"] != user_email
        ):
            continue

        # Check if this user has dismissed it
        dismissed = await userNotifications.find_one(
            {
                "notification_id": notif["_id"],
                "user_email": user_email,
                "is_dismissed": True,
            }
        )
        if dismissed:
            continue  # Skip this notification for this user

        # Check if this user has read it
        read_entry = await userNotifications.find_one(
            {"notification_id": notif["_id"], "user_email": user_email}
        )

        results.append(
            {
                "id": str(notif["_id"]),
                "title": notif["title"],
                "message": notif["message"],
                "type": notif["notification_type"].lower(),
                "time": notif["start_time"].strftime("%b %d, %I:%M %p"),
                "read": read_entry.get("is_read", False) if read_entry else False,
            }
        )

    return results


# Create Notification
@app.post("/api/notifications")
async def create_notification(notification: NotificationCreate):
    print("POST /api/notifications hit!")  # Add this
    print("Payload received:", notification.model_dump())
    notification_dict = notification.model_dump()
    now = datetime.now(timezone.utc)
    notification_dict["created_at"] = notification_dict.get("created_at") or now
    notification_dict["last_updated_at"] = now

    result = await notifications.insert_one(notification_dict)
    notification_dict["_id"] = result.inserted_id
    return notification_serializer(notification_dict)


# Mark a notification as read
@app.post("/api/notifications/{notif_id}/read")
async def mark_as_read(notif_id: str, user_email: str = Query(...)):
    await userNotifications.update_one(
        {"notification_id": ObjectId(notif_id), "user_email": user_email},
        {"$set": {"is_read": True}},
        upsert=True,
    )
    return {"message": "Marked as read for user"}


# Dismiss a notification
@app.post("/api/notifications/{notif_id}/dismiss")
async def dismiss_notification(notif_id: str, user_email: str = Query(...)):
    await userNotifications.update_one(
        {"notification_id": ObjectId(notif_id), "user_email": user_email},
        {"$set": {"is_dismissed": True}},
        upsert=True,  # Agar pehle entry nahi hai to bana do
    )
    return {"message": "Dismissed for user"}


#####################  User management  #####################


# Fetch all users
@app.get("/api/all-users", status_code=status.HTTP_200_OK)
async def get_all_users():
    all_user = app.state.storage.users_collection.find({})
    users = []
    async for user in all_user:
        user["_id"] = str(user["_id"])  # convert ObjectId to string
        users.append(user)
    return {
        "success": True,
        "count": len(users),
        "users": users
    }



# Update the user status
# @app.put("/api/admin/users/update/")
# async def approve_user_status(
#     email: str = Query(..., description="User's email address"),
#     new_status: str = Query(..., description="Only 'Approved' is accepted"),
# ):

#     user = await app.state.storage.users_collection.find_one({"email": email})
#     if not user:
#         raise HTTPException(
#             status_code=404,
#             detail=f"User {email} not found.",
#         )

#     if user and user["status"] == "Approved":
#         raise HTTPException(
#             status_code=400,
#             detail=f"User {email} has already been approved.",
#         )

#     if new_status != "Approved":
#         raise HTTPException(
#             status_code=400, detail="Invalid status. Only 'Approved' is allowed."
#         )

#     result = await app.state.storage.users_collection.update_one(
#         {"email": email},
#         {"$set": {"status": "Approved", "approved_at": datetime.now(timezone.utc)}},
#     )

#     if result.modified_count == 0:
#         raise HTTPException(
#             status_code=404,
#             detail=f"Something went wrong while approving user {email}.",
#         )

#     return JSONResponse(
#         status_code=200, content={"message": f"User {email} has been approved."}
#     )

# Get user role by email
@app.get("/api/get-role")
async def get_user_role(email: str = Query(..., description="User email to check role")):
    """
    Returns the role of a user by their email.
    """
    try:
        user = await app.state.storage.users_collection.find_one({"email": email})

        if not user:
            return JSONResponse(status_code=404, content={"success": False, "message": "User not found"})

        role = user.get("role", "user")  # Default to 'user' if not set
        return {"success": True, "email": email, "role": role}

    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "message": str(e)})



# Get approved users
@app.get("/api/user/approved")
async def get_approved_users(email: str = Query(..., description="Email of the user")):
    try:
        decoded_email = urllib.parse.unquote(email)

        user = await app.state.storage.users_collection.find_one(
            {"email": decoded_email}, {"_id": 0}
        )

        if not user:
            return {
                "status": "success",
                "message": "User not found.",
                "approved": False,
            }

        is_approved = user.get("status") == "Approved"

        # --- Clean user dict (no need for json_util roundtrip) ---
        clean_user = {}
        for key, value in user.items():
            if isinstance(value, datetime):
                clean_user[key] = value.isoformat()
            else:
                clean_user[key] = value

        # --- Futures wallet parsing ---
        futures_balance_info = {}
        if "futures_wallets" in user:
            for currency, wallet in user["futures_wallets"].items():
                if isinstance(wallet, dict):  # expected structure
                    available = float(wallet.get("balance", 0))
                    locked = float(wallet.get("locked_balance", 0))
                else:  # fallback: wallet is just a number
                    available = float(wallet)
                    locked = 0.0

                futures_balance_info[currency] = {
                    "available": available,
                    "locked": locked,
                    "total": available + locked,
                }

        return {
            "status": "success",
            "message": "Your account is approved" if is_approved else "Your account is yet to be approved.",
            "approved": is_approved,
            "user": clean_user,
            "futures_wallets": futures_balance_info,
        }

    except Exception as e:
        logger.error(f"Error getting approved users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to get approval status")


######################## Analytics Endpoints ########################

# Fetch active users
@app.get("/api/active-users", status_code=status.HTTP_200_OK)
async def get_connected_users():
    try:
        cursor = app.state.storage.users_collection.find({
            "broker_connection": {
                "$exists": True,
                "$ne": None
            },
            "broker_connection.status": "connected"
        })

        connected_users = []
        async for user in cursor:
            user["_id"] = str(user["_id"])  # convert ObjectId to string
            connected_users.append(user)

        return {
            "success": True,
            "count": len(connected_users),
            "users": connected_users}

    except Exception as e:
        # Log error if you have logger configured
        # logger.error(f"Error fetching active users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# Fetch total funds
@app.get("/api/total-funds", status_code=status.HTTP_200_OK)
async def get_total_funds():
    try:
        total_futures_balance = 0.0

        cursor = app.state.storage.users_collection.find({
            "balance.usd": {"$exists": True}
        })

        async for user in cursor:
            try:
                wallet = float(user.get("balance", {}).get("usd", 0))
                total_futures_balance += wallet
            except (TypeError, ValueError):
                # Skip invalid wallet values
                continue

        return {
            "success": True,
            "total_futures_wallets_usd": total_futures_balance
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


# Fetch total funds deployed
@app.get("/api/total-funds-deployed", status_code=status.HTTP_200_OK)
async def get_total_funds_deployed():
    """
    Calculate the total funds deployed across all users.
    Only counts funds if the user has strategies deployed AND their status is 'active'.
    """
    try:
        total_used_margin = 0.0

        # Fetch all users with strategies
        cursor = app.state.storage.users_collection.find({
            "strategies": {"$exists": True, "$ne": {}}
        })

        async for user in cursor:
            try:
                strategies = user.get("strategies", {})
                currency = user.get("currency", "usd").lower()

                # Check if at least one strategy is active
                active_strategies = [
                    s for s in strategies.values()
                    if s and s.get("status") == "active"
                ]

                if not active_strategies:
                    continue  # skip if no active strategies

                # Add user's used margin (only if active strategies exist)
                wallet = float(user.get("used_margin", {}).get(currency, 0))
                total_used_margin += wallet

            except (TypeError, ValueError):
                # Skip invalid values
                continue

        return {
            "success": True,
            "total_used_margin": total_used_margin
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# Fetch total volumes generated

@app.get("/api/total-volumes-generated", status_code=status.HTTP_200_OK)
async def get_total_volume_generated():
    try:
        total_volumes = 0.0

        cursor = app.state.storage.client_trades_collection.find({
            "price": {"$exists": True, "$ne": None},
            "qty": {"$exists": True, "$ne": None},  
            "symbol": {"$exists": True, "$ne": None}
        })

        async for client_trade in cursor:
            try:
                price = float(client_trade.get("price", 0) or 0)
                quantity = float(client_trade.get("qty", 0) or 0)
                symbol = client_trade.get("symbol", "")
                
                if symbol.startswith("ETH"):
                    total_volumes += price * quantity * 0.01
                else:
                    total_volumes += price * quantity * 0.001
                
            except (TypeError, ValueError):
                # Skip bad values
                continue

        return {
            "success": True,
            "total_volumes": round(total_volumes, 2)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# @app.get("/api/total-volumes-generated", status_code=status.HTTP_200_OK)
# async def get_total_volume_generated():
#     try:
#         total_volumes = 0.0

#         cursor = app.state.storage.client_trades_collection.find({
#             "price": {"$exists": True, "$ne": None},
#             "quantity": {"$exists": True, "$ne": None}
#             "symbol": {"$exists": True, "$ne": None}
#         })

#         async for client_trade in cursor:
#             try:
#                 price = float(client_trade.get("price", 0) or 0)
#                 quantity = float(client_trade.get("quantity", 0) or 0)
#                 symbol = client_trade.get("symbol", "")
#                 if symbol.startswith("ETH"):
#                     total_volumes += price * quantity * 0.01
#                 else:
#                     total_volumes += price * quantity * 0.001
                
#             except (TypeError, ValueError):
#                 # Skip bad values
#                 continue

#         return {
#             "success": True,
#             "total_volumes": round(total_volumes, 2)
#         }

#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"Internal server error: {str(e)}"
#         )

# Fetch active strategies


@app.get("/api/active-strategies", status_code=status.HTTP_200_OK)
async def get_active_strategies_count():
    """
    Returns the total count of active strategies deployed by all users.
    """
    try:
        total_strategies_count = 0

        cursor = app.state.storage.users_collection.find(
            {"strategies": {"$exists": True, "$ne": []}},
            {"strategies": 1}
        )

        async for user in cursor:
            total_strategies_count += len(user.get("strategies", []))

        return {
            "success": True,
            "total_active_strategies": total_strategies_count
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

# Fetch all strategies


@app.get("/api/total-strategies", status_code=status.HTTP_200_OK)
async def get_total_strategies():
    """
    Returns the total number of strategies in the strategies_collection.
    """
    try:
        count = await app.state.storage.strategies_collection.count_documents({})
        return {
            "success": True,
            "total_strategies": count
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


####################################### HISTORICAL DATA #######################################

@app.get("/api/user/client-history", status_code=status.HTTP_200_OK)
async def get_client_trade_history(
    email: str = Query(..., description="User email"),
    page: int = Query(1, description="Page number", ge=1),
    page_size: int = Query(
        20, description="Number of trades per page", ge=1, le=100),
):
    """
    Returns paginated trade history for the given user email, sorted by created_at (latest first).
    Excludes trades where AverageFillPrice is null.
    """
    try:
        client_history_collection = app.state.storage.client_history_collection

        # Filter condition: exclude trades with null AverageFillPrice
        filter_condition = {
            "user_id": email,
            "AverageFillPrice": {"$ne": None}
        }

        # Count total trades (excluding null AverageFillPrice)
        total_trades = await client_history_collection.count_documents(filter_condition)
        total_pages = ceil(total_trades / page_size) if total_trades > 0 else 1

        # Fetch trades with pagination (sorted by created_at descending)
        trades = (
            client_history_collection
            .find(filter_condition, {"_id": 0})
            .sort("CreatedAt", -1)  # latest first - using CreatedAt as shown in your data
            .skip((page - 1) * page_size)
            .limit(page_size)
        )
        trades_list = await trades.to_list(length=page_size)

        return {
            "status": "success",
            "page": page,
            "page_size": page_size,
            "total_trades": total_trades,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
            "next_page": page + 1 if page < total_pages else None,
            "previous_page": page - 1 if page > 1 else None,
            "data": trades_list,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# @app.get("/api/user/client-history", status_code=status.HTTP_200_OK)
# async def get_client_trade_history(
#     email: str = Query(..., description="User email"),
#     page: int = Query(1, description="Page number", ge=1),
#     page_size: int = Query(
#         20, description="Number of trades per page", ge=1, le=100),
# ):
#     """
#     Returns paginated trade history for the given user email, sorted by created_at (latest first).
#     """
#     try:
#         client_history_collection = app.state.storage.client_history_collection

#         # Count total trades
#         total_trades = await client_history_collection.count_documents({"user_id": email})
#         total_pages = ceil(total_trades / page_size) if total_trades > 0 else 1

#         # Fetch trades with pagination (sorted by created_at descending)
#         trades = (
#             client_history_collection
#             .find({"user_id": email}, {"_id": 0})
#             .sort("created_at", -1)  # latest first
#             .skip((page - 1) * page_size)
#             .limit(page_size)
#         )
#         trades_list = await trades.to_list(length=page_size)

#         return {
#             "status": "success",
#             "page": page,
#             "page_size": page_size,
#             "total_trades": total_trades,
#             "total_pages": total_pages,
#             "has_next": page < total_pages,
#             "has_previous": page > 1,
#             "next_page": page + 1 if page < total_pages else None,
#             "previous_page": page - 1 if page > 1 else None,
#             "data": trades_list,
#         }

#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=str(e)
#         )


################################### Strategy Information ###################################

# Fetch strategy information
@app.get("/api/fetch_strategy_info")
async def get_trading_configs(symbol: str = Query(None, description="Symbol filter e.g. BTC or ETH")):
    try:
        query = {}
        if symbol:
            query["SYMBOL"] = symbol.upper()

        configs = []
        async for cfg in app.state.storage.trading_configs.find(query):
            configs.append(cfg)

        return {
            "status": "success",
            "count": len(configs),
            "configs": configs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching configs: {str(e)}")
  

# Update strategy
@app.put("/api/update_strategy/")
async def update_trading_config(symbol: str, config: TradingConfig):
    try:
        symbol = symbol.upper()

        # enforce that SYMBOL in body matches path param
        if config.SYMBOL.upper() != symbol:
            raise HTTPException(
                status_code=400,
                detail=f"Symbol mismatch: path={symbol}, body={config.SYMBOL}"
            )

        # update (or insert if not exists)
        result = await app.state.storage.trading_configs.update_one(
            {"SYMBOL": symbol},
            {"$set": config.dict()},
            upsert=True
        )

        return {
            "status": "success",
            "message": f"Config for {symbol} updated successfully",
            "new_config": config.dict()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating config: {str(e)}")

# Helper function to fetch and update balances
async def refresh_latestbalance(email: str):
    try:
        # get user
        user = await app.state.storage.users_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        creds = user.get("broker_connection", {})
        api_key = creds.get("api_key")
        api_secret = creds.get("api_secret")
        if not api_key or not api_secret:
            raise HTTPException(status_code=400, detail="API keys not configured")

        
        # Determine broker
        # Determine broker and preferred currency
        broker_name = creds.get("broker_name", "delta_exchange").lower()
        currency_pref = creds.get("currency", "USD").upper()

        usd_balance = 0.0
        inr_balance = 0.0

        if broker_name == "delta_exchange":
            base_url = "https://api.india.delta.exchange"
            client = DeltaRestClient(api_key=api_key, api_secret=api_secret, base_url=base_url)
            balances_response = client.get_wallet_balances()

            for wallet in balances_response:
                if wallet["asset_symbol"].upper() == "USD":
                    usd_balance = float(wallet["balance"])
                    break
            inr_balance = 0.0  # Delta always has 0 INR

        elif broker_name == "coindcx":
            client = CoinDcxClient(api_key=api_key, secret_key=api_secret)
            balances_response = client.get_balances()

            for wallet in balances_response:
                currency = wallet.get("currency", "").upper()
                balance = float(wallet.get("balance", 0))
                if currency in ["USD", "USDT"]:
                    usd_balance = balance
                elif currency == "INR":
                    inr_balance = balance

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported broker {broker_name}")

        # select balance according to user's preferred currency
        selected_balance = usd_balance if currency_pref == "USD" else inr_balance


        # update MongoDB (no wallets field)
        await app.state.storage.users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "futures_wallets.usd": usd_balance,
                    "balance.usd": usd_balance,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )

        return {
            "success": True,
            "futures_wallets": {currency_pref.lower(): selected_balance},
            "balance": {currency_pref.lower(): selected_balance},
            "currency": currency_pref
        }



    except Exception as e:
        logger.error(f"Error updating balance for {email}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 🔹 API to refresh balance (POST)
@app.post("/api/user/refresh-balance")
async def refresh_balance(email: str = Query(...)):
    result = await refresh_latestbalance(email)
    return result


# 🔹 API to fetch just the USD balance (GET)
@app.get("/api/user/refreshed_wallet", status_code=status.HTTP_200_OK)
async def get_user_selected_wallet(
    email: str = Query(..., description="Email of the user")
):
    """
    Fetch the wallet balance for the user's selected currency (futures_wallets[selected_currency]) as a float.
    """
    try:
        result = await refresh_latestbalance(email)
        currency_pref = result.get("currency", "USD").upper()
        selected_balance = result["futures_wallets"].get(currency_pref.lower(), 0.0)
        return float(selected_balance)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


class RoleUpdateRequest(BaseModel):
    email: str
    new_role: Literal["user", "admin", "superadmin"]

@app.put("/api/update-user-role")
async def update_user_role(data: RoleUpdateRequest):
    result = await app.state.storage.users_collection.update_one(
        {"email": data.email},
        {"$set": {"role": data.new_role}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "success": True,
        "message": f"User role updated to '{data.new_role}' for {data.email}"
    }


# Main entry point
if __name__ == "__main__":
    import uvicorn
    import sys

    port = int(os.getenv("PORT", 8001))
    logger.info(f"Server starting on port {port}")

    uvicorn.run(
        "backend:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=3,
        log_level="info",
        timeout_keep_alive=65,
        access_log=False,
    )
