#!/usr/bin/env python3
"""Handles API endpoints for managing user trading strategies.

This module provides the API router for strategy-related operations.
It includes an endpoint that allows authenticated users to update the
status of their trading strategies, such as pausing or activating them.
The primary function `update_strategy_status` handles the logic for
modifying the strategy's state in the database.
"""

from fastapi import APIRouter, HTTPException, Request, status, Query
from pydantic import BaseModel
from typing import Dict, Literal
import logging
from datetime import datetime, timezone
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# from auth import get_current_user  # Temporarily disabled for testing

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/strategy",
    tags=["Strategy"],
    responses={404: {"description": "Not found"}},
)


class StrategyStatusRequest(BaseModel):
    strategy_name: str
    status: Literal['active', 'paused']


class StrategyStatusResponse(BaseModel):
    success: bool
    message: str


@router.put("/status", response_model=StrategyStatusResponse)
async def update_strategy_status(
    request: Request,
    status_request: StrategyStatusRequest,
    email: str = Query(
        ..., description="The email of the user whose strategy is being updated"
    ),
):
    """
    Update the status of a user's strategy (e.g., 'active', 'paused').

    This endpoint allows a client to change the status of a user's trading
    strategy (e.g., to 'active' or 'paused').

    NOTE: This endpoint is temporarily configured for testing and identifies
    the user via an 'email' query parameter without authentication. This is
    insecure and should be reverted to token-based auth for production.

    Args:
        request (Request): The incoming FastAPI request object, used to access
            application state such as the database connection.
        status_request (StrategyStatusRequest): The request body containing the
            details of the strategy to update.
            - strategy_name (str, required): The name of the strategy to
            modify.
            - status (str, required): The new status to set for the strategy.
        email (str, required): The email of the user whose strategy is being
            updated. Passed as a URL query parameter.

    Returns:
        Dict: A dictionary confirming the successful update.
            - success (bool): Always True for a successful operation.
            - message (str): A message confirming the strategy status change.

    Raises:
        HTTPException (404 Not Found): If the user or the specified strategy
            is not found in the database.
        HTTPException (500 Internal Server Error): If the database update fails
            or an unexpected server error occurs.

    Examples:
        To pause a strategy named "ETH_Multiplier", a client would send a PUT
        request to the `/status` endpoint with the following JSON body:

        ```json
        {
            "strategy_name": "ETH_Multiplier",
            "status": "paused"
        }
        ```

        A successful response would be:
        ```json
        {
            "success": true,
            "message": "Strategy ETH_Multiplier has been set to paused."
        }
        ```
    """
    try:
        strategy_name = status_request.strategy_name
        new_status = status_request.status

        logger.info(
            f"Attempting to set status to '{new_status}' "
            f"for strategy '{strategy_name}' "
            f"for user '{email}'"
        )

        user = await request.app.state.storage.users_collection.find_one(
            {"email": email}
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        if "strategies" not in user or strategy_name not in user["strategies"]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Strategy {strategy_name} not found for user.",
            )

        # Update the strategy status
        result = await request.app.state.storage.users_collection.update_one(
            {"email": email},
            {
                "$set": {
                    f"strategies.{strategy_name}.status": new_status,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        if result.modified_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update strategy status.",
            )

        logger.info(
            f"Successfully updated strategy '{strategy_name}' "
            f"to '{new_status}' "
            f"for user '{email}'"
        )
        return {
            "success": True,
            "message": (
                f"Strategy {strategy_name} has been set to {new_status}."
            ),
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(
            f"Error updating strategy status: {str(e)}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred.",
        )
