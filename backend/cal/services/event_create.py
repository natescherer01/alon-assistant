"""
Event Creation Service

Handles creating events locally and syncing to calendar providers.
"""
import logging
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from cal.models import (
    CalendarConnection, CalendarEvent, CalendarProvider,
    EventStatus, SyncStatus,
)
from cal.schemas import CreateEventRequest, CreateEventResponse
from cal.dependencies import decrypt_token, encrypt_token
from cal.oauth.google import GoogleCalendarClient
from cal.oauth.microsoft import MicrosoftCalendarClient

logger = logging.getLogger(__name__)


async def create_event_and_sync(
    connection: CalendarConnection,
    event_data: CreateEventRequest,
    db: Session,
) -> CreateEventResponse:
    """
    Create an event locally and sync to the calendar provider.

    Args:
        connection: Calendar connection to create event in
        event_data: Event creation request data
        db: Database session

    Returns:
        CreateEventResponse with created event details
    """
    # Create local event first
    event = CalendarEvent(
        calendar_connection_id=connection.id,
        provider_event_id="",  # Will be updated after sync
        title=event_data.title,
        description=event_data.description,
        location=event_data.location,
        start_time=event_data.start_time,
        end_time=event_data.end_time,
        is_all_day=event_data.is_all_day,
        timezone=event_data.timezone,
        status=EventStatus.CONFIRMED,
        sync_status=SyncStatus.PENDING,
        attendees=[a.model_dump() for a in event_data.attendees] if event_data.attendees else None,
        reminders=[r.model_dump() for r in event_data.reminders] if event_data.reminders else None,
    )

    # Handle recurrence
    if event_data.recurrence:
        event.is_recurring = True
        event.recurrence_rule = _build_rrule(event_data.recurrence)
        event.recurrence_frequency = event_data.recurrence.frequency
        event.recurrence_end_type = event_data.recurrence.end_type

    db.add(event)
    db.flush()  # Get the event ID

    # Try to sync to provider
    try:
        if connection.provider == CalendarProvider.GOOGLE:
            result = await _sync_to_google(connection, event, db)
        elif connection.provider == CalendarProvider.MICROSOFT:
            result = await _sync_to_microsoft(connection, event, db)
        else:
            raise ValueError(f"Unsupported provider for event creation: {connection.provider}")

        event.provider_event_id = result["provider_event_id"]
        event.html_link = result.get("html_link")
        event.sync_status = SyncStatus.SYNCED
        event.last_synced_at = datetime.utcnow()

        db.commit()

        return CreateEventResponse(
            id=event.id,
            title=event.title,
            start_time=event.start_time,
            end_time=event.end_time,
            sync_status=SyncStatus.SYNCED,
            google_event_id=result["provider_event_id"] if connection.provider == CalendarProvider.GOOGLE else None,
            html_link=event.html_link,
            message="Event created and synced successfully",
        )

    except Exception as e:
        logger.error(f"Failed to sync event to provider: {e}")
        # Keep event in pending state
        event.sync_status = SyncStatus.PENDING
        db.commit()

        return CreateEventResponse(
            id=event.id,
            title=event.title,
            start_time=event.start_time,
            end_time=event.end_time,
            sync_status=SyncStatus.PENDING,
            message=f"Event created locally but sync failed: {str(e)}",
        )


async def _sync_to_google(
    connection: CalendarConnection,
    event: CalendarEvent,
    db: Session,
) -> dict:
    """Sync event to Google Calendar."""
    access_token = decrypt_token(connection.access_token)

    # Check if token needs refresh
    if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
        refresh_token = decrypt_token(connection.refresh_token)
        client = GoogleCalendarClient()
        new_tokens = await client.refresh_access_token(refresh_token)
        access_token = new_tokens.access_token
        connection.access_token = encrypt_token(new_tokens.access_token)
        connection.token_expires_at = new_tokens.expires_at
        db.flush()

    # Build Google event payload
    google_event = {
        "summary": event.title,
        "description": event.description,
        "location": event.location,
    }

    if event.is_all_day:
        google_event["start"] = {"date": event.start_time.strftime("%Y-%m-%d")}
        google_event["end"] = {"date": event.end_time.strftime("%Y-%m-%d")}
    else:
        google_event["start"] = {
            "dateTime": event.start_time.isoformat(),
            "timeZone": event.timezone,
        }
        google_event["end"] = {
            "dateTime": event.end_time.isoformat(),
            "timeZone": event.timezone,
        }

    # Add recurrence
    if event.recurrence_rule:
        google_event["recurrence"] = [event.recurrence_rule]

    # Add attendees
    if event.attendees:
        google_event["attendees"] = [
            {
                "email": a.get("email"),
                "optional": a.get("is_optional", False),
            }
            for a in event.attendees
        ]

    # Add reminders
    if event.reminders:
        google_event["reminders"] = {
            "useDefault": False,
            "overrides": [
                {
                    "method": r.get("method", "popup").lower(),
                    "minutes": r.get("minutes_before", 30),
                }
                for r in event.reminders
            ],
        }

    client = GoogleCalendarClient()
    result = await client.create_event(access_token, connection.calendar_id, google_event)

    return {
        "provider_event_id": result["id"],
        "html_link": result.get("htmlLink"),
    }


