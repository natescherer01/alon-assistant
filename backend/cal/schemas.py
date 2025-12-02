"""
Pydantic schemas for calendar API request/response validation.

These schemas mirror the TypeScript Zod validators from the Express backend
to ensure consistent validation across the migration.
"""
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator, EmailStr


# ============================================================================
# Enums for request validation
# ============================================================================

class DayOfWeekEnum(str, Enum):
    """Day of week for recurrence rules"""
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"


class RecurrenceFrequencyEnum(str, Enum):
    """Recurrence frequency options"""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class RecurrenceEndTypeEnum(str, Enum):
    """Recurrence end type options"""
    NEVER = "NEVER"
    DATE = "DATE"
    COUNT = "COUNT"


class MonthDayTypeEnum(str, Enum):
    """Month day type for monthly recurrence"""
    DAY_OF_MONTH = "DAY_OF_MONTH"
    RELATIVE_DAY = "RELATIVE_DAY"


class ReminderMethodEnum(str, Enum):
    """Reminder method options"""
    EMAIL = "EMAIL"
    POPUP = "POPUP"
    SMS = "SMS"


class CalendarProviderEnum(str, Enum):
    """Calendar provider types"""
    GOOGLE = "GOOGLE"
    MICROSOFT = "MICROSOFT"
    APPLE = "APPLE"
    ICS = "ICS"


class EventStatusEnum(str, Enum):
    """Event status options"""
    CONFIRMED = "CONFIRMED"
    TENTATIVE = "TENTATIVE"
    CANCELLED = "CANCELLED"


class SyncStatusEnum(str, Enum):
    """Sync status options"""
    PENDING = "PENDING"
    SYNCED = "SYNCED"
    FAILED = "FAILED"
    DELETED = "DELETED"


class RsvpStatusEnum(str, Enum):
    """RSVP status options"""
    NEEDS_ACTION = "NEEDS_ACTION"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    TENTATIVE = "TENTATIVE"


# ============================================================================
# Nested schemas for events
# ============================================================================

class RecurrenceRequest(BaseModel):
    """Recurrence configuration for events"""
    frequency: RecurrenceFrequencyEnum
    interval: int = Field(default=1, ge=1, le=999)
    by_day: Optional[List[DayOfWeekEnum]] = Field(default=None, alias="byDay")
    month_day_type: Optional[MonthDayTypeEnum] = Field(default=None, alias="monthDayType")
    by_month_day: Optional[int] = Field(default=None, ge=1, le=31, alias="byMonthDay")
    by_set_pos: Optional[int] = Field(default=None, ge=-4, le=4, alias="bySetPos")
    by_day_of_week: Optional[DayOfWeekEnum] = Field(default=None, alias="byDayOfWeek")
    by_month: Optional[List[int]] = Field(default=None, alias="byMonth")
    end_type: RecurrenceEndTypeEnum = Field(alias="endType")
    end_date: Optional[datetime] = Field(default=None, alias="endDate")
    count: Optional[int] = Field(default=None, ge=1, le=999)
    exception_dates: Optional[List[datetime]] = Field(default=None, alias="exceptionDates")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_recurrence(self):
        # If endType is DATE, endDate is required
        if self.end_type == RecurrenceEndTypeEnum.DATE and not self.end_date:
            raise ValueError("endDate is required when endType is DATE")

        # If endType is COUNT, count is required
        if self.end_type == RecurrenceEndTypeEnum.COUNT and not self.count:
            raise ValueError("count is required when endType is COUNT")

        # If frequency is WEEKLY, byDay should be provided
        if self.frequency == RecurrenceFrequencyEnum.WEEKLY:
            if not self.by_day or len(self.by_day) == 0:
                raise ValueError("byDay is required for WEEKLY recurrence")

        # If frequency is MONTHLY and monthDayType is RELATIVE_DAY
        if self.frequency == RecurrenceFrequencyEnum.MONTHLY:
            if self.month_day_type == MonthDayTypeEnum.RELATIVE_DAY:
                if not self.by_set_pos or not self.by_day_of_week:
                    raise ValueError("bySetPos and byDayOfWeek are required for RELATIVE_DAY monthly recurrence")
            elif self.month_day_type == MonthDayTypeEnum.DAY_OF_MONTH:
                if not self.by_month_day:
                    raise ValueError("byMonthDay is required for DAY_OF_MONTH monthly recurrence")

        return self


