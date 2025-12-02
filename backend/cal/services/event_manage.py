"""
Event Management Service

Handles updating and deleting events with provider sync.
"""
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from cal.models import (
    CalendarConnection, CalendarEvent, CalendarProvider,
    EventStatus, SyncStatus,
)
from cal.schemas import UpdateEventRequest, UpdateEventResponse, DeleteEventResponse
from cal.dependencies import decrypt_token, encrypt_token
from cal.oauth.google import GoogleCalendarClient
from cal.oauth.microsoft import MicrosoftCalendarClient

logger = logging.getLogger(__name__)


async def update_event_and_sync(
    event: CalendarEvent,
    update_data: UpdateEventRequest,
    db: Session,
) -> UpdateEventResponse:
    """
    Update an event locally and sync changes to the provider.

    Args:
        event: Event to update
        update_data: Update request data
        db: Database session

    Returns:
        UpdateEventResponse with updated event details
    """
    connection = event.calendar_connection

    # Update local event fields
    if update_data.title is not None:
        event.title = update_data.title
    if update_data.description is not None:
        event.description = update_data.description
    if update_data.location is not None:
        event.location = update_data.location
    if update_data.start_time is not None:
        event.start_time = update_data.start_time
    if update_data.end_time is not None:
        event.end_time = update_data.end_time
    if update_data.is_all_day is not None:
        event.is_all_day = update_data.is_all_day
    if update_data.timezone is not None:
        event.timezone = update_data.timezone
    if update_data.attendees is not None:
        event.attendees = [a.model_dump() for a in update_data.attendees]
    if update_data.reminders is not None:
        event.reminders = [r.model_dump() for r in update_data.reminders]

    event.updated_at = datetime.utcnow()
    db.flush()

    # Try to sync to provider
    try:
        if connection.provider == CalendarProvider.GOOGLE:
            await _update_google_event(connection, event, db)
        elif connection.provider == CalendarProvider.MICROSOFT:
            await _update_microsoft_event(connection, event, db)
        else:
            raise ValueError(f"Unsupported provider: {connection.provider}")

        event.sync_status = SyncStatus.SYNCED
        event.last_synced_at = datetime.utcnow()
        db.commit()

        return UpdateEventResponse(
            id=event.id,
            title=event.title,
            start_time=event.start_time,
            end_time=event.end_time,
            sync_status=SyncStatus.SYNCED,
            provider_event_id=event.provider_event_id,
            html_link=event.html_link,
            message="Event updated and synced successfully",
        )

    except Exception as e:
        logger.error(f"Failed to sync event update: {e}")
        event.sync_status = SyncStatus.PENDING
        db.commit()

        return UpdateEventResponse(
            id=event.id,
            title=event.title,
            start_time=event.start_time,
            end_time=event.end_time,
            sync_status=SyncStatus.PENDING,
            provider_event_id=event.provider_event_id,
            message=f"Event updated locally but sync failed: {str(e)}",
        )


async def _update_google_event(
    connection: CalendarConnection,
    event: CalendarEvent,
    db: Session,
) -> None:
    """Update event in Google Calendar."""
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

    if event.attendees:
        google_event["attendees"] = [
            {
                "email": a.get("email"),
                "optional": a.get("is_optional", False),
            }
            for a in event.attendees
        ]

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
    await client.update_event(
        access_token,
        connection.calendar_id,
        event.provider_event_id,
        google_event,
    )


async def _update_microsoft_event(
    connection: CalendarConnection,
    event: CalendarEvent,
    db: Session,
) -> None:
    """Update event in Microsoft Outlook Calendar."""
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

    if event.attendees:
        ms_event["attendees"] = [
            {
                "emailAddress": {"address": a.get("email")},
                "type": "optional" if a.get("is_optional") else "required",
            }
            for a in event.attendees
        ]

    # Update event via Graph API
    import httpx
    async with httpx.AsyncClient() as http_client:
        response = await http_client.patch(
            f"https://graph.microsoft.com/v1.0/me/calendars/{connection.calendar_id}/events/{event.provider_event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            json=ms_event,
        )

        if response.status_code not in (200, 204):
            raise ValueError(f"Microsoft Graph API error: {response.text}")


async def delete_event_and_sync(
    event: CalendarEvent,
    db: Session,
) -> DeleteEventResponse:
    """
    Delete an event (soft delete locally, remove from provider).

    Args:
        event: Event to delete
        db: Database session

    Returns:
        DeleteEventResponse with deletion result
    """
    connection = event.calendar_connection
    deleted_from_provider = False

    # Try to delete from provider first
    try:
        if connection.provider == CalendarProvider.GOOGLE:
            await _delete_google_event(connection, event, db)
            deleted_from_provider = True
        elif connection.provider == CalendarProvider.MICROSOFT:
            await _delete_microsoft_event(connection, event, db)
            deleted_from_provider = True
    except Exception as e:
        logger.warning(f"Failed to delete event from provider: {e}")

    # Soft delete locally
    event.deleted_at = datetime.utcnow()
    event.sync_status = SyncStatus.DELETED
    db.commit()

    return DeleteEventResponse(
        id=event.id,
        message="Event deleted successfully",
        deleted_from_provider=deleted_from_provider,
    )


async def _delete_google_event(
    connection: CalendarConnection,
    event: CalendarEvent,
    db: Session,
) -> None:
    """Delete event from Google Calendar."""
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

    client = GoogleCalendarClient()
    await client.delete_event(access_token, connection.calendar_id, event.provider_event_id)


async def _delete_microsoft_event(
    connection: CalendarConnection,
    event: CalendarEvent,
    db: Session,
) -> None:
    """Delete event from Microsoft Outlook Calendar."""
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

    # Delete event via Graph API
    import httpx
    async with httpx.AsyncClient() as http_client:
        response = await http_client.delete(
            f"https://graph.microsoft.com/v1.0/me/calendars/{connection.calendar_id}/events/{event.provider_event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code not in (200, 204, 404):
            raise ValueError(f"Microsoft Graph API error: {response.text}")
