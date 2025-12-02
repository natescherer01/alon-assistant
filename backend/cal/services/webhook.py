"""
Webhook Service

Handles receiving and processing webhook notifications from
Microsoft Graph API for real-time calendar updates.
"""
import logging
import secrets
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import APIRouter, Request, HTTPException, status, Response
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from cal.models import (
    CalendarConnection, CalendarProvider, WebhookSubscription,
    CalendarAuditLog, AuditStatus,
)
from cal.dependencies import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Calendar Webhooks"])


@router.post("/microsoft")
async def handle_microsoft_webhook(request: Request):
    """
    Handle Microsoft Graph webhook notifications.

    Microsoft sends two types of requests:
    1. Validation: Contains validationToken query param - must be echoed back
    2. Notification: Contains change notifications in request body
    """
    # Check for validation request
    validation_token = request.query_params.get("validationToken")
    if validation_token:
        logger.info("Microsoft webhook validation request received")
        return Response(content=validation_token, media_type="text/plain")

    # Process notification
    try:
        body = await request.json()
        notifications = body.get("value", [])

        logger.info(f"Received {len(notifications)} Microsoft webhook notifications")

        db = SessionLocal()
        try:
            for notification in notifications:
                await _process_microsoft_notification(notification, db)
            db.commit()
        finally:
            db.close()

        return {"status": "processed"}

    except Exception as e:
        logger.error(f"Failed to process Microsoft webhook: {e}")
        # Return 200 to prevent Microsoft from retrying
        return {"status": "error", "message": str(e)}


async def _process_microsoft_notification(
    notification: Dict[str, Any],
    db: Session,
) -> None:
    """Process a single Microsoft Graph notification."""
    subscription_id = notification.get("subscriptionId")
    client_state = notification.get("clientState")
    change_type = notification.get("changeType")
    resource = notification.get("resource")

    if not subscription_id:
        logger.warning("Notification missing subscriptionId")
        return

    # Find subscription
    subscription = db.query(WebhookSubscription).filter(
        WebhookSubscription.subscription_id == subscription_id,
        WebhookSubscription.is_active == True,
    ).first()

    if not subscription:
        logger.warning(f"Subscription not found: {subscription_id}")
        return

    # Validate client state if configured
    if subscription.client_state and client_state != subscription.client_state:
        logger.warning(f"Client state mismatch for subscription {subscription_id}")
        return

    # Update last notification time
    subscription.last_notification_at = datetime.utcnow()

    connection = subscription.calendar_connection

    logger.info(f"Processing {change_type} notification for calendar {connection.id}")

    # Trigger sync for the affected calendar
    try:
        from cal.services.sync import sync_microsoft_events

        await sync_microsoft_events(connection, db, force_full_sync=False)

    except Exception as e:
        logger.error(f"Failed to sync calendar after notification: {e}")

        # Log the failure
        audit_log = CalendarAuditLog(
            user_id=connection.user_id,
            action="webhook_sync_failed",
            resource_type="calendar_connection",
            resource_id=connection.id,
            status=AuditStatus.FAILURE,
            error_message=str(e),
            metadata={
                "subscription_id": subscription_id,
                "change_type": change_type,
            },
        )
        db.add(audit_log)


@router.post("/google")
async def handle_google_webhook(request: Request):
    """
    Handle Google Calendar push notifications.

    Google sends notifications when calendar events change.
    The notification contains minimal info - we need to sync to get changes.
    """
    # Get headers
    channel_id = request.headers.get("X-Goog-Channel-ID")
    resource_id = request.headers.get("X-Goog-Resource-ID")
    resource_state = request.headers.get("X-Goog-Resource-State")

    if not channel_id:
        logger.warning("Google webhook missing channel ID")
        return {"status": "error", "message": "Missing channel ID"}

    logger.info(f"Received Google webhook: channel={channel_id}, state={resource_state}")

    # Skip sync notifications (initial subscription confirmation)
    if resource_state == "sync":
        logger.info("Received Google sync notification, ignoring")
        return {"status": "ok"}

    db = SessionLocal()
    try:
        # Find subscription by channel ID (stored in subscription_id)
        subscription = db.query(WebhookSubscription).filter(
            WebhookSubscription.subscription_id == channel_id,
            WebhookSubscription.provider == CalendarProvider.GOOGLE,
            WebhookSubscription.is_active == True,
        ).first()

        if not subscription:
            logger.warning(f"Google subscription not found: {channel_id}")
            return {"status": "error", "message": "Subscription not found"}

        # Update last notification time
        subscription.last_notification_at = datetime.utcnow()

        connection = subscription.calendar_connection

        logger.info(f"Processing Google notification for calendar {connection.id}")

        # Trigger sync for the affected calendar
        try:
            from cal.services.sync import sync_google_events

            await sync_google_events(connection, db, force_full_sync=False)
            db.commit()

        except Exception as e:
            logger.error(f"Failed to sync Google calendar after notification: {e}")

    finally:
        db.close()

    return {"status": "ok"}