class AttendeeRequest(BaseModel):
    """Attendee for event creation/update"""
    email: EmailStr
    is_organizer: bool = Field(default=False, alias="isOrganizer")
    is_optional: bool = Field(default=False, alias="isOptional")

    model_config = {"populate_by_name": True}


class ReminderRequest(BaseModel):
    """Reminder for event creation/update"""
    method: ReminderMethodEnum
    minutes_before: int = Field(ge=0, le=40320, alias="minutesBefore")  # Max 4 weeks

    model_config = {"populate_by_name": True}


# ============================================================================
# Event request schemas
# ============================================================================

class CreateEventRequest(BaseModel):
    """Request schema for creating a new event"""
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = Field(default=None, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=500)
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    is_all_day: bool = Field(default=False, alias="isAllDay")
    timezone: str = Field(default="UTC")
    calendar_connection_id: UUID = Field(alias="calendarConnectionId")
    recurrence: Optional[RecurrenceRequest] = None
    attendees: List[AttendeeRequest] = Field(default_factory=list, max_length=100)
    reminders: Optional[List[ReminderRequest]] = Field(default=None, max_length=10)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_event(self):
        # End time must be after start time
        if self.end_time <= self.start_time:
            raise ValueError("End time must be after start time")

        # Event duration should not exceed 30 days
        duration = self.end_time - self.start_time
        if duration.days > 30:
            raise ValueError("Event duration cannot exceed 30 days")

        # Validate only one organizer
        organizers = [a for a in self.attendees if a.is_organizer]
        if len(organizers) > 1:
            raise ValueError("Only one organizer is allowed")

        # Validate unique email addresses
        emails = [a.email.lower() for a in self.attendees]
        if len(emails) != len(set(emails)):
            raise ValueError("Duplicate email addresses are not allowed")

        return self


