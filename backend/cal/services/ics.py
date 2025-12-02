"""
ICS Calendar Service

Handles parsing and syncing ICS (iCalendar) feeds.
Supports subscribing to public calendar URLs.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from uuid import uuid4

import httpx
from icalendar import Calendar
from dateutil import rrule

from sqlalchemy.orm import Session

from cal.models import (
    CalendarConnection, CalendarEvent, CalendarProvider,
    EventStatus, SyncStatus,
)
from cal.dependencies import encrypt_token, decrypt_token

logger = logging.getLogger(__name__)


async def validate_ics_url(url: str) -> Tuple[bool, Optional[str], Optional[int], Optional[str]]:
    """
    Validate an ICS URL by fetching and parsing it.

    Args:
        url: ICS feed URL

    Returns:
        Tuple of (is_valid, calendar_name, event_count, error_message)
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, follow_redirects=True)

            if response.status_code != 200:
                return False, None, None, f"Failed to fetch URL: HTTP {response.status_code}"

            content_type = response.headers.get("content-type", "").lower()
            if "text/calendar" not in content_type and "application/ics" not in content_type:
                # Some servers don't set correct content type, try parsing anyway
                pass

            try:
                cal = Calendar.from_ical(response.text)
            except Exception as e:
                return False, None, None, f"Invalid ICS format: {e}"

            # Extract calendar name
            calendar_name = str(cal.get("x-wr-calname", "Imported Calendar"))

            # Count events
            events = [c for c in cal.walk() if c.name == "VEVENT"]
            event_count = len(events)

            return True, calendar_name, event_count, None

    except httpx.TimeoutException:
        return False, None, None, "Request timed out"
    except Exception as e:
        logger.error(f"ICS validation failed: {e}")
        return False, None, None, f"Validation failed: {e}"


