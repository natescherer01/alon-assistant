"""
Google Calendar OAuth Integration

Handles Google Calendar API interactions using google-api-python-client.
Implements OAuth 2.0 flow and calendar data fetching.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from dataclasses import dataclass

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


@dataclass
class GoogleCalendar:
    """Google Calendar metadata"""
    id: str
    name: str
    description: Optional[str]
    time_zone: str
    background_color: Optional[str]
    is_primary: bool


@dataclass
class GoogleTokens:
    """Google OAuth tokens"""
    access_token: str
    refresh_token: str
    expires_at: datetime


@dataclass
class GoogleEvent:
    """Google Calendar event"""
    id: str
    summary: str
    description: Optional[str]
    location: Optional[str]
    start: datetime
    end: datetime
    is_all_day: bool
    timezone: str
    status: str
    html_link: Optional[str]
    attendees: Optional[List[dict]]
    reminders: Optional[dict]
    recurrence: Optional[List[str]]
    recurring_event_id: Optional[str]
    original_start_time: Optional[datetime]


class GoogleOAuthConfig:
    """Google OAuth configuration loaded from environment"""

    def __init__(self):
        self.client_id = os.getenv("GOOGLE_CLIENT_ID", "")
        self.client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
        api_url = os.getenv("API_URL", "http://localhost:8000")
        self.redirect_uri = os.getenv(
            "GOOGLE_REDIRECT_URI",
            f"{api_url}/api/v1/calendar/oauth/google/callback"
        )
        self.scopes = [
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ]

    def is_configured(self) -> bool:
        """Check if Google OAuth is properly configured"""
        return bool(self.client_id and self.client_secret)

    def get_client_config(self) -> dict:
        """Get client configuration for OAuth flow"""
        return {
            "web": {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [self.redirect_uri],
            }
        }


# Singleton config instance
_config: Optional[GoogleOAuthConfig] = None


def get_google_config() -> GoogleOAuthConfig:
    """Get Google OAuth configuration singleton"""
    global _config
    if _config is None:
        _config = GoogleOAuthConfig()
    return _config


class GoogleCalendarClient:
    """
    Google Calendar API client.

    Handles OAuth flow and calendar operations.
    """

    def __init__(self, config: Optional[GoogleOAuthConfig] = None):
        self.config = config or get_google_config()

    def get_auth_url(self, state: str) -> str:
        """
        Generate Google OAuth authorization URL.

        Args:
            state: CSRF protection state parameter

        Returns:
            Authorization URL for user to visit
        """
        flow = Flow.from_client_config(
            self.config.get_client_config(),
            scopes=self.config.scopes,
            redirect_uri=self.config.redirect_uri,
        )

        auth_url, _ = flow.authorization_url(
            access_type="offline",  # Request refresh token
            prompt="consent",  # Force consent screen to get refresh token
            state=state,
            include_granted_scopes="true",
        )

        return auth_url

    async def get_tokens(self, code: str) -> GoogleTokens:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from OAuth callback

        Returns:
            GoogleTokens with access token, refresh token, and expiry

        Raises:
            ValueError: If token exchange fails
        """
        try:
            flow = Flow.from_client_config(
                self.config.get_client_config(),
                scopes=self.config.scopes,
                redirect_uri=self.config.redirect_uri,
            )

            flow.fetch_token(code=code)
            credentials = flow.credentials

            if not credentials.token:
                raise ValueError("No access token received from Google")

            if not credentials.refresh_token:
                raise ValueError("No refresh token received from Google")

            expires_at = credentials.expiry or (datetime.utcnow() + timedelta(hours=1))

            logger.info("Successfully exchanged Google authorization code for tokens")

            return GoogleTokens(
                access_token=credentials.token,
                refresh_token=credentials.refresh_token,
                expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to exchange Google authorization code: {e}")
            raise ValueError(f"Failed to get Google tokens: {e}")

    async def refresh_access_token(self, refresh_token: str) -> GoogleTokens:
        """
        Refresh Google access token using refresh token.

        Args:
            refresh_token: Refresh token from previous authorization

        Returns:
            New GoogleTokens with refreshed access token

        Raises:
            ValueError: If token refresh fails
        """
        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self.config.client_id,
                client_secret=self.config.client_secret,
            )

            # Refresh the credentials
            from google.auth.transport.requests import Request
            credentials.refresh(Request())

            if not credentials.token:
                raise ValueError("No access token received from refresh")

            expires_at = credentials.expiry or (datetime.utcnow() + timedelta(hours=1))

            logger.info("Successfully refreshed Google access token")

            return GoogleTokens(
                access_token=credentials.token,
                refresh_token=refresh_token,  # Keep the same refresh token
                expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to refresh Google access token: {e}")
            raise ValueError(f"Failed to refresh Google token: {e}")

    async def list_calendars(self, access_token: str) -> List[GoogleCalendar]:
        """
        List all calendars accessible to the user.

        Args:
            access_token: Valid Google access token

        Returns:
            List of GoogleCalendar objects

        Raises:
            ValueError: If listing calendars fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            response = service.calendarList().list().execute()
            items = response.get("items", [])

            if not items:
                logger.warning("No calendars found in Google Calendar response")
                return []

            calendars = [
                GoogleCalendar(
                    id=item["id"],
                    name=item.get("summary", "Unnamed Calendar"),
                    description=item.get("description"),
                    time_zone=item.get("timeZone", "UTC"),
                    background_color=item.get("backgroundColor"),
                    is_primary=item.get("primary", False),
                )
                for item in items
            ]

            logger.info(f"Retrieved {len(calendars)} Google calendars")
            return calendars
        except HttpError as e:
            logger.error(f"Failed to list Google calendars: {e}")
            raise ValueError(f"Failed to list Google calendars: {e}")
        except Exception as e:
            logger.error(f"Failed to list Google calendars: {e}")
            raise ValueError(f"Failed to list Google calendars: {e}")

    async def get_calendar_metadata(
        self, access_token: str, calendar_id: str
    ) -> GoogleCalendar:
        """
        Get metadata for a specific calendar.

        Args:
            access_token: Valid Google access token
            calendar_id: Google calendar ID

        Returns:
            GoogleCalendar with metadata

        Raises:
            ValueError: If getting metadata fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            response = service.calendars().get(calendarId=calendar_id).execute()

            return GoogleCalendar(
                id=response["id"],
                name=response.get("summary", "Unnamed Calendar"),
                description=response.get("description"),
                time_zone=response.get("timeZone", "UTC"),
                background_color=None,  # Not available in calendars.get
                is_primary=calendar_id == "primary",
            )
        except HttpError as e:
            logger.error(f"Failed to get Google calendar metadata: {e}")
            raise ValueError(f"Failed to get Google calendar metadata: {e}")

    async def get_events(
        self,
        access_token: str,
        calendar_id: str,
        time_min: datetime,
        time_max: datetime,
        sync_token: Optional[str] = None,
        max_results: int = 2500,
    ) -> tuple[List[GoogleEvent], Optional[str]]:
        """
        Get events from a calendar within a time range.

        Args:
            access_token: Valid Google access token
            calendar_id: Google calendar ID
            time_min: Start of time range
            time_max: End of time range
            sync_token: Token for incremental sync (optional)
            max_results: Maximum number of events to return

        Returns:
            Tuple of (list of events, next sync token)

        Raises:
            ValueError: If getting events fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            events: List[GoogleEvent] = []
            page_token = None
            next_sync_token = None

            while True:
                # Build request params
                params = {
                    "calendarId": calendar_id,
                    "maxResults": min(max_results, 2500),
                    "singleEvents": True,
                    "orderBy": "startTime",
                }

                if sync_token:
                    params["syncToken"] = sync_token
                else:
                    params["timeMin"] = time_min.isoformat() + "Z"
                    params["timeMax"] = time_max.isoformat() + "Z"

                if page_token:
                    params["pageToken"] = page_token

                response = service.events().list(**params).execute()

                for item in response.get("items", []):
                    event = self._parse_event(item)
                    if event:
                        events.append(event)

                page_token = response.get("nextPageToken")
                if not page_token:
                    next_sync_token = response.get("nextSyncToken")
                    break

            logger.info(f"Retrieved {len(events)} events from Google Calendar {calendar_id}")
            return events, next_sync_token

        except HttpError as e:
            if e.resp.status == 410:
                # Sync token expired, need full sync
                logger.warning(f"Google sync token expired for calendar {calendar_id}")
                raise ValueError("Sync token expired, full sync required")
            logger.error(f"Failed to get Google calendar events: {e}")
            raise ValueError(f"Failed to get Google calendar events: {e}")

    def _parse_event(self, item: dict) -> Optional[GoogleEvent]:
        """Parse a Google Calendar event from API response"""
        try:
            event_id = item.get("id")
            if not event_id:
                return None

            # Handle start/end times
            start_data = item.get("start", {})
            end_data = item.get("end", {})

            is_all_day = "date" in start_data
            timezone = start_data.get("timeZone", "UTC")

            if is_all_day:
                start = datetime.fromisoformat(start_data["date"])
                end = datetime.fromisoformat(end_data["date"])
            else:
                start_str = start_data.get("dateTime", "")
                end_str = end_data.get("dateTime", "")
                start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                end = datetime.fromisoformat(end_str.replace("Z", "+00:00"))

            # Parse attendees
            attendees = None
            if "attendees" in item:
                attendees = [
                    {
                        "email": att.get("email"),
                        "displayName": att.get("displayName"),
                        "responseStatus": att.get("responseStatus"),
                        "organizer": att.get("organizer", False),
                        "optional": att.get("optional", False),
                    }
                    for att in item["attendees"]
                ]

            return GoogleEvent(
                id=event_id,
                summary=item.get("summary", "(No title)"),
                description=item.get("description"),
                location=item.get("location"),
                start=start,
                end=end,
                is_all_day=is_all_day,
                timezone=timezone,
                status=item.get("status", "confirmed"),
                html_link=item.get("htmlLink"),
                attendees=attendees,
                reminders=item.get("reminders"),
                recurrence=item.get("recurrence"),
                recurring_event_id=item.get("recurringEventId"),
                original_start_time=(
                    datetime.fromisoformat(
                        item["originalStartTime"].get("dateTime", item["originalStartTime"].get("date", ""))
                        .replace("Z", "+00:00")
                    )
                    if "originalStartTime" in item
                    else None
                ),
            )
        except Exception as e:
            logger.warning(f"Failed to parse Google event: {e}")
            return None

    async def create_event(
        self,
        access_token: str,
        calendar_id: str,
        event_data: dict,
    ) -> dict:
        """
        Create an event in Google Calendar.

        Args:
            access_token: Valid Google access token
            calendar_id: Google calendar ID
            event_data: Event data in Google Calendar API format

        Returns:
            Created event data from API

        Raises:
            ValueError: If creating event fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            result = service.events().insert(
                calendarId=calendar_id,
                body=event_data,
            ).execute()

            logger.info(f"Created Google Calendar event: {result.get('id')}")
            return result
        except HttpError as e:
            logger.error(f"Failed to create Google calendar event: {e}")
            raise ValueError(f"Failed to create Google calendar event: {e}")

    async def update_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
        event_data: dict,
    ) -> dict:
        """
        Update an event in Google Calendar.

        Args:
            access_token: Valid Google access token
            calendar_id: Google calendar ID
            event_id: Google event ID
            event_data: Updated event data

        Returns:
            Updated event data from API

        Raises:
            ValueError: If updating event fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            result = service.events().update(
                calendarId=calendar_id,
                eventId=event_id,
                body=event_data,
            ).execute()

            logger.info(f"Updated Google Calendar event: {event_id}")
            return result
        except HttpError as e:
            logger.error(f"Failed to update Google calendar event: {e}")
            raise ValueError(f"Failed to update Google calendar event: {e}")

    async def delete_event(
        self,
        access_token: str,
        calendar_id: str,
        event_id: str,
    ) -> None:
        """
        Delete an event from Google Calendar.

        Args:
            access_token: Valid Google access token
            calendar_id: Google calendar ID
            event_id: Google event ID

        Raises:
            ValueError: If deleting event fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("calendar", "v3", credentials=credentials)

            service.events().delete(
                calendarId=calendar_id,
                eventId=event_id,
            ).execute()

            logger.info(f"Deleted Google Calendar event: {event_id}")
        except HttpError as e:
            if e.resp.status == 404:
                logger.warning(f"Google Calendar event not found for deletion: {event_id}")
                return  # Event already deleted
            logger.error(f"Failed to delete Google calendar event: {e}")
            raise ValueError(f"Failed to delete Google calendar event: {e}")

    async def revoke_token(self, token: str) -> None:
        """
        Revoke Google OAuth token (disconnect).

        Args:
            token: Access or refresh token to revoke
        """
        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": token},
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )
                if response.status_code == 200:
                    logger.info("Successfully revoked Google OAuth token")
                else:
                    logger.warning(f"Failed to revoke Google token: {response.text}")
        except Exception as e:
            logger.error(f"Failed to revoke Google OAuth token: {e}")
            # Don't throw - token might already be invalid

    async def get_user_email(self, access_token: str) -> str:
        """
        Get the email address of the authenticated user.

        Args:
            access_token: Valid Google access token

        Returns:
            User's email address

        Raises:
            ValueError: If getting user info fails
        """
        try:
            credentials = Credentials(token=access_token)
            service = build("oauth2", "v2", credentials=credentials)

            user_info = service.userinfo().get().execute()
            email = user_info.get("email")

            if not email:
                raise ValueError("No email found in user info")

            return email
        except Exception as e:
            logger.error(f"Failed to get Google user email: {e}")
            raise ValueError(f"Failed to get Google user email: {e}")
