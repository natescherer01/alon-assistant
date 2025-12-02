"""
Main Calendar Router

Combines calendar management, event CRUD, and integrates with OAuth and ICS routers.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from cal.models import (
    CalendarUser, CalendarConnection, CalendarEvent, CalendarProvider,
    CalendarAuditLog, AuditStatus, EventStatus, SyncStatus, WebhookSubscription,
)
from cal.schemas import (
    CalendarConnectionResponse, CalendarMetadataResponse, CalendarStatsResponse,
    EventResponse, EventDetailResponse, CreateEventRequest, CreateEventResponse,
    UpdateEventRequest, UpdateEventResponse, DeleteEventResponse,
    SyncAllResponse, SyncStatsResponse, ErrorResponse,
)
from cal.dependencies import (
    get_calendar_user, get_calendar_connection, decrypt_token,
    get_client_ip, get_user_agent,
)
from cal.oauth.router import router as oauth_router
from cal.services.webhook import router as webhook_router
from cal.ics.router import router as ics_router

logger = logging.getLogger(__name__)

# Create main calendar router
router = APIRouter(tags=["Calendar"])

# Include sub-routers
router.include_router(oauth_router)
router.include_router(webhook_router)
router.include_router(ics_router)


# =============================================================================
# Calendar Connection Endpoints
# =============================================================================

@router.get("/calendars", response_model=List[CalendarConnectionResponse])
async def list_calendars(
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    List all connected calendars for the authenticated user.
    """
    connections = db.query(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
    ).all()

    return [
        CalendarConnectionResponse(
            id=c.id,
            provider=c.provider,
            calendar_id=c.calendar_id,
            calendar_name=c.calendar_name,
            calendar_color=c.calendar_color,
            is_primary=c.is_primary,
            is_connected=c.is_connected,
            is_read_only=c.is_read_only,
            last_synced_at=c.last_synced_at,
            created_at=c.created_at,
        )
        for c in connections
    ]


