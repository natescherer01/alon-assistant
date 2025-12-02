"""
SQLAlchemy models for calendar integration tables.

These models map to existing tables in the database created by the Alembic migration.
The tables are prefixed with "calendar_" to avoid conflicts with the main app tables.
"""
import enum
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Text, DateTime, Boolean, Integer,
    ForeignKey, Index, UniqueConstraint, Enum, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from database import Base


# ============================================================================
# Enums - These map to existing PostgreSQL enums in the database
# ============================================================================

class CalendarProvider(str, enum.Enum):
    """Calendar provider types supported by the application"""
    GOOGLE = "GOOGLE"
    MICROSOFT = "MICROSOFT"
    APPLE = "APPLE"
    ICS = "ICS"


class AuditStatus(str, enum.Enum):
    """Audit log action status"""
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"


class EventStatus(str, enum.Enum):
    """Calendar event status"""
    CONFIRMED = "CONFIRMED"
    TENTATIVE = "TENTATIVE"
    CANCELLED = "CANCELLED"


class SyncStatus(str, enum.Enum):
    """Calendar event sync status"""
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"
    DELETED = "DELETED"


class RecurrenceFrequency(str, enum.Enum):
    """Recurrence frequency for calendar events"""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class RsvpStatus(str, enum.Enum):
    """RSVP status for event attendees"""
    NEEDS_ACTION = "NEEDS_ACTION"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    TENTATIVE = "TENTATIVE"


class ReminderMethod(str, enum.Enum):
    """Reminder method (email, popup, sms)"""
    EMAIL = "EMAIL"
    POPUP = "POPUP"
    SMS = "SMS"


class DayOfWeek(str, enum.Enum):
    """Day of week for recurrence rules"""
    SUNDAY = "SUNDAY"
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"


class RecurrenceEndType(str, enum.Enum):
    """Recurrence end type"""
    NEVER = "NEVER"
    DATE = "DATE"
    COUNT = "COUNT"


class MonthDayType(str, enum.Enum):
    """Month day type for monthly recurrence"""
    DAY_OF_MONTH = "DAY_OF_MONTH"
    RELATIVE_DAY = "RELATIVE_DAY"


class EventImportance(str, enum.Enum):
    """Event importance level for Outlook/Exchange"""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"


# ============================================================================
# Models
# ============================================================================

class CalendarUser(Base):
    """
    User account model for calendar functionality.

    Maps to the 'calendar_users' table. This is separate from the main app's
    'users' table to maintain isolation between calendar and main app data.
    Users are linked by email address.
    """
    __tablename__ = "calendar_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), default="")
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String(100), default="UTC")
    sleep_start_time = Column(String(5), nullable=True)  # HH:MM format
    sleep_end_time = Column(String(5), nullable=True)    # HH:MM format

    # Relationships
    calendar_connections = relationship("CalendarConnection", back_populates="user", cascade="all, delete-orphan")
    oauth_states = relationship("OAuthState", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("CalendarSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("CalendarAuditLog", back_populates="user")

    __table_args__ = (
        Index("ix_calendar_users_email", "email"),
        Index("ix_calendar_users_deleted_at", "deleted_at"),
    )


class CalendarSession(Base):
    """
    Active session tracking for calendar authentication.

    Each session represents an active login with device/location context.
    """
    __tablename__ = "calendar_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("calendar_users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)

    # Relationships
    user = relationship("CalendarUser", back_populates="sessions")

    __table_args__ = (
        Index("ix_calendar_sessions_user_id", "user_id"),
        Index("ix_calendar_sessions_expires_at", "expires_at"),
        Index("ix_calendar_sessions_token_hash", "token_hash"),
    )


class OAuthState(Base):
    """
    OAuth state tokens for CSRF protection during OAuth flow.

    Expires after 15 minutes for security.
    Cleaned up automatically after successful OAuth callback.
    """
    __tablename__ = "oauth_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("calendar_users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Enum(CalendarProvider, name="calendar_provider", create_type=False), nullable=False)
    state = Column(String(255), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    consumed = Column(Boolean, default=False)

    # Relationships
    user = relationship("CalendarUser", back_populates="oauth_states")

    __table_args__ = (
        Index("ix_oauth_states_state", "state"),
        Index("ix_oauth_states_expires_at", "expires_at"),
        Index("ix_oauth_states_user_provider", "user_id", "provider"),
    )


class CalendarConnection(Base):
    """
    Calendar connection model for OAuth-based and ICS calendar integrations.

    Stores encrypted access/refresh tokens for OAuth providers (Google, Microsoft, Apple).
    Stores encrypted ICS subscription URLs for ICS calendars.
    Supports sync state tracking for all provider types.
    """
    __tablename__ = "calendar_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("calendar_users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Enum(CalendarProvider, name="calendar_provider", create_type=False), nullable=False)
    calendar_id = Column(String(255), nullable=False)
    calendar_name = Column(String(255), nullable=False)
    access_token = Column(Text, nullable=True)  # Encrypted
    refresh_token = Column(Text, nullable=True)  # Encrypted
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    calendar_color = Column(String(7), nullable=True)  # Hex color code
    is_primary = Column(Boolean, default=False)
    is_connected = Column(Boolean, default=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    sync_token = Column(Text, nullable=True)  # For incremental sync
    delegate_email = Column(String(255), nullable=True)  # For delegate calendars

    # ICS-specific fields
    ics_etag = Column(String(255), nullable=True)
    ics_last_modified = Column(String(255), nullable=True)
    ics_url = Column(Text, nullable=True)  # Encrypted
    is_read_only = Column(Boolean, default=False)

    # Relationships
    user = relationship("CalendarUser", back_populates="calendar_connections")
    events = relationship("CalendarEvent", back_populates="calendar_connection", cascade="all, delete-orphan")
    webhook_subscriptions = relationship("WebhookSubscription", back_populates="calendar_connection", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "provider", "calendar_id", name="unique_user_calendar"),
        Index("ix_calendar_connections_user_id", "user_id"),
        Index("ix_calendar_connections_provider", "provider"),
        Index("ix_calendar_connections_is_connected", "is_connected"),
        Index("ix_calendar_connections_last_synced", "last_synced_at"),
        Index("ix_calendar_connections_deleted_at", "deleted_at"),
        Index("ix_calendar_connections_delegate", "delegate_email"),
    )


