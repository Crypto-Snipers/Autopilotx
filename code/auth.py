#!/usr/bin/env python3
"""Provides core authentication and session management services.

This module centralizes all logic related to user authentication for the
FastAPI application. It includes a reusable dependency, `get_current_user`,
which validates JSON Web Tokens (JWTs) from request headers or sessions to
identify and return the authenticated user. Additionally, it contains a
simple, time-based `SessionCache` for managing temporary session data.

Supports both custom JWT authentication and Supabase authentication.
"""

import logging
import os
import time
import json
import base64
from typing import Dict, Optional, Union, Any

# Load environment variables from .env file
from dotenv import load_dotenv

load_dotenv()

from fastapi import HTTPException, Request, status, Depends
from jose import JWTError, jwt
import httpx

logger = logging.getLogger(__name__)

# Load the secret key from an environment variable for security
JWT_SECRET = os.getenv("JWT_SECRET")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# It is critical to ensure the secret is set before the app runs.
if not JWT_SECRET:
    raise ValueError("No JWT_SECRET environment variable set for the application")
JWT_ALGORITHM = "HS256"

# NOTE: This is a simple in-memory cache suitable for single-process
# development. In a production environment with multiple workers, this will
# lead to inconsistent sessions. A shared cache like Redis or Memcached
# should be used for scalability.


class SessionCache:
    def __init__(self, expiry_time=3600):
        self.cache = {}
        self.expiry_time = expiry_time

    def get(self, key):
        """
        Retrieves an item from the cache if it exists and has not expired.
        """
        if key in self.cache:
            data, timestamp, expiry = self.cache[key]
            if time.time() - timestamp > expiry:
                del self.cache[key]
                return None
            return data
        return None

    def set(self, key, value, custom_expiry=None):
        """
        Adds an item to the cache with a specific or default expiry time.
        """
        # Use the custom expiry if provided, otherwise fall back to the
        # default. A custom_expiry of None will use the default.
        expiry = custom_expiry if custom_expiry is not None else self.expiry_time
        self.cache[key] = (value, time.time(), expiry)

    def delete(self, key):
        """Removes an item from the cache."""
        if key in self.cache:
            del self.cache[key]

    def clear_expired(self):
        """Removes all expired items from the cache."""
        current_time = time.time()
        expired_keys = [
            key
            for key, (_, timestamp, expiry) in self.cache.items()
            if current_time - timestamp > expiry
        ]
        for key in expired_keys:
            del self.cache[key]


# Initialize session cache
session_cache = SessionCache()


def decode_supabase_token(token: str) -> Dict:
    """
    Decode a Supabase JWT token without verification.
    This is useful for extracting claims from the token.

    Args:
        token: The JWT token from Supabase

    Returns:
        Dict containing the token claims
    """
    try:
        # Split the token into header, payload, and signature
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")

        # Decode the payload (second part)
        payload_bytes = base64.urlsafe_b64decode(
            parts[1] + "=" * (4 - len(parts[1]) % 4)
        )
        payload = json.loads(payload_bytes)
        return payload
    except Exception as e:
        logger.error(f"Error decoding Supabase token: {e}")
        raise ValueError(f"Invalid token format: {e}") from e