class UpdateEventRequest(BaseModel):
    """Request schema for updating an existing event"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = Field(default=None, max_length=2000)
    location: Optional[str] = Field(default=None, max_length=500)
    start_time: Optional[datetime] = Field(default=None, alias="startTime")
    end_time: Optional[datetime] = Field(default=None, alias="endTime")
    is_all_day: Optional[bool] = Field(default=None, alias="isAllDay")
    timezone: Optional[str] = None
    recurrence: Optional[RecurrenceRequest] = None
    attendees: Optional[List[AttendeeRequest]] = Field(default=None, max_length=100)
    reminders: Optional[List[ReminderRequest]] = Field(default=None, max_length=10)

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_event(self):
        # If both start and end time are provided, validate
        if self.start_time and self.end_time:
            if self.end_time <= self.start_time:
                raise ValueError("End time must be after start time")

            duration = self.end_time - self.start_time
            if duration.days > 30:
                raise ValueError("Event duration cannot exceed 30 days")

        # Validate attendees if provided
        if self.attendees:
            organizers = [a for a in self.attendees if a.is_organizer]
            if len(organizers) > 1:
                raise ValueError("Only one organizer is allowed")

            emails = [a.email.lower() for a in self.attendees]
            if len(emails) != len(set(emails)):
                raise ValueError("Duplicate email addresses are not allowed")

        return self


# ============================================================================
# Event response schemas
# ============================================================================

class CalendarInfo(BaseModel):
    """Calendar info included in event responses"""
    provider: CalendarProviderEnum
    name: str
    color: Optional[str] = None
    is_read_only: bool = Field(default=False, alias="isReadOnly")

    model_config = {"populate_by_name": True}


class EventResponse(BaseModel):
    """Response schema for a calendar event"""
    id: UUID
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    is_all_day: bool = Field(alias="isAllDay")
    timezone: str
    status: EventStatusEnum
    is_recurring: bool = Field(alias="isRecurring")
    recurrence_rule: Optional[str] = Field(default=None, alias="recurrenceRule")
    attendees: Optional[List[dict]] = None
    reminders: Optional[List[dict]] = None
    html_link: Optional[str] = Field(default=None, alias="htmlLink")
    calendar_id: UUID = Field(alias="calendarId")
    provider: CalendarProviderEnum
    calendar_name: str = Field(alias="calendarName")
    calendar_color: Optional[str] = Field(default=None, alias="calendarColor")

    model_config = {"populate_by_name": True, "from_attributes": True}


class EventDetailResponse(BaseModel):
    """Detailed response for a single event"""
    id: str  # Can be composite ID for recurring instances
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    is_all_day: bool = Field(alias="isAllDay")
    timezone: str
    status: EventStatusEnum
    is_recurring: bool = Field(alias="isRecurring")
    recurrence_rule: Optional[str] = Field(default=None, alias="recurrenceRule")
    attendees: Optional[List[dict]] = None
    reminders: Optional[List[dict]] = None
    html_link: Optional[str] = Field(default=None, alias="htmlLink")
    calendar: CalendarInfo
    provider_metadata: Optional[dict] = Field(default=None, alias="providerMetadata")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


class CreateEventResponse(BaseModel):
    """Response after creating an event"""
    id: UUID
    title: str
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    sync_status: SyncStatusEnum = Field(alias="syncStatus")
    google_event_id: Optional[str] = Field(default=None, alias="googleEventId")
    html_link: Optional[str] = Field(default=None, alias="htmlLink")
    message: Optional[str] = None

    model_config = {"populate_by_name": True}


class UpdateEventResponse(BaseModel):
    """Response after updating an event"""
    id: UUID
    title: str
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    sync_status: SyncStatusEnum = Field(alias="syncStatus")
    provider_event_id: Optional[str] = Field(default=None, alias="providerEventId")
    html_link: Optional[str] = Field(default=None, alias="htmlLink")
    message: Optional[str] = None

    model_config = {"populate_by_name": True}


class DeleteEventResponse(BaseModel):
    """Response after deleting an event"""
    id: UUID
    message: str
    deleted_from_provider: bool = Field(alias="deletedFromProvider")

    model_config = {"populate_by_name": True}


class UpcomingEventResponse(BaseModel):
    """Response for upcoming events list"""
    id: UUID
    title: str
    start_time: datetime = Field(alias="startTime")
    end_time: datetime = Field(alias="endTime")
    is_all_day: bool = Field(alias="isAllDay")
    location: Optional[str] = None
    calendar: CalendarInfo

    model_config = {"populate_by_name": True}


# ============================================================================
# Calendar connection schemas
# ============================================================================

class CalendarConnectionResponse(BaseModel):
    """Response for a calendar connection"""
    id: UUID
    provider: CalendarProviderEnum
    calendar_id: str = Field(alias="calendarId")
    calendar_name: str = Field(alias="calendarName")
    calendar_color: Optional[str] = Field(default=None, alias="calendarColor")
    is_primary: bool = Field(alias="isPrimary")
    is_connected: bool = Field(alias="isConnected")
    is_read_only: bool = Field(alias="isReadOnly")
    last_synced_at: Optional[datetime] = Field(default=None, alias="lastSyncedAt")
    created_at: datetime = Field(alias="createdAt")

    model_config = {"populate_by_name": True, "from_attributes": True}


class CalendarMetadataResponse(BaseModel):
    """Detailed metadata for a calendar connection"""
    id: UUID
    provider: CalendarProviderEnum
    calendar_id: str = Field(alias="calendarId")
    calendar_name: str = Field(alias="calendarName")
    calendar_color: Optional[str] = Field(default=None, alias="calendarColor")
    is_primary: bool = Field(alias="isPrimary")
    is_connected: bool = Field(alias="isConnected")
    is_read_only: bool = Field(alias="isReadOnly")
    last_synced_at: Optional[datetime] = Field(default=None, alias="lastSyncedAt")
    created_at: datetime = Field(alias="createdAt")
    event_count: int = Field(alias="eventCount")
    has_webhook: bool = Field(alias="hasWebhook")

    model_config = {"populate_by_name": True}


class CalendarStatsResponse(BaseModel):
    """Calendar statistics response"""
    total_calendars: int = Field(alias="totalCalendars")
    connected_calendars: int = Field(alias="connectedCalendars")
    total_events: int = Field(alias="totalEvents")
    upcoming_events: int = Field(alias="upcomingEvents")
    providers: dict  # Provider breakdown

    model_config = {"populate_by_name": True}


# ============================================================================
# Sync schemas
# ============================================================================

class SyncStatsResponse(BaseModel):
    """Statistics from a sync operation"""
    total_events: int = Field(alias="totalEvents")
    new_events: int = Field(alias="newEvents")
    updated_events: int = Field(alias="updatedEvents")
    deleted_events: int = Field(alias="deletedEvents")
    errors: List[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class SyncAllResponse(BaseModel):
    """Response from syncing all calendars"""
    message: str
    stats: SyncStatsResponse
    calendar_count: int = Field(alias="calendarCount")

    model_config = {"populate_by_name": True}


# ============================================================================
# OAuth schemas
# ============================================================================

class OAuthLoginResponse(BaseModel):
    """Response containing OAuth redirect URL"""
    auth_url: str = Field(alias="authUrl")
    state: str

    model_config = {"populate_by_name": True}


class OAuthCallbackResponse(BaseModel):
    """Response from OAuth callback"""
    success: bool
    session_id: str = Field(alias="sessionId")
    redirect_url: str = Field(alias="redirectUrl")

    model_config = {"populate_by_name": True}


class CalendarListItem(BaseModel):
    """Calendar item returned during OAuth flow for selection"""
    id: str
    name: str
    color: Optional[str] = None
    is_primary: bool = Field(alias="isPrimary")
    is_selected: bool = Field(default=False, alias="isSelected")
    access_role: Optional[str] = Field(default=None, alias="accessRole")

    model_config = {"populate_by_name": True}


class OAuthSessionResponse(BaseModel):
    """Session data for calendar selection after OAuth"""
    provider: CalendarProviderEnum
    calendars: List[CalendarListItem]
    user_email: str = Field(alias="userEmail")
    expires_at: datetime = Field(alias="expiresAt")

    model_config = {"populate_by_name": True}


class CalendarSelectRequest(BaseModel):
    """Request to select calendars to connect"""
    code: str  # Session code or token
    selected_calendar_ids: List[str] = Field(alias="selectedCalendarIds")

    model_config = {"populate_by_name": True}


class CalendarSelectResponse(BaseModel):
    """Response after selecting calendars"""
    success: bool
    connected_count: int = Field(alias="connectedCount")
    calendars: List[CalendarConnectionResponse]

    model_config = {"populate_by_name": True}


# ============================================================================
# ICS schemas
# ============================================================================

class ICSValidateRequest(BaseModel):
    """Request to validate an ICS URL"""
    url: str = Field(min_length=1)
    name: Optional[str] = Field(default=None, max_length=255)


class ICSValidateResponse(BaseModel):
    """Response from ICS URL validation"""
    valid: bool
    name: Optional[str] = None
    event_count: Optional[int] = Field(default=None, alias="eventCount")
    error: Optional[str] = None

    model_config = {"populate_by_name": True}


class ICSConnectRequest(BaseModel):
    """Request to connect an ICS calendar"""
    url: str = Field(min_length=1)
    name: str = Field(min_length=1, max_length=255)
    color: Optional[str] = Field(default=None, max_length=7)


class ICSUpdateRequest(BaseModel):
    """Request to update an ICS calendar"""
    name: Optional[str] = Field(default=None, max_length=255)
    color: Optional[str] = Field(default=None, max_length=7)
    url: Optional[str] = None


# ============================================================================
# Webhook schemas
# ============================================================================

class WebhookEnableResponse(BaseModel):
    """Response after enabling webhook"""
    success: bool
    subscription_id: str = Field(alias="subscriptionId")
    expires_at: datetime = Field(alias="expiresAt")

    model_config = {"populate_by_name": True}


class WebhookDisableResponse(BaseModel):
    """Response after disabling webhook"""
    success: bool
    message: str

    model_config = {"populate_by_name": True}


# ============================================================================
# Error schemas
# ============================================================================

class ValidationErrorDetail(BaseModel):
    """Detail for a single validation error"""
    field: str
    message: str


class ValidationErrorResponse(BaseModel):
    """Response for validation errors"""
    error: str = "Validation Error"
    message: str
    details: List[ValidationErrorDetail]


class ErrorResponse(BaseModel):
    """Generic error response"""
    error: str
    message: str