async def connect_ics_calendar(
    user_id,
    url: str,
    name: str,
    color: Optional[str],
    db: Session,
) -> CalendarConnection:
    """
    Connect an ICS calendar by URL.

    Args:
        user_id: Calendar user ID
        url: ICS feed URL
        name: Display name for the calendar
        color: Optional hex color code
        db: Database session

    Returns:
        Created CalendarConnection
    """
    # Validate URL first
    is_valid, _, _, error = await validate_ics_url(url)
    if not is_valid:
        raise ValueError(f"Invalid ICS URL: {error}")

    # Check for existing connection
    existing = db.query(CalendarConnection).filter(
        CalendarConnection.user_id == user_id,
        CalendarConnection.provider == CalendarProvider.ICS,
        CalendarConnection.ics_url == encrypt_token(url),
    ).first()

    if existing:
        # Reactivate if deleted
        existing.is_connected = True
        existing.deleted_at = None
        existing.calendar_name = name
        existing.calendar_color = color
        existing.updated_at = datetime.utcnow()
        db.commit()
        return existing

    # Create new connection
    connection = CalendarConnection(
        user_id=user_id,
        provider=CalendarProvider.ICS,
        calendar_id=str(uuid4()),  # Generate unique ID for ICS
        calendar_name=name,
        calendar_color=color,
        ics_url=encrypt_token(url),
        is_connected=True,
        is_read_only=True,  # ICS calendars are always read-only
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    # Initial sync
    await sync_ics_events(connection, db)

    return connection


async def sync_ics_events(
    connection: CalendarConnection,
    db: Session,
) -> Dict[str, int]:
    """
    Sync events from an ICS feed.

    Args:
        connection: ICS calendar connection
        db: Database session

    Returns:
        Sync statistics
    """
    stats = {"total_events": 0, "new_events": 0, "updated_events": 0, "deleted_events": 0}

    if not connection.ics_url:
        raise ValueError("No ICS URL configured")

    try:
        url = decrypt_token(connection.ics_url)

        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {}
            if connection.ics_etag:
                headers["If-None-Match"] = connection.ics_etag
            if connection.ics_last_modified:
                headers["If-Modified-Since"] = connection.ics_last_modified

            response = await client.get(url, headers=headers, follow_redirects=True)

            # Check if not modified
            if response.status_code == 304:
                logger.debug(f"ICS calendar {connection.id} not modified")
                connection.last_synced_at = datetime.utcnow()
                db.commit()
                return stats

            if response.status_code != 200:
                raise ValueError(f"Failed to fetch ICS: HTTP {response.status_code}")

            # Update cache headers
            connection.ics_etag = response.headers.get("ETag")
            connection.ics_last_modified = response.headers.get("Last-Modified")

            # Parse calendar
            cal = Calendar.from_ical(response.text)

            # Get existing event IDs for deletion detection (include soft-deleted)
            existing_events = {
                e.provider_event_id: e
                for e in db.query(CalendarEvent).filter(
                    CalendarEvent.calendar_connection_id == connection.id,
                ).all()
            }

            seen_event_ids = set()

            # Process events
            for component in cal.walk():
                if component.name != "VEVENT":
                    continue

                event_id = str(component.get("uid", uuid4()))
                seen_event_ids.add(event_id)

                result = _upsert_ics_event(connection, component, event_id, existing_events.get(event_id), db)
                stats["total_events"] += 1
                if result == "new":
                    stats["new_events"] += 1
                elif result == "updated":
                    stats["updated_events"] += 1

            # Mark missing events as deleted (only non-deleted ones)
            for event_id, event in existing_events.items():
                if event_id not in seen_event_ids and event.deleted_at is None:
                    event.deleted_at = datetime.utcnow()
                    event.sync_status = SyncStatus.DELETED
                    stats["deleted_events"] += 1

            connection.last_synced_at = datetime.utcnow()
            db.commit()

            logger.info(f"Synced ICS calendar {connection.id}: {stats}")
            return stats

    except Exception as e:
        # Rollback on error to clean up the transaction state
        db.rollback()
        logger.error(f"Failed to sync ICS calendar {connection.id}: {e}")
        raise


def _upsert_ics_event(
    connection: CalendarConnection,
    component,
    event_id: str,
    existing: Optional[CalendarEvent],
    db: Session,
) -> str:
    """Insert or update an ICS event. Returns 'new', 'updated', or 'skipped'.

    Args:
        connection: Calendar connection
        component: ICS VEVENT component
        event_id: The UID from the ICS event
        existing: Existing CalendarEvent if found, None otherwise
        db: Database session
    """
    # Extract event data
    summary = str(component.get("summary", "(No title)"))
    description = str(component.get("description", "")) if component.get("description") else None
    location = str(component.get("location", "")) if component.get("location") else None

    # Parse dates
    dtstart = component.get("dtstart")
    dtend = component.get("dtend")

    if not dtstart:
        return "skipped"

    start_dt = dtstart.dt
    is_all_day = not hasattr(start_dt, "hour")

    if isinstance(start_dt, datetime):
        start_time = start_dt
    else:
        # Date without time (all-day event)
        start_time = datetime.combine(start_dt, datetime.min.time())

    if dtend:
        end_dt = dtend.dt
        if isinstance(end_dt, datetime):
            end_time = end_dt
        else:
            end_time = datetime.combine(end_dt, datetime.min.time())
    else:
        # Default duration
        end_time = start_time + timedelta(hours=1)

    # Parse status
    status_str = str(component.get("status", "confirmed")).upper()
    status_map = {
        "CONFIRMED": EventStatus.CONFIRMED,
        "TENTATIVE": EventStatus.TENTATIVE,
        "CANCELLED": EventStatus.CANCELLED,
    }
    status = status_map.get(status_str, EventStatus.CONFIRMED)

    # Parse recurrence
    rrule_str = None
    is_recurring = False
    if component.get("rrule"):
        rrule_str = f"RRULE:{component.get('rrule').to_ical().decode()}"
        is_recurring = True

    event_data = {
        "title": summary[:500],  # Limit title length
        "description": description[:2000] if description else None,
        "location": location[:500] if location else None,
        "start_time": start_time,
        "end_time": end_time,
        "is_all_day": is_all_day,
        "timezone": "UTC",
        "status": status,
        "sync_status": SyncStatus.SYNCED,
        "is_recurring": is_recurring,
        "recurrence_rule": rrule_str,
        "last_synced_at": datetime.utcnow(),
        "deleted_at": None,  # Reactivate if previously deleted
    }

    if existing:
        for key, value in event_data.items():
            setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        return "updated"
    else:
        event = CalendarEvent(
            calendar_connection_id=connection.id,
            provider_event_id=event_id,
            **event_data,
        )
        db.add(event)
        return "new"