async def verify_supabase_token(token: str) -> Dict:
    """
    Verify a Supabase JWT token by making a request to the Supabase auth API.

    Args:
        token: The JWT token from Supabase

    Returns:
        Dict containing the user information if token is valid

    Raises:
        HTTPException: If token is invalid or verification fails
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Supabase URL or key not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase authentication not properly configured",
        )

    try:
        # First, decode the token to get the user ID without verification
        payload = decode_supabase_token(token)

        # Make a request to Supabase Auth API to verify the token
        async with httpx.AsyncClient() as client:
            headers = {"Authorization": f"Bearer {token}", "apikey": SUPABASE_KEY}

            # Get user information from Supabase
            response = await client.get(f"{SUPABASE_URL}/auth/v1/user", headers=headers)

            if response.status_code != 200:
                logger.warning(f"Supabase token verification failed: {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                )

            user_data = response.json()
            return user_data
    except ValueError as e:
        logger.warning(f"Invalid Supabase token format: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        ) from e
    except Exception as e:
        logger.error(f"Error verifying Supabase token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not verify token",
        ) from e


async def get_current_user(request: Request) -> Dict:
    """
    Dependency to get the current user from a JWT token.

    The token is retrieved from the 'Authorization: Bearer <token>' header
    or from the user's session. Supports both custom JWT tokens and Supabase tokens.

    Raises:
        HTTPException: 401 Unauthorized if token is missing or invalid.
        HTTPException: 404 Not Found if the user from the token does not exist.

    Returns:
        The user document from the database.
    """
    token = request.headers.get("Authorization")
    if token and token.startswith("Bearer "):
        token = token.split(" ")[1]
    else:
        token = request.session.get("token")

    if not token:
        logger.warning("Authentication attempt failed: No token in header or session.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
        )

    # Try to verify as a Supabase token first
    try:
        # Check if it's a Supabase token by looking at its structure
        payload = decode_supabase_token(token)

        # If it has Supabase-specific claims, treat it as a Supabase token
        if "aud" in payload and payload.get("aud") == "authenticated":
            # Verify the token with Supabase
            supabase_user = await verify_supabase_token(token)

            # Get the email from the Supabase user data
            email = supabase_user.get("email")
            if not email:
                logger.warning("Supabase token missing email claim")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing email",
                )

            # Look up the user in our database
            user = await request.app.state.storage.users_collection.find_one(
                {"email": email}
            )
            if user is None:
                logger.warning(
                    f"Supabase authenticated user not found in database: {email}"
                )
                # Return 401 instead of 404 to avoid leaking user existence information
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found.",
                )

            # Add Supabase user info to the user object
            user["supabase_user_id"] = supabase_user.get("id")
            logger.debug(f"User successfully authenticated via Supabase: {email}")
            return user
    except (ValueError, HTTPException) as e:
        # If it's not a valid Supabase token, fall back to our custom JWT verification
        if isinstance(e, ValueError):
            logger.debug(f"Not a valid Supabase token, trying custom JWT: {e}")
        else:
            # If it was an HTTP exception from Supabase verification, re-raise it
            raise e

    # Fall back to our custom JWT verification
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            logger.warning("Invalid token received: 'sub' (email) claim missing.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: subject missing.",
            )
        
    except JWTError as e:
        logger.warning(f"Token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
        ) from e

    user = await request.app.state.storage.users_collection.find_one({"email": email})
    if user is None:
        logger.warning(f"Authenticated user not found in database: {email}")
        # Return 401 instead of 404 to avoid leaking user existence information
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    logger.debug(f"User successfully authenticated with custom JWT: {email}")
    return user


async def get_current_supabase_user(request: Request) -> Dict:
    """
    Dependency to get the current user from a Supabase JWT token only.
    This is useful when you want to enforce Supabase authentication specifically.

    Args:
        request: The FastAPI request object

    Returns:
        Dict containing the user document from the database

    Raises:
        HTTPException: If token is missing, invalid, or user not found
    """
    token = request.headers.get("Authorization")
    if token and token.startswith("Bearer "):
        token = token.split(" ")[1]
    else:
        token = request.session.get("token")

    if not token:
        logger.warning("Authentication attempt failed: No token in header or session.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
        )

    # Verify the token with Supabase
    supabase_user = await verify_supabase_token(token)

    # Get the email from the Supabase user data
    email = supabase_user.get("email")
    if not email:
        logger.warning("Supabase token missing email claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing email",
        )

    # Look up the user in our database
    user = await request.app.state.storage.users_collection.find_one({"email": email})
    if user is None:
        logger.warning(f"Supabase authenticated user not found in database: {email}")
        # Return 401 instead of 404 to avoid leaking user existence information
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )

    # Add Supabase user info to the user object
    user["supabase_user_id"] = supabase_user.get("id")
    logger.debug(f"User successfully authenticated via Supabase: {email}")
    return user
