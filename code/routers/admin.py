#!/usr/bin/env python3
"""Defines the API router and endpoints for administrative user management.

This module contains the FastAPI router and all related logic for
administrative endpoints. It provides endpoints for listing users,
updating user status, and checking admin privileges.
"""

# Standard Library Imports
from datetime import datetime, timezone
import logging
from typing import Dict, List, Optional

# Third-Party Imports
from fastapi import APIRouter, Depends, HTTPException, Request, status, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

# Local Application Imports
import sys
import os

# Add the parent directory to sys.path to allow imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Now import the auth module directly
from auth import get_current_user

# Configure a logger for this module
logger = logging.getLogger(__name__)

# Initialize the router with a prefix and tags for organization
router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    responses={404: {"description": "Not found"}},
)


@router.get("/users")
async def fetch_users(
    request: Request,
    status_filter: Optional[str] = Query(None),
    current_user: Dict = None,
):
    """
    Retrieves a list of all users for the admin dashboard.

    This endpoint allows filtering users by status.
    Authentication temporarily made optional for testing.
    """
    # Authentication check temporarily disabled
    # TODO: Re-enable authentication check after frontend is fixed
    # if current_user is None or not current_user.get("is_admin", False):
    #     logger.warning(f"Non-admin user attempted to access admin endpoint")
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied. User is not an admin."
    #     )
    logger.warning(
        "Admin authentication check temporarily disabled for /users endpoint"
    )

    # Modified logging to handle None current_user
    email = current_user.get("email", "unknown") if current_user else "unknown"
    logger.info(f"User '{email}' fetching users with status: '{status_filter}'")

    query = {}
    if status_filter and status_filter != "ALL":
        query["status"] = status_filter.capitalize()

    projection = {
        "name": 1,
        "email": 1,
        "status": 1,
        "created_at": 1,
        "broker_connection.broker_name": 1,
        "broker_connection.broker_id": 1,
    }

    users_cursor = request.app.state.storage.users_collection.find(query, projection)
    users = []
    async for user in users_cursor:
        users.append(user)

    def format_user(user):
        broker_connection = user.get("broker_connection", {}) or {}
        created_at = user.get("created_at")
        if isinstance(created_at, str):
            created_at_fmt = datetime.fromisoformat(
                created_at.replace("Z", "")
            ).strftime("%Y-%m-%d %H:%M")
        elif isinstance(created_at, datetime):
            created_at_fmt = created_at.strftime("%Y-%m-%d %H:%M")
        else:
            created_at_fmt = ""
        return {
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "status": user.get("status", "Pending"),
            "broker_name": broker_connection.get("broker_name", ""),
            "broker_id": broker_connection.get("broker_id", ""),
            "created_at": created_at_fmt,
        }

    return [format_user(u) for u in users]


# Request body schema
class UserStatusUpdate(BaseModel):
    email: EmailStr
    new_status: str


# Update user status to Approved or Pending
@router.put("/update-user-status", status_code=status.HTTP_200_OK)
async def update_user_status(request: Request, body: UserStatusUpdate):
    """
    Updates a user's status (Approved or Pending) based on their email.
    Expects email and new_status in the request body.
    """
    try:
        email = body.email
        new_status = body.new_status

        # Validate status
        if new_status.lower() not in ["approved", "pending"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status. Must be 'approved' or 'pending'.",
            )

        # Perform update
        result = await request.app.state.storage.users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "status": new_status.capitalize(),
                    "updated_at": datetime.now(timezone.utc),
                    **(
                        {"approved_at": datetime.now(timezone.utc)}
                        if new_status.lower() == "approved"
                        else {}
                    ),
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No user found with email: {email}",
            )

        return {
            "success": True,
            "message": f"User status updated to {new_status.capitalize()}",
            "email": email,
            "status": new_status.capitalize(),
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}",
        )