class WebhookSubscription(Base):
    """
    Webhook subscription model for tracking Microsoft Graph and Google Calendar webhooks.

    Manages webhook lifecycle including expiration and renewal.
    """
    __tablename__ = "webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_connection_id = Column(UUID(as_uuid=True), ForeignKey("calendar_connections.id", ondelete="CASCADE"), nullable=False)
    provider = Column(Enum(CalendarProvider, name="calendar_provider", create_type=False), nullable=False)
    subscription_id = Column(String(255), nullable=False)
    resource_path = Column(String(500), nullable=False)
    expiration_datetime = Column(DateTime(timezone=True), nullable=False)
    client_state = Column(String(255), nullable=True)  # Secret for validating notifications
    notification_url = Column(Text, nullable=False)
    last_notification_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    calendar_connection = relationship("CalendarConnection", back_populates="webhook_subscriptions")

    __table_args__ = (
        UniqueConstraint("subscription_id", "provider", name="unique_provider_subscription"),
        Index("ix_webhook_subs_connection", "calendar_connection_id"),
        Index("ix_webhook_subs_sub_id", "subscription_id"),
        Index("ix_webhook_subs_expiration", "expiration_datetime"),
        Index("ix_webhook_subs_is_active", "is_active"),
        Index("ix_webhook_subs_provider", "provider"),
    )


