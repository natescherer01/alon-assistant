"""
Service for fetching busy time blocks across multiple users.

This service provides privacy-preserving busy time queries - it only returns
time blocks without event details (titles, descriptions, attendees, etc.).
"""
import logging
from datetime import datetime
from typing import List, Dict, Any
from uuid import UUID
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from backend.cal.models import CalendarEvent, CalendarConnection, CalendarUser
from backend.models import User

logger = logging.getLogger(__name__)


class BusyTimeService:
    """Service for managing busy time queries across multiple users."""

    @staticmethod
    def get_all_users_with_calendars(db: Session) -> List[Dict[str, Any]]:
        """
        Get all users, indicating if they have calendar connections.

        Returns:
            List of user dicts with id, email, full_name, has_calendar
            where has_calendar indicates the user has active calendar connections.
        """
        # Query all main users
        users = db.query(User).all()

        result = []
        for user in users:
            # Check if user has calendar connections via CalendarUser
            calendar_user = db.query(CalendarUser).filter(
                CalendarUser.email == user.email  # Link by email
            ).first()

            has_calendar = False
            if calendar_user:
                # Check if user has any active calendar connections (integrations)
                # This shows users who have connected calendars, even if they
                # don't have events synced yet
                connection_count = (
                    db.query(CalendarConnection)
                    .filter(
                        and_(
                            CalendarConnection.user_id == calendar_user.id,
                            CalendarConnection.deleted_at.is_(None),
                        )
                    )
                    .count()
                )
                has_calendar = connection_count > 0

            result.append({
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "has_calendar": has_calendar
            })

        return result

    @staticmethod
    def get_busy_blocks(
        db: Session,
        user_ids: List[int],
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get busy time blocks for selected users.

        Returns only time ranges - no event details (privacy by design).

        Args:
            db: Database session
            user_ids: List of main User IDs to check
            start_date: Start of date range
            end_date: End of date range

        Returns:
            List of busy block dicts with user_id, user_name, start/end times
        """
        logger.info(
            f"Fetching busy blocks for {len(user_ids)} users "
            f"from {start_date} to {end_date}"
        )

        # Batch fetch all users at once (avoid N+1)
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        user_emails = {u.email: u for u in users}

        if not user_emails:
            return []

        # Batch fetch all calendar users
        calendar_users = db.query(CalendarUser).filter(
            CalendarUser.email.in_(user_emails.keys())
        ).all()

        email_to_calendar_user = {cu.email: cu for cu in calendar_users}

        busy_blocks = []

        for email, user in user_emails.items():
            calendar_user = email_to_calendar_user.get(email)
            if not calendar_user:
                continue

            # Get all events for this user's calendars
            # Note: We don't require is_connected == True because we want to show
            # events from any synced calendar, even if the connection is stale
            events = (
                db.query(CalendarEvent)
                .join(CalendarConnection)
                .filter(
                    and_(
                        CalendarConnection.user_id == calendar_user.id,
                        CalendarConnection.deleted_at.is_(None),
                        CalendarEvent.deleted_at.is_(None),
                        or_(
                            # Regular events overlapping range
                            and_(
                                CalendarEvent.is_all_day == False,
                                CalendarEvent.start_time < end_date,
                                CalendarEvent.end_time > start_date
                            ),
                            # All-day events in range
                            and_(
                                CalendarEvent.is_all_day == True,
                                CalendarEvent.start_time < end_date,
                                CalendarEvent.start_time >= start_date
                            )
                        )
                    )
                )
                .all()
            )

            # Convert to busy blocks (no event details - privacy)
            user_name = user.full_name or email.split('@')[0]
            for event in events:
                busy_blocks.append({
                    "user_id": user.id,
                    "user_name": user_name,
                    "start_time": event.start_time,
                    "end_time": event.end_time,
                    "is_all_day": event.is_all_day
                    # Note: No title, description, or other details exposed
                })

        logger.info(f"Found {len(busy_blocks)} busy blocks")
        return busy_blocks