@router.get("/calendars/stats", response_model=CalendarStatsResponse)
async def get_calendar_stats(
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Get calendar connection statistics.
    """
    # Count calendars
    total_calendars = db.query(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.deleted_at.is_(None),
    ).count()

    connected_calendars = db.query(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
    ).count()

    # Count events
    total_events = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarEvent.deleted_at.is_(None),
    ).count()

    # Count upcoming events
    now = datetime.utcnow()
    upcoming_events = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarEvent.start_time >= now,
        CalendarEvent.sync_status == SyncStatus.SYNCED,
        CalendarEvent.deleted_at.is_(None),
    ).count()

    # Provider breakdown
    provider_counts = db.query(
        CalendarConnection.provider,
        func.count(CalendarConnection.id)
    ).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
    ).group_by(CalendarConnection.provider).all()

    providers = {p.value: 0 for p in CalendarProvider}
    for provider, count in provider_counts:
        providers[provider.value] = count

    return CalendarStatsResponse(
        total_calendars=total_calendars,
        connected_calendars=connected_calendars,
        total_events=total_events,
        upcoming_events=upcoming_events,
        providers=providers,
    )


@router.get("/calendars/{connection_id}", response_model=CalendarMetadataResponse)
async def get_calendar_metadata(
    connection: CalendarConnection = Depends(get_calendar_connection),
    db: Session = Depends(get_db),
):
    """
    Get detailed metadata for a specific calendar connection.
    """
    # Count events for this calendar
    event_count = db.query(CalendarEvent).filter(
        CalendarEvent.calendar_connection_id == connection.id,
        CalendarEvent.deleted_at.is_(None),
    ).count()

    # Check if webhook exists
    has_webhook = db.query(WebhookSubscription).filter(
        WebhookSubscription.calendar_connection_id == connection.id,
        WebhookSubscription.is_active == True,
        WebhookSubscription.expiration_datetime > datetime.utcnow(),
    ).first() is not None

    return CalendarMetadataResponse(
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
        event_count=event_count,
        has_webhook=has_webhook,
    )


@router.delete("/calendars/{connection_id}")
async def disconnect_calendar(
    request: Request,
    connection: CalendarConnection = Depends(get_calendar_connection),
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Disconnect (soft delete) a calendar connection.
    """
    # Soft delete the connection
    connection.is_connected = False
    connection.deleted_at = datetime.utcnow()

    # Also mark events as deleted
    db.query(CalendarEvent).filter(
        CalendarEvent.calendar_connection_id == connection.id,
    ).update({"deleted_at": datetime.utcnow()})

    # Deactivate any webhooks
    db.query(WebhookSubscription).filter(
        WebhookSubscription.calendar_connection_id == connection.id,
    ).update({"is_active": False})

    # Log the action
    audit_log = CalendarAuditLog(
        user_id=calendar_user.id,
        action="calendar_disconnected",
        resource_type="calendar_connection",
        resource_id=connection.id,
        status=AuditStatus.SUCCESS,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    db.add(audit_log)
    db.commit()

    logger.info(f"Disconnected calendar {connection.id} for user {calendar_user.id}")

    return {"message": "Calendar disconnected successfully", "id": str(connection.id)}


@router.post("/calendars/{connection_id}/sync")
async def sync_calendar(
    request: Request,
    connection: CalendarConnection = Depends(get_calendar_connection),
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Manually trigger sync for a specific calendar.
    """
    # Import sync service here to avoid circular imports
    from cal.services.sync import sync_calendar_events

    try:
        stats = await sync_calendar_events(connection, db)

        # Update last synced time
        connection.last_synced_at = datetime.utcnow()
        db.commit()

        logger.info(f"Synced calendar {connection.id}: {stats}")

        return {
            "message": "Calendar synced successfully",
            "stats": stats,
        }
    except Exception as e:
        logger.error(f"Failed to sync calendar {connection.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sync failed: {str(e)}",
        )


@router.post("/calendars/sync-all", response_model=SyncAllResponse)
async def sync_all_calendars(
    request: Request,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Sync all connected calendars for the user.
    """
    from cal.services.sync import sync_calendar_events

    connections = db.query(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
    ).all()

    total_stats = {
        "total_events": 0,
        "new_events": 0,
        "updated_events": 0,
        "deleted_events": 0,
        "errors": [],
    }

    for connection in connections:
        try:
            stats = await sync_calendar_events(connection, db)
            total_stats["total_events"] += stats.get("total_events", 0)
            total_stats["new_events"] += stats.get("new_events", 0)
            total_stats["updated_events"] += stats.get("updated_events", 0)
            total_stats["deleted_events"] += stats.get("deleted_events", 0)

            connection.last_synced_at = datetime.utcnow()
        except Exception as e:
            logger.error(f"Failed to sync calendar {connection.id}: {e}")
            total_stats["errors"].append(f"{connection.calendar_name}: {str(e)}")

    db.commit()

    return SyncAllResponse(
        message="Calendar sync completed",
        stats=SyncStatsResponse(
            total_events=total_stats["total_events"],
            new_events=total_stats["new_events"],
            updated_events=total_stats["updated_events"],
            deleted_events=total_stats["deleted_events"],
            errors=total_stats["errors"],
        ),
        calendar_count=len(connections),
    )


# =============================================================================
# Event Endpoints
# =============================================================================

@router.get("/events", response_model=List[EventResponse])
async def get_events(
    start: datetime = Query(..., description="Start date (ISO 8601)"),
    end: datetime = Query(..., description="End date (ISO 8601)"),
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Get events within a date range from all connected calendars.
    """
    # Validate date range
    if start >= end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date must be before end date",
        )

    # Limit date range to 1 year
    max_days = 365
    days_diff = (end - start).days
    if days_diff > max_days:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Date range too large. Maximum {max_days} days allowed.",
        )

    events = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
        CalendarEvent.start_time >= start,
        CalendarEvent.end_time <= end,
        CalendarEvent.sync_status == SyncStatus.SYNCED,
        CalendarEvent.deleted_at.is_(None),
    ).order_by(CalendarEvent.start_time).all()

    return [
        EventResponse(
            id=e.id,
            title=e.title,
            description=e.description,
            location=e.location,
            start_time=e.start_time,
            end_time=e.end_time,
            is_all_day=e.is_all_day,
            timezone=e.timezone,
            status=e.status,
            is_recurring=e.is_recurring,
            recurrence_rule=e.recurrence_rule,
            attendees=e.attendees,
            reminders=e.reminders,
            html_link=e.html_link,
            calendar_id=e.calendar_connection_id,
            provider=e.calendar_connection.provider,
            calendar_name=e.calendar_connection.calendar_name,
            calendar_color=e.calendar_connection.calendar_color,
        )
        for e in events
    ]


@router.get("/events/upcoming")
async def get_upcoming_events(
    limit: int = Query(default=10, ge=1, le=100),
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Get upcoming events starting from now.
    """
    now = datetime.utcnow()
    end_date = now + timedelta(days=30)

    events = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
        CalendarEvent.start_time >= now,
        CalendarEvent.start_time <= end_date,
        CalendarEvent.sync_status == SyncStatus.SYNCED,
        CalendarEvent.deleted_at.is_(None),
    ).order_by(CalendarEvent.start_time).limit(limit).all()

    return {
        "events": [
            {
                "id": str(e.id),
                "title": e.title,
                "startTime": e.start_time.isoformat(),
                "endTime": e.end_time.isoformat(),
                "isAllDay": e.is_all_day,
                "location": e.location,
                "calendar": {
                    "provider": e.calendar_connection.provider.value,
                    "name": e.calendar_connection.calendar_name,
                    "color": e.calendar_connection.calendar_color,
                },
            }
            for e in events
        ],
        "meta": {
            "total": len(events),
            "limit": limit,
        },
    }


@router.get("/events/{event_id}")
async def get_event_by_id(
    event_id: str,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Get event details by ID.

    Supports composite IDs for recurring event instances (format: uuid_date).
    """
    # Handle composite ID for recurring instances
    actual_event_id = event_id
    instance_date = None

    # Check for composite ID format
    if "_" in event_id:
        parts = event_id.rsplit("_", 1)
        if len(parts) == 2:
            actual_event_id = parts[0]
            instance_date = parts[1]

    try:
        event_uuid = UUID(actual_event_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid event ID format",
        )

    event = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarEvent.id == event_uuid,
        CalendarConnection.user_id == calendar_user.id,
        CalendarEvent.deleted_at.is_(None),
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    # Calculate instance times for recurring events
    start_time = event.start_time
    end_time = event.end_time

    if instance_date and event.is_recurring:
        try:
            instance_start = datetime.fromisoformat(instance_date.replace("Z", "+00:00"))
            duration = event.end_time - event.start_time
            start_time = instance_start
            end_time = instance_start + duration
        except Exception:
            pass  # Fall back to original times

    return {
        "event": {
            "id": event_id,
            "title": event.title,
            "description": event.description,
            "location": event.location,
            "startTime": start_time.isoformat(),
            "endTime": end_time.isoformat(),
            "isAllDay": event.is_all_day,
            "timezone": event.timezone,
            "status": event.status.value,
            "isRecurring": event.is_recurring,
            "recurrenceRule": event.recurrence_rule,
            "attendees": event.attendees,
            "reminders": event.reminders,
            "htmlLink": event.html_link,
            "calendar": {
                "provider": event.calendar_connection.provider.value,
                "name": event.calendar_connection.calendar_name,
                "color": event.calendar_connection.calendar_color,
                "isReadOnly": event.calendar_connection.is_read_only or event.calendar_connection.provider == CalendarProvider.ICS,
            },
            "providerMetadata": event.provider_metadata,
            "createdAt": event.created_at.isoformat(),
            "updatedAt": event.updated_at.isoformat(),
        }
    }


@router.post("/events", response_model=CreateEventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    request: Request,
    body: CreateEventRequest,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Create a new event and sync to the calendar provider.
    """
    # Get the calendar connection
    connection = db.query(CalendarConnection).filter(
        CalendarConnection.id == body.calendar_connection_id,
        CalendarConnection.user_id == calendar_user.id,
        CalendarConnection.is_connected == True,
        CalendarConnection.deleted_at.is_(None),
    ).first()

    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Calendar connection not found",
        )

    if connection.is_read_only or connection.provider == CalendarProvider.ICS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create events on read-only calendar",
        )

    # Import create service here to avoid circular imports
    from cal.services.event_create import create_event_and_sync

    try:
        result = await create_event_and_sync(connection, body, db)
        return result
    except Exception as e:
        logger.error(f"Failed to create event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create event: {str(e)}",
        )


@router.put("/events/{event_id}", response_model=UpdateEventResponse)
async def update_event(
    event_id: UUID,
    body: UpdateEventRequest,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Update an existing event and sync changes to the provider.
    """
    event = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarEvent.id == event_id,
        CalendarConnection.user_id == calendar_user.id,
        CalendarEvent.deleted_at.is_(None),
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    connection = event.calendar_connection
    if connection.is_read_only or connection.provider == CalendarProvider.ICS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update events on read-only calendar",
        )

    # Import update service here to avoid circular imports
    from cal.services.event_manage import update_event_and_sync

    try:
        result = await update_event_and_sync(event, body, db)
        return result
    except Exception as e:
        logger.error(f"Failed to update event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update event: {str(e)}",
        )


@router.delete("/events/{event_id}", response_model=DeleteEventResponse)
async def delete_event(
    event_id: UUID,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Delete an event (soft delete locally, remove from provider).
    """
    event = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarEvent.id == event_id,
        CalendarConnection.user_id == calendar_user.id,
        CalendarEvent.deleted_at.is_(None),
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    connection = event.calendar_connection
    if connection.is_read_only or connection.provider == CalendarProvider.ICS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete events from read-only calendar",
        )

    # Import delete service here to avoid circular imports
    from cal.services.event_manage import delete_event_and_sync

    try:
        result = await delete_event_and_sync(event, db)
        return result
    except Exception as e:
        logger.error(f"Failed to delete event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete event: {str(e)}",
        )


@router.post("/events/{event_id}/retry-sync")
async def retry_sync_event(
    event_id: UUID,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Retry syncing a failed event to the provider.
    """
    event = db.query(CalendarEvent).join(CalendarConnection).filter(
        CalendarEvent.id == event_id,
        CalendarConnection.user_id == calendar_user.id,
        CalendarEvent.deleted_at.is_(None),
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    if event.sync_status == SyncStatus.SYNCED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is already synced",
        )

    # Import retry service
    from cal.services.event_create import retry_sync_event as retry_sync

    try:
        result = await retry_sync(event, db)
        return result
    except Exception as e:
        logger.error(f"Failed to retry sync for event {event_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Retry sync failed: {str(e)}",
        )