class CalendarEvent(Base):
    """
    Calendar event model for storing synced events from all providers.

    Stores events in a unified schema with support for complex recurrence patterns.
    Supports recurring events, attendees, and reminders.
    """
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    calendar_connection_id = Column(UUID(as_uuid=True), ForeignKey("calendar_connections.id", ondelete="CASCADE"), nullable=False)
    provider_event_id = Column(String(255), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(500), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_all_day = Column(Boolean, default=False)
    timezone = Column(String(100), default="UTC")
    status = Column(Enum(EventStatus, name="event_status", create_type=False), default=EventStatus.CONFIRMED)
    sync_status = Column(Enum(SyncStatus, name="sync_status", create_type=False), default=SyncStatus.SYNCED)

    # Recurrence fields
    is_recurring = Column(Boolean, default=False)
    recurrence_rule = Column(Text, nullable=True)  # RRULE string
    recurrence_frequency = Column(Enum(RecurrenceFrequency, name="recurrence_frequency", create_type=False), nullable=True)
    recurrence_interval = Column(Integer, nullable=True)
    recurrence_end_date = Column(DateTime(timezone=True), nullable=True)
    recurrence_count = Column(Integer, nullable=True)
    recurrence_end_type = Column(Enum(RecurrenceEndType, name="recurrence_end_type", create_type=False), nullable=True)
    recurrence_by_day = Column(String(100), nullable=True)  # e.g., "MO,TU,WE"
    month_day_type = Column(Enum(MonthDayType, name="month_day_type", create_type=False), nullable=True)
    recurrence_by_month_day = Column(Integer, nullable=True)
    recurrence_by_set_pos = Column(Integer, nullable=True)  # For "first Monday", etc.
    recurrence_by_day_of_week = Column(Enum(DayOfWeek, name="day_of_week", create_type=False), nullable=True)
    recurrence_by_month = Column(String(50), nullable=True)
    exception_dates = Column(Text, nullable=True)  # Comma-separated dates

    # Parent-child for recurring events
    parent_event_id = Column(UUID(as_uuid=True), ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=True)

    # Attendees and reminders stored as JSON
    attendees = Column(JSON, nullable=True)
    reminders = Column(JSON, nullable=True)
    provider_metadata = Column(JSON, nullable=True)  # Provider-specific data

    html_link = Column(Text, nullable=True)  # Link to event in provider's web app
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    # Microsoft/Outlook-specific fields
    importance = Column(Enum(EventImportance, name="event_importance", create_type=False), default=EventImportance.NORMAL, nullable=True)
    outlook_categories = Column(Text, nullable=True)
    conversation_id = Column(String(255), nullable=True)
    series_master_id = Column(String(255), nullable=True)

    # Teams meeting fields
    teams_enabled = Column(Boolean, default=False)
    teams_meeting_url = Column(Text, nullable=True)
    teams_conference_id = Column(String(255), nullable=True)
    teams_dial_in_url = Column(Text, nullable=True)

    # Relationships
    calendar_connection = relationship("CalendarConnection", back_populates="events")
    parent_event = relationship("CalendarEvent", remote_side=[id], backref="child_events")
    event_attendees = relationship("EventAttendee", back_populates="event", cascade="all, delete-orphan")
    event_reminders = relationship("EventReminder", back_populates="event", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("calendar_connection_id", "provider_event_id", name="unique_calendar_provider_event"),
        Index("ix_cal_events_connection", "calendar_connection_id"),
        Index("ix_cal_events_provider_id", "provider_event_id"),
        Index("ix_cal_events_start_time", "start_time"),
        Index("ix_cal_events_end_time", "end_time"),
        Index("ix_cal_events_status", "status"),
        Index("ix_cal_events_sync_status", "sync_status"),
        Index("ix_cal_events_is_recurring", "is_recurring"),
        Index("ix_cal_events_parent", "parent_event_id"),
        Index("ix_cal_events_deleted_at", "deleted_at"),
        Index("ix_cal_events_recurrence_freq", "recurrence_frequency"),
        Index("ix_cal_events_recurrence_end", "recurrence_end_date"),
        Index("ix_cal_events_importance", "importance"),
        Index("ix_cal_events_conversation", "conversation_id"),
        Index("ix_cal_events_series_master", "series_master_id"),
        Index("ix_cal_events_teams", "teams_enabled"),
        Index("ix_cal_events_connection_time", "calendar_connection_id", "start_time", "end_time"),
        Index("ix_cal_events_connection_sync", "calendar_connection_id", "sync_status"),
    )


class EventAttendee(Base):
    """
    Event attendee model for managing event participants.

    Supports RSVP tracking and organizer designation.
    """
    __tablename__ = "event_attendees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    rsvp_status = Column(Enum(RsvpStatus, name="rsvp_status", create_type=False), default=RsvpStatus.NEEDS_ACTION)
    is_organizer = Column(Boolean, default=False)
    is_optional = Column(Boolean, default=False)
    comment = Column(Text, nullable=True)
    response_time = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    event = relationship("CalendarEvent", back_populates="event_attendees")

    __table_args__ = (
        UniqueConstraint("event_id", "email", name="unique_event_attendee"),
        Index("ix_event_attendees_event", "event_id"),
        Index("ix_event_attendees_email", "email"),
        Index("ix_event_attendees_rsvp", "rsvp_status"),
        Index("ix_event_attendees_organizer", "is_organizer"),
        Index("ix_event_attendees_event_rsvp", "event_id", "rsvp_status"),
    )


class EventReminder(Base):
    """
    Event reminder model for managing event notifications.

    Default: 30 minutes before event (Google Calendar default).
    """
    __tablename__ = "event_reminders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("calendar_events.id", ondelete="CASCADE"), nullable=False)
    method = Column(Enum(ReminderMethod, name="reminder_method", create_type=False), default=ReminderMethod.POPUP)
    minutes_before = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    event = relationship("CalendarEvent", back_populates="event_reminders")

    __table_args__ = (
        Index("ix_event_reminders_event", "event_id"),
        Index("ix_event_reminders_minutes", "minutes_before"),
        Index("ix_event_reminders_event_minutes", "event_id", "minutes_before"),
    )


class CalendarAuditLog(Base):
    """
    Audit log for security, compliance, and debugging.

    Tracks all significant user actions and system events.
    """
    __tablename__ = "calendar_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("calendar_users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(Enum(AuditStatus, name="calendar_audit_status", create_type=False), nullable=False)
    error_message = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    audit_metadata = Column("metadata", JSON, nullable=True)  # 'metadata' reserved in SQLAlchemy
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    user = relationship("CalendarUser", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_cal_audit_user", "user_id"),
        Index("ix_cal_audit_action", "action"),
        Index("ix_cal_audit_created", "created_at"),
        Index("ix_cal_audit_status", "status"),
        Index("ix_cal_audit_resource", "resource_type", "resource_id"),
    )
