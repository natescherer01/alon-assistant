"""
Calendar-specific dependencies for FastAPI endpoints.

Provides dependencies for:
- Getting the current calendar user (creates if needed)
- Token encryption/decryption
- Rate limiting
"""
import os
import logging
from typing import Optional
from uuid import UUID
from datetime import datetime

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from database import get_db
from models import User
from auth.dependencies import get_current_user
from app.core.encryption import get_encryption_service

from cal.models import CalendarUser, CalendarConnection

logger = logging.getLogger(__name__)


async def get_calendar_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CalendarUser:
    """
    Get or create the calendar user for the authenticated main app user.

    The calendar module uses a separate users table (calendar_users) linked
    by email to the main app's users table. This dependency ensures the
    calendar user exists.

    Args:
        current_user: Main app user from JWT authentication
        db: Database session

    Returns:
        CalendarUser object

    Raises:
        HTTPException: If user creation fails
    """
    try:
        # Get the user's email from the main app user
        user_email = current_user.email  # Decrypted automatically by the ORM

        # Look up calendar user by email
        calendar_user = db.query(CalendarUser).filter(
            CalendarUser.email == user_email,
            CalendarUser.deleted_at.is_(None),
        ).first()

        if not calendar_user:
            # Create a new calendar user linked by email
            calendar_user = CalendarUser(
                email=user_email,
                first_name=current_user.full_name.split()[0] if current_user.full_name else None,
                last_name=" ".join(current_user.full_name.split()[1:]) if current_user.full_name and len(current_user.full_name.split()) > 1 else None,
                timezone=current_user.timezone or "UTC",
            )
            db.add(calendar_user)
            db.commit()
            db.refresh(calendar_user)
            logger.info(f"Created calendar user for {user_email}")

        return calendar_user
    except Exception as e:
        logger.error(f"Failed to get/create calendar user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to access calendar user profile",
        )


async def get_calendar_connection(
    connection_id: UUID,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
) -> CalendarConnection:
    """
    Get a calendar connection by ID, verifying ownership.

    Args:
        connection_id: Calendar connection UUID
        calendar_user: Current calendar user
        db: Database session

    Returns:
        CalendarConnection object

    Raises:
        HTTPException: If connection not found or not owned by user
    """
    connection = db.query(CalendarConnection).filter(
        CalendarConnection.id == connection_id,
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.deleted_at.is_(None),
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    return connection


def encrypt_token(token: str) -> str:
    """
    Encrypt an OAuth token for secure storage.

    Args:
        token: Plain text token

    Returns:
        Encrypted token string
    """
    encryption_service = get_encryption_service()
    return encryption_service.encrypt(token)


def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypt an OAuth token from storage.

    Args:
        encrypted_token: Encrypted token string

    Returns:
        Plain text token

    Raises:
        ValueError: If decryption fails
    """
    encryption_service = get_encryption_service()
    decrypted = encryption_service.decrypt(encrypted_token)
    if not decrypted:
        raise ValueError("Failed to decrypt token")
    return decrypted


def get_client_ip(request: Request) -> str:
    """Extract client IP address from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_user_agent(request: Request) -> str:
    """Extract user agent from request"""
    return request.headers.get("User-Agent", "unknown")


async def get_connected_calendars(
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
) -> list[CalendarConnection]:
    """
    Get all connected calendars for a user.

    Args:
        calendar_user: Current calendar user
        db: Database session

    Returns:
        List of active calendar connections
    """
    return db.query(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
    ).all()
