"""
Microsoft Outlook Calendar Integration

Handles Microsoft Graph API interactions for Outlook Calendar.
Implements OAuth 2.0 flow using MSAL and calendar data fetching.
Supports real-time webhooks via Microsoft Graph subscriptions.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from dataclasses import dataclass

import msal
import httpx

logger = logging.getLogger(__name__)


@dataclass
class MicrosoftCalendar:
    """Microsoft Calendar metadata"""
    id: str
    name: str
    color: str
    is_default_calendar: bool
    can_edit: bool
    owner_name: str
    owner_address: str


@dataclass
class MicrosoftTokens:
    """Microsoft OAuth tokens"""
    access_token: str
    refresh_token: str
    expires_at: datetime


@dataclass
class MicrosoftEvent:
    """Microsoft Calendar event"""
    id: str
    subject: str
    body_preview: Optional[str]
    body_content: Optional[str]
    location: Optional[str]
    start: datetime
    end: datetime
    start_timezone: str
    end_timezone: str
    is_all_day: bool
    is_cancelled: bool
    importance: str
    status: str
    attendees: Optional[List[dict]]
    organizer: Optional[dict]
    categories: Optional[List[str]]
    recurrence: Optional[dict]
    series_master_id: Optional[str]
    event_type: str
    web_link: Optional[str]
    teams_enabled: bool
    teams_meeting_url: Optional[str]
    teams_conference_id: Optional[str]
    created_at: datetime
    modified_at: datetime
    is_removed: bool = False


@dataclass
class WebhookSubscription:
    """Microsoft Graph webhook subscription"""
    id: str
    resource: str
    change_type: str
    client_state: Optional[str]
    notification_url: str
    expiration_datetime: datetime


class MicrosoftOAuthConfig:
    """Microsoft OAuth configuration loaded from environment"""

    def __init__(self):
        self.client_id = os.getenv("MICROSOFT_CLIENT_ID", "")
        self.client_secret = os.getenv("MICROSOFT_CLIENT_SECRET", "")
        self.tenant = os.getenv("MICROSOFT_TENANT_ID", "common")
        self.authority = f"https://login.microsoftonline.com/{self.tenant}"
        api_url = os.getenv("API_URL", "http://localhost:8000")
        self.redirect_uri = os.getenv(
            "MICROSOFT_REDIRECT_URI",
            f"{api_url}/api/v1/calendar/oauth/microsoft/callback"
        )
        self.scopes = [
            "Calendars.Read",
            "Calendars.ReadWrite",
            "User.Read",
            "offline_access",
        ]

    def is_configured(self) -> bool:
        """Check if Microsoft OAuth is properly configured"""
        return bool(self.client_id and self.client_secret)


# Singleton config instance
_config: Optional[MicrosoftOAuthConfig] = None


def get_microsoft_config() -> MicrosoftOAuthConfig:
    """Get Microsoft OAuth configuration singleton"""
    global _config
    if _config is None:
        _config = MicrosoftOAuthConfig()
    return _config


# Microsoft color mapping
MICROSOFT_COLORS = {
    "auto": "#1F77B4",
    "lightBlue": "#5B9BD5",
    "lightGreen": "#70AD47",
    "lightOrange": "#FFC000",
    "lightGray": "#A6A6A6",
    "lightYellow": "#FFD966",
    "lightTeal": "#4BACC6",
    "lightPink": "#F4B4C4",
    "lightBrown": "#C65911",
    "lightRed": "#E74856",
    "maxColor": "#333333",
}


class MicrosoftCalendarClient:
    """
    Microsoft Calendar API client.

    Handles OAuth flow and calendar operations via Microsoft Graph API.
    """

    GRAPH_API_BASE = "https://graph.microsoft.com/v1.0"

    def __init__(self, config: Optional[MicrosoftOAuthConfig] = None):
        self.config = config or get_microsoft_config()
        self._msal_app: Optional[msal.ConfidentialClientApplication] = None

    @property
    def msal_app(self) -> msal.ConfidentialClientApplication:
        """Get or create MSAL application instance"""
        if self._msal_app is None:
            self._msal_app = msal.ConfidentialClientApplication(
                self.config.client_id,
                authority=self.config.authority,
                client_credential=self.config.client_secret,
            )
        return self._msal_app

    async def get_auth_url(self, state: str) -> str:
        """
        Generate Microsoft OAuth authorization URL.

        Args:
            state: CSRF protection state parameter

        Returns:
            Authorization URL for user to visit
        """
        auth_url = self.msal_app.get_authorization_request_url(
            scopes=self.config.scopes,
            redirect_uri=self.config.redirect_uri,
            state=state,
            prompt="consent",  # Force consent to get refresh token
        )
        return auth_url

    async def get_tokens(self, code: str) -> MicrosoftTokens:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from OAuth callback

        Returns:
            MicrosoftTokens with access token, refresh token, and expiry

        Raises:
            ValueError: If token exchange fails
        """
        try:
            result = self.msal_app.acquire_token_by_authorization_code(
                code=code,
                scopes=self.config.scopes,
                redirect_uri=self.config.redirect_uri,
            )

            if "error" in result:
                error_desc = result.get("error_description", result.get("error"))
                raise ValueError(f"Token exchange failed: {error_desc}")

            access_token = result.get("access_token")
            refresh_token = result.get("refresh_token")
            expires_in = result.get("expires_in", 3600)

            if not access_token:
                raise ValueError("No access token received from Microsoft")

            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            logger.info("Successfully exchanged Microsoft authorization code for tokens")

            return MicrosoftTokens(
                access_token=access_token,
                refresh_token=refresh_token or "",
                expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to exchange Microsoft authorization code: {e}")
            raise ValueError(f"Failed to get Microsoft tokens: {e}")

    async def refresh_access_token(self, refresh_token: str) -> MicrosoftTokens:
        """
        Refresh Microsoft access token using refresh token.

        Args:
            refresh_token: Refresh token from previous authorization

        Returns:
            New MicrosoftTokens with refreshed access token

        Raises:
            ValueError: If token refresh fails
        """
        try:
            result = self.msal_app.acquire_token_by_refresh_token(
                refresh_token=refresh_token,
                scopes=self.config.scopes,
            )

            if "error" in result:
                error_desc = result.get("error_description", result.get("error"))
                raise ValueError(f"Token refresh failed: {error_desc}")

            access_token = result.get("access_token")
            new_refresh_token = result.get("refresh_token", refresh_token)
            expires_in = result.get("expires_in", 3600)

            if not access_token:
                raise ValueError("No access token received from refresh")

            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            logger.info("Successfully refreshed Microsoft access token")

            return MicrosoftTokens(
                access_token=access_token,
                refresh_token=new_refresh_token,
                expires_at=expires_at,
            )
        except Exception as e:
            logger.error(f"Failed to refresh Microsoft access token: {e}")
            raise ValueError(f"Failed to refresh Microsoft token: {e}")

    async def _make_graph_request(
        self,
        access_token: str,
        method: str,
        endpoint: str,
        json_data: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict:
        """Make a request to Microsoft Graph API"""
        url = f"{self.GRAPH_API_BASE}{endpoint}"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient() as client:
            if method == "GET":
                response = await client.get(url, headers=headers, params=params)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=json_data)
            elif method == "PATCH":
                response = await client.patch(url, headers=headers, json=json_data)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After", "60")
                raise ValueError(f"Rate limited. Retry after {retry_after} seconds")

            if response.status_code == 404:
                raise ValueError("Resource not found")

            if response.status_code == 410:
                raise ValueError("INVALID_DELTA_TOKEN")

            if response.status_code >= 400:
                error_text = response.text
                raise ValueError(f"Graph API error ({response.status_code}): {error_text}")

            if response.status_code == 204:
                return {}

            return response.json()

    async def list_calendars(self, access_token: str) -> List[MicrosoftCalendar]:
        """
        List all calendars accessible to the user.

        Args:
            access_token: Valid Microsoft access token

        Returns:
            List of MicrosoftCalendar objects

        Raises:
            ValueError: If listing calendars fails
        """
        try:
            response = await self._make_graph_request(
                access_token, "GET", "/me/calendars"
            )

            items = response.get("value", [])

            if not items:
                logger.warning("No calendars found in Microsoft Graph response")
                return []

            calendars = [
                MicrosoftCalendar(
                    id=item["id"],
                    name=item.get("name", "Unnamed Calendar"),
                    color=self._map_color(item.get("color")),
                    is_default_calendar=item.get("isDefaultCalendar", False),
                    can_edit=item.get("canEdit", True),
                    owner_name=item.get("owner", {}).get("name", "Unknown"),
                    owner_address=item.get("owner", {}).get("address", ""),
                )
                for item in items
            ]

            logger.info(f"Retrieved {len(calendars)} Microsoft calendars")
            return calendars
        except Exception as e:
            logger.error(f"Failed to list Microsoft calendars: {e}")
            raise ValueError(f"Failed to list Microsoft calendars: {e}")

    async def get_calendar_metadata(
        self, access_token: str, calendar_id: str
    ) -> MicrosoftCalendar:
        """
        Get metadata for a specific calendar.

        Args:
            access_token: Valid Microsoft access token
            calendar_id: Microsoft calendar ID

        Returns:
            MicrosoftCalendar with metadata

        Raises:
            ValueError: If getting metadata fails
        """
        try:
            response = await self._make_graph_request(
                access_token, "GET", f"/me/calendars/{calendar_id}"
            )

            return MicrosoftCalendar(
                id=response["id"],
                name=response.get("name", "Unnamed Calendar"),
                color=self._map_color(response.get("color")),
                is_default_calendar=response.get("isDefaultCalendar", False),
                can_edit=response.get("canEdit", True),
                owner_name=response.get("owner", {}).get("name", "Unknown"),
                owner_address=response.get("owner", {}).get("address", ""),
            )
        except Exception as e:
            logger.error(f"Failed to get Microsoft calendar metadata: {e}")
            raise ValueError(f"Failed to get Microsoft calendar metadata: {e}")

    async def get_events(
        self,
        access_token: str,
        calendar_id: str,
        start_date: datetime,
        end_date: datetime,
        max_results: int = 100,
    ) -> List[MicrosoftEvent]:
        """
        Get events from a calendar within a date range.

        Args:
            access_token: Valid Microsoft access token
            calendar_id: Microsoft calendar ID
            start_date: Start of time range
            end_date: End of time range
            max_results: Maximum results per page

        Returns:
            List of MicrosoftEvent objects

        Raises:
            ValueError: If getting events fails
        """
        try:
            events: List[MicrosoftEvent] = []
            select_fields = [
                "id", "subject", "bodyPreview", "body", "location", "start", "end",
                "isAllDay", "isCancelled", "importance", "showAs", "responseStatus",
                "attendees", "organizer", "categories", "recurrence", "seriesMasterId",
                "type", "webLink", "onlineMeetingUrl", "onlineMeeting", "isOnlineMeeting",
                "onlineMeetingProvider", "createdDateTime", "lastModifiedDateTime",
            ]

            params = {
                "$filter": f"start/dateTime ge '{start_date.isoformat()}' and end/dateTime le '{end_date.isoformat()}'",
                "$select": ",".join(select_fields),
                "$top": str(max_results),
                "$orderby": "start/dateTime",
            }

            endpoint = f"/me/calendars/{calendar_id}/events"
            next_link = None

            while True:
                if next_link:
                    # Use full URL for next page
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            next_link,
                            headers={"Authorization": f"Bearer {access_token}"}
                        )
                        data = response.json()
                else:
                    data = await self._make_graph_request(
                        access_token, "GET", endpoint, params=params
                    )

                for item in data.get("value", []):
                    event = self._parse_event(item)
                    if event:
                        events.append(event)

                next_link = data.get("@odata.nextLink")
                if not next_link:
                    break

            logger.info(f"Retrieved {len(events)} Microsoft events from calendar {calendar_id}")
            return events
        except Exception as e:
            logger.error(f"Failed to get Microsoft calendar events: {e}")
            raise ValueError(f"Failed to get Microsoft calendar events: {e}")

    async def get_delta_events(
        self,
        access_token: str,
        calendar_id: str,
        delta_token: Optional[str] = None,
    ) -> tuple[List[MicrosoftEvent], Optional[str]]:
        """
        Get delta (incremental) changes for calendar events.

        Args:
            access_token: Valid Microsoft access token
            calendar_id: Microsoft calendar ID
            delta_token: Previous delta link (None for initial sync)

        Returns:
            Tuple of (list of events, new delta token)

        Raises:
            ValueError: If getting delta events fails
        """
        try:
            events: List[MicrosoftEvent] = []
            new_delta_link: Optional[str] = None

            if delta_token:
                # Use existing delta link for incremental sync
                logger.debug(f"Using delta token for incremental sync: {calendar_id}")
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        delta_token,
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
                    if response.status_code == 410:
                        raise ValueError("INVALID_DELTA_TOKEN")
                    data = response.json()
            else:
                # Initial delta query
                logger.debug(f"Starting initial delta sync: {calendar_id}")
                select_fields = [
                    "id", "subject", "bodyPreview", "body", "location", "start", "end",
                    "isAllDay", "isCancelled", "importance", "showAs", "responseStatus",
                    "attendees", "organizer", "categories", "recurrence", "seriesMasterId",
                    "type", "webLink", "onlineMeetingUrl", "onlineMeeting", "isOnlineMeeting",
                    "onlineMeetingProvider", "createdDateTime", "lastModifiedDateTime",
                ]
                params = {
                    "$select": ",".join(select_fields),
                    "$top": "100",
                }
                data = await self._make_graph_request(
                    access_token, "GET", f"/me/calendars/{calendar_id}/events/delta",
                    params=params
                )

            # Process events from all pages
            while True:
                for item in data.get("value", []):
                    event = self._parse_event(item)
                    if event:
                        events.append(event)

                if "@odata.nextLink" in data:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            data["@odata.nextLink"],
                            headers={"Authorization": f"Bearer {access_token}"}
                        )
                        data = response.json()
                elif "@odata.deltaLink" in data:
                    new_delta_link = data["@odata.deltaLink"]
                    break
                else:
                    break

            logger.info(f"Delta sync retrieved {len(events)} events from {calendar_id}")
            return events, new_delta_link
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Failed to get delta events: {e}")
            raise ValueError(f"Failed to get delta events: {e}")

    async def create_webhook_subscription(
        self,
        access_token: str,
        calendar_id: str,
        webhook_url: str,
        client_state: Optional[str] = None,
        expiration_minutes: int = 4230,  # ~3 days (max allowed)
    ) -> WebhookSubscription:
        """
        Subscribe to calendar change notifications via webhooks.

        Args:
            access_token: Valid Microsoft access token
            calendar_id: Microsoft calendar ID
            webhook_url: Public HTTPS URL to receive notifications
            client_state: Optional secret for validating notifications
            expiration_minutes: Minutes until expiration (max 4230)

        Returns:
            WebhookSubscription details

        Raises:
            ValueError: If creating subscription fails
        """
        try:
            expiration_datetime = datetime.utcnow() + timedelta(
                minutes=min(expiration_minutes, 4230)
            )

            payload = {
                "changeType": "created,updated,deleted",
                "notificationUrl": webhook_url,
                "resource": f"/me/calendars/{calendar_id}/events",
                "expirationDateTime": expiration_datetime.isoformat() + "Z",
            }
            if client_state:
                payload["clientState"] = client_state

            result = await self._make_graph_request(
                access_token, "POST", "/subscriptions", json_data=payload
            )

            logger.info(f"Created webhook subscription: {result.get('id')}")

            return WebhookSubscription(
                id=result["id"],
                resource=result["resource"],
                change_type=result["changeType"],
                client_state=result.get("clientState"),
                notification_url=result["notificationUrl"],
                expiration_datetime=datetime.fromisoformat(
                    result["expirationDateTime"].replace("Z", "+00:00")
                ),
            )
        except Exception as e:
            logger.error(f"Failed to create webhook subscription: {e}")
            raise ValueError(f"Failed to create webhook subscription: {e}")

    async def renew_subscription(
        self,
        access_token: str,
        subscription_id: str,
        expiration_minutes: int = 4230,
    ) -> WebhookSubscription:
        """
        Renew an existing webhook subscription.

        Args:
            access_token: Valid Microsoft access token
            subscription_id: Subscription ID to renew
            expiration_minutes: Minutes to extend (max 4230)

        Returns:
            Updated WebhookSubscription

        Raises:
            ValueError: If renewal fails
        """
        try:
            expiration_datetime = datetime.utcnow() + timedelta(
                minutes=min(expiration_minutes, 4230)
            )

            result = await self._make_graph_request(
                access_token,
                "PATCH",
                f"/subscriptions/{subscription_id}",
                json_data={"expirationDateTime": expiration_datetime.isoformat() + "Z"},
            )

            logger.info(f"Renewed webhook subscription: {subscription_id}")

            return WebhookSubscription(
                id=result["id"],
                resource=result["resource"],
                change_type=result["changeType"],
                client_state=result.get("clientState"),
                notification_url=result["notificationUrl"],
                expiration_datetime=datetime.fromisoformat(
                    result["expirationDateTime"].replace("Z", "+00:00")
                ),
            )
        except Exception as e:
            if "not found" in str(e).lower():
                raise ValueError("SUBSCRIPTION_NOT_FOUND")
            logger.error(f"Failed to renew webhook subscription: {e}")
            raise ValueError(f"Failed to renew subscription: {e}")

    async def delete_subscription(
        self, access_token: str, subscription_id: str
    ) -> None:
        """
        Delete a webhook subscription.

        Args:
            access_token: Valid Microsoft access token
            subscription_id: Subscription ID to delete
        """
        try:
            await self._make_graph_request(
                access_token, "DELETE", f"/subscriptions/{subscription_id}"
            )
            logger.info(f"Deleted webhook subscription: {subscription_id}")
        except ValueError as e:
            if "not found" in str(e).lower():
                logger.warning(f"Subscription already deleted: {subscription_id}")
                return
            raise

    async def get_user_email(self, access_token: str) -> str:
        """
        Get the email address of the authenticated user.

        Args:
            access_token: Valid Microsoft access token

        Returns:
            User's email address

        Raises:
            ValueError: If getting user info fails
        """
        try:
            result = await self._make_graph_request(
                access_token, "GET", "/me", params={"$select": "mail,userPrincipalName"}
            )
            email = result.get("mail") or result.get("userPrincipalName")
            if not email:
                raise ValueError("No email found in user info")
            return email
        except Exception as e:
            logger.error(f"Failed to get Microsoft user email: {e}")
            raise ValueError(f"Failed to get Microsoft user email: {e}")

    def _parse_event(self, item: dict) -> Optional[MicrosoftEvent]:
        """Parse a Microsoft event from API response"""
        try:
            event_id = item.get("id")
            if not event_id:
                return None

            # Check if event is removed (for delta sync)
            is_removed = "@removed" in item

            # Parse start/end times
            start_data = item.get("start", {})
            end_data = item.get("end", {})
            start_tz = start_data.get("timeZone", "UTC")
            end_tz = end_data.get("timeZone", "UTC")

            start = datetime.fromisoformat(start_data.get("dateTime", "").replace("Z", ""))
            end = datetime.fromisoformat(end_data.get("dateTime", "").replace("Z", ""))

            # Extract Teams meeting info
            teams_enabled = item.get("isOnlineMeeting", False)
            teams_meeting_url = None
            teams_conference_id = None

            if item.get("onlineMeeting"):
                teams_meeting_url = item["onlineMeeting"].get("joinUrl")
                teams_conference_id = item["onlineMeeting"].get("conferenceId")
            elif item.get("onlineMeetingUrl"):
                teams_meeting_url = item["onlineMeetingUrl"]

            # Parse attendees
            attendees = None
            if "attendees" in item:
                attendees = [
                    {
                        "email": att.get("emailAddress", {}).get("address"),
                        "displayName": att.get("emailAddress", {}).get("name"),
                        "responseStatus": att.get("status", {}).get("response"),
                        "type": att.get("type"),
                    }
                    for att in item["attendees"]
                ]

            # Parse organizer
            organizer = None
            if "organizer" in item:
                organizer = {
                    "email": item["organizer"].get("emailAddress", {}).get("address"),
                    "displayName": item["organizer"].get("emailAddress", {}).get("name"),
                }

            return MicrosoftEvent(
                id=event_id,
                subject=item.get("subject", "(No title)"),
                body_preview=item.get("bodyPreview"),
                body_content=item.get("body", {}).get("content"),
                location=item.get("location", {}).get("displayName"),
                start=start,
                end=end,
                start_timezone=start_tz,
                end_timezone=end_tz,
                is_all_day=item.get("isAllDay", False),
                is_cancelled=item.get("isCancelled", False),
                importance=item.get("importance", "normal"),
                status=item.get("showAs", "busy"),
                attendees=attendees,
                organizer=organizer,
                categories=item.get("categories"),
                recurrence=item.get("recurrence"),
                series_master_id=item.get("seriesMasterId"),
                event_type=item.get("type", "singleInstance"),
                web_link=item.get("webLink"),
                teams_enabled=teams_enabled,
                teams_meeting_url=teams_meeting_url,
                teams_conference_id=teams_conference_id,
                created_at=datetime.fromisoformat(
                    item.get("createdDateTime", "").replace("Z", "+00:00")
                ) if item.get("createdDateTime") else datetime.utcnow(),
                modified_at=datetime.fromisoformat(
                    item.get("lastModifiedDateTime", "").replace("Z", "+00:00")
                ) if item.get("lastModifiedDateTime") else datetime.utcnow(),
                is_removed=is_removed,
            )
        except Exception as e:
            logger.warning(f"Failed to parse Microsoft event: {e}")
            return None

    def _map_color(self, color: Optional[str]) -> str:
        """Map Microsoft color name to hex code"""
        return MICROSOFT_COLORS.get(color or "auto", "#1F77B4")

    def convert_recurrence_to_rrule(self, recurrence: Optional[dict]) -> Optional[str]:
        """
        Convert Microsoft recurrence pattern to RFC 5545 RRULE format.

        Args:
            recurrence: Microsoft recurrence object

        Returns:
            RRULE string or None
        """
        if not recurrence:
            return None

        pattern = recurrence.get("pattern", {})
        range_data = recurrence.get("range", {})

        rrule_parts = ["RRULE:"]

        # Frequency mapping
        freq_map = {
            "daily": "FREQ=DAILY",
            "weekly": "FREQ=WEEKLY",
            "absoluteMonthly": "FREQ=MONTHLY",
            "relativeMonthly": "FREQ=MONTHLY",
            "absoluteYearly": "FREQ=YEARLY",
            "relativeYearly": "FREQ=YEARLY",
        }

        pattern_type = pattern.get("type", "daily")
        rrule_parts.append(freq_map.get(pattern_type, "FREQ=DAILY"))

        # Interval
        interval = pattern.get("interval", 1)
        if interval > 1:
            rrule_parts.append(f"INTERVAL={interval}")

        # Days of week (for weekly recurrence)
        days_of_week = pattern.get("daysOfWeek", [])
        if days_of_week:
            days = ",".join(d[:2].upper() for d in days_of_week)
            rrule_parts.append(f"BYDAY={days}")

        # Day of month (for monthly)
        day_of_month = pattern.get("dayOfMonth")
        if day_of_month:
            rrule_parts.append(f"BYMONTHDAY={day_of_month}")

        # Month (for yearly)
        month = pattern.get("month")
        if month:
            rrule_parts.append(f"BYMONTH={month}")

        # End condition
        range_type = range_data.get("type", "noEnd")
        if range_type == "endDate" and range_data.get("endDate"):
            end_date = range_data["endDate"].replace("-", "")
            rrule_parts.append(f"UNTIL={end_date}")
        elif range_type == "numbered" and range_data.get("numberOfOccurrences"):
            rrule_parts.append(f"COUNT={range_data['numberOfOccurrences']}")

        return ";".join(rrule_parts)