async def _sync_to_microsoft(
    connection: CalendarConnection,
    event: CalendarEvent,
    db: Session,
) -> dict:
    """Sync event to Microsoft Outlook Calendar."""
    access_token = decrypt_token(connection.access_token)

    # Check if token needs refresh
    if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
        refresh_token = decrypt_token(connection.refresh_token)
        client = MicrosoftCalendarClient()
        new_tokens = await client.refresh_access_token(refresh_token)
        access_token = new_tokens.access_token
        connection.access_token = encrypt_token(new_tokens.access_token)
        if new_tokens.refresh_token:
            connection.refresh_token = encrypt_token(new_tokens.refresh_token)
        connection.token_expires_at = new_tokens.expires_at
        db.flush()

    # Build Microsoft event payload
    ms_event = {
        "subject": event.title,
        "body": {
            "contentType": "text",
            "content": event.description or "",
        },
        "start": {
            "dateTime": event.start_time.isoformat(),
            "timeZone": event.timezone,
        },
        "end": {
            "dateTime": event.end_time.isoformat(),
            "timeZone": event.timezone,
        },
        "isAllDay": event.is_all_day,
    }

    if event.location:
        ms_event["location"] = {"displayName": event.location}

    # Add attendees
    if event.attendees:
        ms_event["attendees"] = [
            {
                "emailAddress": {"address": a.get("email")},
                "type": "optional" if a.get("is_optional") else "required",
            }
            for a in event.attendees
        ]

    # Create event via Graph API
    import httpx
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(
            f"https://graph.microsoft.com/v1.0/me/calendars/{connection.calendar_id}/events",
            headers={"Authorization": f"Bearer {access_token}"},
            json=ms_event,
        )

        if response.status_code not in (200, 201):
            raise ValueError(f"Microsoft Graph API error: {response.text}")

        result = response.json()

    return {
        "provider_event_id": result["id"],
        "html_link": result.get("webLink"),
    }


async def retry_sync_event(
    event: CalendarEvent,
    db: Session,
) -> CreateEventResponse:
    """
    Retry syncing a failed event to the provider.

    Args:
        event: Event to retry syncing
        db: Database session

    Returns:
        CreateEventResponse with sync result
    """
    connection = event.calendar_connection

    try:
        if connection.provider == CalendarProvider.GOOGLE:
            result = await _sync_to_google(connection, event, db)
        elif connection.provider == CalendarProvider.MICROSOFT:
            result = await _sync_to_microsoft(connection, event, db)
        else:
            raise ValueError(f"Unsupported provider: {connection.provider}")

        event.provider_event_id = result["provider_event_id"]
        event.html_link = result.get("html_link")
        event.sync_status = SyncStatus.SYNCED
        event.last_synced_at = datetime.utcnow()
        db.commit()

        return CreateEventResponse(
            id=event.id,
            title=event.title,
            start_time=event.start_time,
            end_time=event.end_time,
            sync_status=SyncStatus.SYNCED,
            html_link=event.html_link,
            message="Event synced successfully",
        )

    except Exception as e:
        logger.error(f"Retry sync failed for event {event.id}: {e}")
        event.sync_status = SyncStatus.FAILED
        db.commit()

        raise ValueError(f"Sync failed: {str(e)}")


def _build_rrule(recurrence) -> str:
    """Build RRULE string from recurrence request."""
    parts = [f"RRULE:FREQ={recurrence.frequency.value}"]

    if recurrence.interval and recurrence.interval > 1:
        parts.append(f"INTERVAL={recurrence.interval}")

    if recurrence.by_day:
        days = ",".join(d.value[:2] for d in recurrence.by_day)
        parts.append(f"BYDAY={days}")

    if recurrence.by_month_day:
        parts.append(f"BYMONTHDAY={recurrence.by_month_day}")

    if recurrence.end_type.value == "DATE" and recurrence.end_date:
        parts.append(f"UNTIL={recurrence.end_date.strftime('%Y%m%dT%H%M%SZ')}")
    elif recurrence.end_type.value == "COUNT" and recurrence.count:
        parts.append(f"COUNT={recurrence.count}")

    return ";".join(parts)
