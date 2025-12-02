"""
Background Jobs Service

Handles scheduled tasks for calendar synchronization:
- Periodic ICS calendar sync
- Webhook subscription renewal
- Cleanup of expired sessions and tokens
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from database import SessionLocal
from cal.models import (
    CalendarConnection, CalendarProvider, OAuthState,
    WebhookSubscription, CalendarAuditLog, AuditStatus,
)

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    """Get or create the scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start_scheduler():
    """Start the background job scheduler."""
    scheduler = get_scheduler()

    if scheduler.running:
        logger.warning("Scheduler is already running")
        return

    # Add jobs
    scheduler.add_job(
        sync_ics_calendars,
        IntervalTrigger(minutes=15),
        id="sync_ics_calendars",
        name="Sync ICS Calendars",
        replace_existing=True,
    )

    scheduler.add_job(
        renew_webhook_subscriptions,
        IntervalTrigger(hours=12),
        id="renew_webhook_subscriptions",
        name="Renew Webhook Subscriptions",
        replace_existing=True,
    )

    scheduler.add_job(
        cleanup_expired_sessions,
        IntervalTrigger(hours=1),
        id="cleanup_expired_sessions",
        name="Cleanup Expired Sessions",
        replace_existing=True,
    )

    scheduler.add_job(
        cleanup_expired_oauth_states,
        IntervalTrigger(hours=1),
        id="cleanup_expired_oauth_states",
        name="Cleanup Expired OAuth States",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Calendar background scheduler started")


def stop_scheduler():
    """Stop the background job scheduler."""
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Calendar background scheduler stopped")


async def sync_ics_calendars():
    """
    Sync all ICS calendars.

    Runs every 15 minutes to fetch updates from ICS feeds.
    """
    logger.info("Starting scheduled ICS calendar sync")

    db = SessionLocal()
    try:
        from cal.services.ics import sync_ics_events

        connections = db.query(CalendarConnection).filter(
            CalendarConnection.provider == CalendarProvider.ICS,
            CalendarConnection.is_connected == True,
            CalendarConnection.deleted_at.is_(None),
        ).all()

        success_count = 0
        error_count = 0

        for connection in connections:
            try:
                await sync_ics_events(connection, db)
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to sync ICS calendar {connection.id}: {e}")
                error_count += 1

        logger.info(f"ICS sync complete: {success_count} succeeded, {error_count} failed")

    except Exception as e:
        logger.error(f"ICS sync job failed: {e}")
    finally:
        db.close()


async def renew_webhook_subscriptions():
    """
    Renew expiring webhook subscriptions.

    Microsoft Graph subscriptions expire after ~3 days.
    Renews subscriptions expiring within the next 24 hours.
    """
    logger.info("Starting scheduled webhook subscription renewal")

    db = SessionLocal()
    try:
        from cal.oauth.microsoft import MicrosoftCalendarClient
        from cal.dependencies import decrypt_token, encrypt_token

        # Find subscriptions expiring within 24 hours
        expiring_soon = datetime.utcnow() + timedelta(hours=24)

        subscriptions = db.query(WebhookSubscription).join(CalendarConnection).filter(
            WebhookSubscription.is_active == True,
            WebhookSubscription.expiration_datetime < expiring_soon,
            CalendarConnection.is_connected == True,
            CalendarConnection.deleted_at.is_(None),
        ).all()

        renewed_count = 0
        failed_count = 0

        for subscription in subscriptions:
            try:
                connection = subscription.calendar_connection

                # Only Microsoft subscriptions need renewal
                if connection.provider != CalendarProvider.MICROSOFT:
                    continue

                # Get access token
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

                # Renew subscription
                client = MicrosoftCalendarClient()
                renewed = await client.renew_subscription(
                    access_token,
                    subscription.subscription_id,
                )

                subscription.expiration_datetime = renewed.expiration_datetime
                subscription.updated_at = datetime.utcnow()
                renewed_count += 1

            except Exception as e:
                logger.error(f"Failed to renew subscription {subscription.id}: {e}")
                # Mark as inactive if renewal fails
                subscription.is_active = False
                failed_count += 1

        db.commit()
        logger.info(f"Webhook renewal complete: {renewed_count} renewed, {failed_count} failed")

    except Exception as e:
        logger.error(f"Webhook renewal job failed: {e}")
    finally:
        db.close()


async def cleanup_expired_sessions():
    """
    Clean up expired calendar sessions from the database.
    """
    logger.info("Starting expired session cleanup")

    db = SessionLocal()
    try:
        from cal.models import CalendarSession

        now = datetime.utcnow()
        deleted = db.query(CalendarSession).filter(
            CalendarSession.expires_at < now,
        ).delete()

        db.commit()
        logger.info(f"Cleaned up {deleted} expired calendar sessions")

    except Exception as e:
        logger.error(f"Session cleanup job failed: {e}")
    finally:
        db.close()


async def cleanup_expired_oauth_states():
    """
    Clean up expired OAuth state tokens.
    """
    logger.info("Starting expired OAuth state cleanup")

    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # Delete expired or consumed states older than 1 hour
        one_hour_ago = now - timedelta(hours=1)

        deleted = db.query(OAuthState).filter(
            (OAuthState.expires_at < now) | (
                (OAuthState.consumed == True) &
                (OAuthState.created_at < one_hour_ago)
            )
        ).delete()

        db.commit()
        logger.info(f"Cleaned up {deleted} expired/consumed OAuth states")

    except Exception as e:
        logger.error(f"OAuth state cleanup job failed: {e}")
    finally:
        db.close()


async def cleanup_expired_subscriptions():
    """
    Deactivate expired webhook subscriptions.
    """
    logger.info("Starting expired subscription cleanup")

    db = SessionLocal()
    try:
        now = datetime.utcnow()

        updated = db.query(WebhookSubscription).filter(
            WebhookSubscription.is_active == True,
            WebhookSubscription.expiration_datetime < now,
        ).update({"is_active": False})

        db.commit()
        logger.info(f"Deactivated {updated} expired webhook subscriptions")

    except Exception as e:
        logger.error(f"Subscription cleanup job failed: {e}")
    finally:
        db.close()
