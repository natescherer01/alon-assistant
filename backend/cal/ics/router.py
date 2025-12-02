"""
ICS Router for Calendar Integration

Handles ICS (iCalendar) feed subscriptions for read-only calendar access.
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from database import get_db
from cal.models import (
    CalendarUser, CalendarConnection, CalendarProvider,
    CalendarAuditLog, AuditStatus,
)
from cal.schemas import (
    ICSValidateRequest, ICSValidateResponse,
    ICSConnectRequest, ICSUpdateRequest,
    CalendarConnectionResponse,
)
from cal.dependencies import (
    get_calendar_user, get_calendar_connection,
    get_client_ip, get_user_agent,
)
from cal.services.ics import validate_ics_url, connect_ics_calendar, sync_ics_events

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ics", tags=["Calendar ICS"])


@router.post("/validate", response_model=ICSValidateResponse)
async def validate_ics_feed(
    body: ICSValidateRequest,
    calendar_user: CalendarUser = Depends(get_calendar_user),
):
    """
    Validate an ICS URL.

    Fetches and parses the ICS feed to verify it's valid.
    Returns calendar name and event count if valid.
    """
    is_valid, name, event_count, error = await validate_ics_url(body.url)

    return ICSValidateResponse(
        valid=is_valid,
        calendar_name=name or body.name,
        event_count=event_count,
        error=error,
    )


@router.post("/connect", response_model=dict)
async def connect_ics(
    request: Request,
    body: ICSConnectRequest,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Connect an ICS calendar subscription.

    Validates the URL, creates the connection, and performs initial sync.
    """
    # Use display_name if provided, otherwise use a default from validation
    calendar_name = body.display_name
    if not calendar_name:
        # Get name from validation
        _, name_from_url, _, _ = await validate_ics_url(body.url)
        calendar_name = name_from_url or "Imported Calendar"

    try:
        connection = await connect_ics_calendar(
            user_id=calendar_user.id,
            url=body.url,
            name=calendar_name,
            color=body.color,
            db=db,
        )

        # Log the action
        audit_log = CalendarAuditLog(
            user_id=calendar_user.id,
            action="ics_calendar_connected",
            resource_type="calendar_connection",
            resource_id=connection.id,
            status=AuditStatus.SUCCESS,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        db.add(audit_log)
        db.commit()

        logger.info(f"Connected ICS calendar {connection.id} for user {calendar_user.id}")

        return {
            "success": True,
            "connection": CalendarConnectionResponse(
                id=connection.id,
                provider=connection.provider,
                calendar_id=connection.calendar_id,
                calendar_name=connection.calendar_name,
                calendar_color=connection.calendar_color,
                is_primary=connection.is_primary,
                is_connected=connection.is_connected,
                is_read_only=connection.is_read_only,
                last_synced_at=connection.last_synced_at,
                created_at=connection.created_at,
            ),
        }

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Failed to connect ICS calendar: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect calendar: {str(e)}",
        )


@router.get("/{connection_id}", response_model=CalendarConnectionResponse)
async def get_ics_calendar(
    connection: CalendarConnection = Depends(get_calendar_connection),
):
    """
    Get ICS calendar connection details.
    """
    if connection.provider != CalendarProvider.ICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not an ICS calendar",
        )

    return CalendarConnectionResponse(
        id=connection.id,
        provider=connection.provider,
        calendar_id=connection.calendar_id,
        calendar_name=connection.calendar_name,
        calendar_color=connection.calendar_color,
        is_primary=connection.is_primary,
        is_connected=connection.is_connected,
        is_read_only=connection.is_read_only,
        last_synced_at=connection.last_synced_at,
        created_at=connection.created_at,
    )


@router.put("/{connection_id}", response_model=dict)
async def update_ics_calendar(
    request: Request,
    body: ICSUpdateRequest,
    connection: CalendarConnection = Depends(get_calendar_connection),
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Update an ICS calendar connection.

    Can update name, color, or URL. URL change triggers re-validation and sync.
    """
    if connection.provider != CalendarProvider.ICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not an ICS calendar",
        )

    # Update fields
    if body.display_name is not None:
        connection.calendar_name = body.display_name
    if body.color is not None:
        connection.calendar_color = body.color

    # If URL changed, validate and update
    if body.url is not None:
        from cal.dependencies import encrypt_token

        is_valid, _, _, error = await validate_ics_url(body.url)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid ICS URL: {error}",
            )

        connection.ics_url = encrypt_token(body.url)
        # Clear cache headers to force full sync
        connection.ics_etag = None
        connection.ics_last_modified = None

    connection.updated_at = datetime.utcnow()
    db.commit()

    # Log the action
    audit_log = CalendarAuditLog(
        user_id=calendar_user.id,
        action="ics_calendar_updated",
        resource_type="calendar_connection",
        resource_id=connection.id,
        status=AuditStatus.SUCCESS,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    db.add(audit_log)
    db.commit()

    logger.info(f"Updated ICS calendar {connection.id}")

    return {
        "success": True,
        "connection": CalendarConnectionResponse(
            id=connection.id,
            provider=connection.provider,
            calendar_id=connection.calendar_id,
            calendar_name=connection.calendar_name,
            calendar_color=connection.calendar_color,
            is_primary=connection.is_primary,
            is_connected=connection.is_connected,
            is_read_only=connection.is_read_only,
            last_synced_at=connection.last_synced_at,
            created_at=connection.created_at,
        ),
    }


@router.post("/{connection_id}/sync")
async def sync_ics_calendar(
    request: Request,
    connection: CalendarConnection = Depends(get_calendar_connection),
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Manually trigger sync for an ICS calendar.
    """
    if connection.provider != CalendarProvider.ICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not an ICS calendar",
        )

    try:
        stats = await sync_ics_events(connection, db)

        logger.info(f"Synced ICS calendar {connection.id}: {stats}")

        return {
            "success": True,
            "stats": stats,
        }

    except Exception as e:
        logger.error(f"Failed to sync ICS calendar {connection.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}",
        )
