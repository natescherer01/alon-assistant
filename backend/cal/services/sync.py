"""
Calendar Event Sync Service

Handles syncing events from Google, Microsoft, and ICS calendars.
Supports incremental sync using provider-specific sync tokens/delta links.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from cal.models import (
    CalendarConnection, CalendarEvent, CalendarProvider,
    EventStatus, SyncStatus, EventAttendee, EventReminder,
    RsvpStatus, ReminderMethod,
)
from cal.dependencies import decrypt_token, encrypt_token
from cal.oauth.google import GoogleCalendarClient, GoogleEvent
from cal.oauth.microsoft import MicrosoftCalendarClient, MicrosoftEvent

logger = logging.getLogger(__name__)


async def sync_calendar_events(
    connection: CalendarConnection,
    db: Session,
    force_full_sync: bool = False,
) -> Dict[str, int]:
    """
    Sync events from a calendar provider.

    Args:
        connection: Calendar connection to sync
        db: Database session
        force_full_sync: If True, ignore sync tokens and do full sync

    Returns:
        Dictionary with sync statistics
    """
    if connection.provider == CalendarProvider.GOOGLE:
        return await sync_google_events(connection, db, force_full_sync)
    elif connection.provider == CalendarProvider.MICROSOFT:
        return await sync_microsoft_events(connection, db, force_full_sync)
    elif connection.provider == CalendarProvider.ICS:
        from cal.services.ics import sync_ics_events
        return await sync_ics_events(connection, db)
    else:
        raise ValueError(f"Unsupported provider: {connection.provider}")


async def sync_google_events(
    connection: CalendarConnection,
    db: Session,
    force_full_sync: bool = False,
) -> Dict[str, int]:
    """
    Sync events from Google Calendar.

    Uses incremental sync with sync tokens when available.
    """
    stats = {"total_events": 0, "new_events": 0, "updated_events": 0, "deleted_events": 0}

    try:
        # Decrypt tokens
        access_token = decrypt_token(connection.access_token)
        refresh_token = decrypt_token(connection.refresh_token)

        # Check if token needs refresh
        if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
            client = GoogleCalendarClient()
            new_tokens = await client.refresh_access_token(refresh_token)
            access_token = new_tokens.access_token

            # Update stored tokens
            connection.access_token = encrypt_token(new_tokens.access_token)
            connection.token_expires_at = new_tokens.expires_at
            db.flush()

        client = GoogleCalendarClient()

        # Determine sync range
        if force_full_sync or not connection.sync_token:
            time_min = datetime.utcnow() - timedelta(days=30)
            time_max = datetime.utcnow() + timedelta(days=365)
            sync_token = None
        else:
            time_min = datetime.utcnow() - timedelta(days=30)
            time_max = datetime.utcnow() + timedelta(days=365)
            sync_token = connection.sync_token

        try:
            events, next_sync_token = await client.get_events(
                access_token=access_token,
                calendar_id=connection.calendar_id,
                time_min=time_min,
                time_max=time_max,
                sync_token=sync_token,
            )
        except ValueError as e:
            if "sync required" in str(e).lower():
                # Sync token expired, do full sync
                logger.info(f"Sync token expired for {connection.id}, doing full sync")
                events, next_sync_token = await client.get_events(
                    access_token=access_token,
                    calendar_id=connection.calendar_id,
                    time_min=time_min,
                    time_max=time_max,
                    sync_token=None,
                )
            else:
                raise

        # Process events
        for google_event in events:
            result = await _upsert_google_event(connection, google_event, db)
            stats["total_events"] += 1
            if result == "new":
                stats["new_events"] += 1
            elif result == "updated":
                stats["updated_events"] += 1
            elif result == "deleted":
                stats["deleted_events"] += 1

        # Update sync token
        if next_sync_token:
            connection.sync_token = next_sync_token

        connection.last_synced_at = datetime.utcnow()
        db.commit()

        logger.info(f"Synced Google calendar {connection.id}: {stats}")
        return stats

    except Exception as e:
        logger.error(f"Failed to sync Google calendar {connection.id}: {e}")
        raise


async def _upsert_google_event(
    connection: CalendarConnection,
    google_event: GoogleEvent,
    db: Session,
) -> str:
    """Insert or update a Google Calendar event. Returns 'new', 'updated', or 'deleted'."""
    # Check if event exists
    existing = db.query(CalendarEvent).filter(
        CalendarEvent.calendar_connection_id == connection.id,
        CalendarEvent.provider_event_id == google_event.id,
    ).first()

    # Handle cancelled/deleted events
    if google_event.status == "cancelled":
        if existing:
            existing.deleted_at = datetime.utcnow()
            existing.sync_status = SyncStatus.DELETED
            return "deleted"
        return "deleted"

    # Map event status
    status_map = {
        "confirmed": EventStatus.CONFIRMED,
        "tentative": EventStatus.TENTATIVE,
        "cancelled": EventStatus.CANCELLED,
    }
    event_status = status_map.get(google_event.status, EventStatus.CONFIRMED)

    # Build event data
    event_data = {
        "title": google_event.summary,
        "description": google_event.description,
        "location": google_event.location,
        "start_time": google_event.start,
        "end_time": google_event.end,
        "is_all_day": google_event.is_all_day,
        "timezone": google_event.timezone,
        "status": event_status,
        "sync_status": SyncStatus.SYNCED,
        "html_link": google_event.html_link,
        "attendees": google_event.attendees,
        "reminders": google_event.reminders,
        "is_recurring": bool(google_event.recurrence or google_event.recurring_event_id),
        "recurrence_rule": google_event.recurrence[0] if google_event.recurrence else None,
        "last_synced_at": datetime.utcnow(),
        "deleted_at": None,  # Clear deleted_at if event reappears
    }

    if existing:
        # Update existing event
        for key, value in event_data.items():
            setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        return "updated"
    else:
        # Create new event
        event = CalendarEvent(
            calendar_connection_id=connection.id,
            provider_event_id=google_event.id,
            **event_data,
        )
        db.add(event)
        return "new"


async def sync_microsoft_events(
    connection: CalendarConnection,
    db: Session,
    force_full_sync: bool = False,
) -> Dict[str, int]:
    """
    Sync events from Microsoft Outlook Calendar.

    Uses delta sync when available.
    """
    stats = {"total_events": 0, "new_events": 0, "updated_events": 0, "deleted_events": 0}

    try:
        # Decrypt tokens
        access_token = decrypt_token(connection.access_token)
        refresh_token = decrypt_token(connection.refresh_token)

        # Check if token needs refresh
        if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
            client = MicrosoftCalendarClient()
            new_tokens = await client.refresh_access_token(refresh_token)
            access_token = new_tokens.access_token

            # Update stored tokens
            connection.access_token = encrypt_token(new_tokens.access_token)
            if new_tokens.refresh_token != refresh_token:
                connection.refresh_token = encrypt_token(new_tokens.refresh_token)
            connection.token_expires_at = new_tokens.expires_at
            db.flush()

        client = MicrosoftCalendarClient()

        # Determine if we use delta sync
        delta_token = None if force_full_sync else connection.sync_token

        try:
            events, next_delta_token = await client.get_delta_events(
                access_token=access_token,
                calendar_id=connection.calendar_id,
                delta_token=delta_token,
            )
        except ValueError as e:
            if "INVALID_DELTA_TOKEN" in str(e):
                # Delta token invalid, do full sync
                logger.info(f"Delta token invalid for {connection.id}, doing full sync")
                events, next_delta_token = await client.get_delta_events(
                    access_token=access_token,
                    calendar_id=connection.calendar_id,
                    delta_token=None,
                )
            else:
                raise

        # Process events
        for ms_event in events:
            result = await _upsert_microsoft_event(connection, ms_event, db)
            stats["total_events"] += 1
            if result == "new":
                stats["new_events"] += 1
            elif result == "updated":
                stats["updated_events"] += 1
            elif result == "deleted":
                stats["deleted_events"] += 1

        # Update delta token
        if next_delta_token:
            connection.sync_token = next_delta_token

        connection.last_synced_at = datetime.utcnow()
        db.commit()

        logger.info(f"Synced Microsoft calendar {connection.id}: {stats}")
        return stats

    except Exception as e:
        logger.error(f"Failed to sync Microsoft calendar {connection.id}: {e}")
        raise


async def _upsert_microsoft_event(
    connection: CalendarConnection,
    ms_event: MicrosoftEvent,
    db: Session,
) -> str:
    """Insert or update a Microsoft Calendar event. Returns 'new', 'updated', or 'deleted'."""
    # Check if event exists
    existing = db.query(CalendarEvent).filter(
        CalendarEvent.calendar_connection_id == connection.id,
        CalendarEvent.provider_event_id == ms_event.id,
    ).first()

    # Handle removed events (from delta sync)
    if ms_event.is_removed:
        if existing:
            existing.deleted_at = datetime.utcnow()
            existing.sync_status = SyncStatus.DELETED
            return "deleted"
        return "deleted"

    # Handle cancelled events
    if ms_event.is_cancelled:
        if existing:
            existing.status = EventStatus.CANCELLED
            existing.deleted_at = datetime.utcnow()
            existing.sync_status = SyncStatus.DELETED
            return "deleted"
        return "deleted"

    # Convert recurrence to RRULE
    client = MicrosoftCalendarClient()
    recurrence_rule = client.convert_recurrence_to_rrule(ms_event.recurrence)

    # Build event data
    event_data = {
        "title": ms_event.subject,
        "description": ms_event.body_preview,
        "location": ms_event.location,
        "start_time": ms_event.start,
        "end_time": ms_event.end,
        "is_all_day": ms_event.is_all_day,
        "timezone": ms_event.start_timezone,
        "status": EventStatus.CONFIRMED,
        "sync_status": SyncStatus.SYNCED,
        "html_link": ms_event.web_link,
        "attendees": ms_event.attendees,
        "is_recurring": bool(ms_event.recurrence or ms_event.series_master_id),
        "recurrence_rule": recurrence_rule,
        "series_master_id": ms_event.series_master_id,
        "importance": ms_event.importance,
        "teams_enabled": ms_event.teams_enabled,
        "teams_meeting_url": ms_event.teams_meeting_url,
        "teams_conference_id": ms_event.teams_conference_id,
        "last_synced_at": datetime.utcnow(),
        "deleted_at": None,
    }

    if existing:
        # Update existing event
        for key, value in event_data.items():
            if hasattr(existing, key):
                setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        return "updated"
    else:
        # Create new event
        event = CalendarEvent(
            calendar_connection_id=connection.id,
            provider_event_id=ms_event.id,
            **{k: v for k, v in event_data.items() if hasattr(CalendarEvent, k)},
        )
        db.add(event)
        return "new"