async def create_webhook_subscription(
    connection: CalendarConnection,
    db: Session,
) -> WebhookSubscription:
    """
    Create a webhook subscription for a calendar connection.

    Args:
        connection: Calendar connection to subscribe to
        db: Database session

    Returns:
        Created WebhookSubscription

    Raises:
        ValueError: If subscription creation fails
    """
    import os

    api_url = os.getenv("API_URL", "http://localhost:8000")

    if connection.provider == CalendarProvider.MICROSOFT:
        return await _create_microsoft_subscription(connection, api_url, db)
    elif connection.provider == CalendarProvider.GOOGLE:
        return await _create_google_subscription(connection, api_url, db)
    else:
        raise ValueError(f"Webhooks not supported for provider: {connection.provider}")


async def _create_microsoft_subscription(
    connection: CalendarConnection,
    api_url: str,
    db: Session,
) -> WebhookSubscription:
    """Create Microsoft Graph subscription."""
    from cal.oauth.microsoft import MicrosoftCalendarClient

    # Generate client state for validation
    client_state = secrets.token_urlsafe(32)
    webhook_url = f"{api_url}/api/v1/calendar/webhooks/microsoft"

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

    client = MicrosoftCalendarClient()
    result = await client.create_webhook_subscription(
        access_token=access_token,
        calendar_id=connection.calendar_id,
        webhook_url=webhook_url,
        client_state=client_state,
    )

    # Create subscription record
    subscription = WebhookSubscription(
        calendar_connection_id=connection.id,
        provider=CalendarProvider.MICROSOFT,
        subscription_id=result.id,
        resource_path=result.resource,
        expiration_datetime=result.expiration_datetime,
        client_state=client_state,
        notification_url=webhook_url,
        is_active=True,
    )
    db.add(subscription)

    return subscription


async def _create_google_subscription(
    connection: CalendarConnection,
    api_url: str,
    db: Session,
) -> WebhookSubscription:
    """Create Google Calendar push notification channel."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    import uuid

    channel_id = str(uuid.uuid4())
    webhook_url = f"{api_url}/api/v1/calendar/webhooks/google"

    access_token = decrypt_token(connection.access_token)

    # Check if token needs refresh
    if connection.token_expires_at and connection.token_expires_at < datetime.utcnow():
        from cal.oauth.google import GoogleCalendarClient

        refresh_token = decrypt_token(connection.refresh_token)
        client = GoogleCalendarClient()
        new_tokens = await client.refresh_access_token(refresh_token)
        access_token = new_tokens.access_token
        connection.access_token = encrypt_token(new_tokens.access_token)
        connection.token_expires_at = new_tokens.expires_at
        db.flush()

    credentials = Credentials(token=access_token)
    service = build("calendar", "v3", credentials=credentials)

    # Create watch request
    expiration = datetime.utcnow() + timedelta(days=7)  # Google allows up to 7 days

    try:
        result = service.events().watch(
            calendarId=connection.calendar_id,
            body={
                "id": channel_id,
                "type": "web_hook",
                "address": webhook_url,
                "expiration": int(expiration.timestamp() * 1000),  # Milliseconds
            },
        ).execute()
    except Exception as e:
        raise ValueError(f"Failed to create Google webhook: {e}")

    # Create subscription record
    subscription = WebhookSubscription(
        calendar_connection_id=connection.id,
        provider=CalendarProvider.GOOGLE,
        subscription_id=channel_id,
        resource_path=f"/calendars/{connection.calendar_id}/events",
        expiration_datetime=expiration,
        notification_url=webhook_url,
        is_active=True,
    )
    db.add(subscription)

    return subscription


async def delete_webhook_subscription(
    subscription: WebhookSubscription,
    db: Session,
) -> None:
    """
    Delete a webhook subscription.

    Args:
        subscription: Subscription to delete
        db: Database session
    """
    connection = subscription.calendar_connection

    try:
        if connection.provider == CalendarProvider.MICROSOFT:
            from cal.oauth.microsoft import MicrosoftCalendarClient

            access_token = decrypt_token(connection.access_token)
            client = MicrosoftCalendarClient()
            await client.delete_subscription(access_token, subscription.subscription_id)

        elif connection.provider == CalendarProvider.GOOGLE:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            access_token = decrypt_token(connection.access_token)
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            # Stop the channel
            try:
                service.channels().stop(
                    body={
                        "id": subscription.subscription_id,
                        "resourceId": subscription.resource_path,
                    }
                ).execute()
            except Exception:
                pass  # Ignore errors when stopping

    except Exception as e:
        logger.warning(f"Failed to delete remote subscription: {e}")

    # Mark as inactive locally
    subscription.is_active = False
    db.flush()
