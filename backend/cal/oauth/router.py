"""
OAuth Router for Calendar Integration

Handles OAuth 2.0 flows for Google Calendar and Microsoft Outlook.
Includes state management for CSRF protection and session handling
for calendar selection after OAuth callback.
"""
import os
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from database import get_db
from cal.models import (
    CalendarUser, CalendarConnection, OAuthState, CalendarSession,
    CalendarProvider, CalendarAuditLog, AuditStatus,
)
from cal.schemas import (
    OAuthLoginResponse, OAuthSessionResponse, CalendarListItem,
    CalendarSelectRequest, CalendarSelectResponse, CalendarConnectionResponse,
    ErrorResponse,
)
from cal.dependencies import (
    get_calendar_user, encrypt_token, decrypt_token,
    get_client_ip, get_user_agent,
)
from cal.oauth.google import GoogleCalendarClient, get_google_config
from cal.oauth.microsoft import MicrosoftCalendarClient, get_microsoft_config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/oauth", tags=["Calendar OAuth"])

# In-memory session store for OAuth flow (in production, use Redis)
# Format: { session_id: { provider, calendars, tokens, user_id, expires_at } }
_oauth_sessions: dict = {}


def _cleanup_expired_sessions():
    """Remove expired OAuth sessions from memory"""
    now = datetime.utcnow()
    expired = [k for k, v in _oauth_sessions.items() if v.get("expires_at", now) < now]
    for k in expired:
        del _oauth_sessions[k]


def _create_oauth_session(
    user_id: UUID,
    provider: CalendarProvider,
    calendars: list,
    access_token: str,
    refresh_token: str,
    token_expires_at: datetime,
) -> str:
    """Create a temporary OAuth session for calendar selection"""
    _cleanup_expired_sessions()

    session_id = secrets.token_urlsafe(32)
    _oauth_sessions[session_id] = {
        "user_id": str(user_id),
        "provider": provider.value,
        "calendars": calendars,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_expires_at": token_expires_at.isoformat(),
        "expires_at": datetime.utcnow() + timedelta(minutes=15),  # Session valid for 15 min
    }
    return session_id


def _get_oauth_session(session_id: str) -> Optional[dict]:
    """Get OAuth session by ID without consuming it"""
    _cleanup_expired_sessions()
    return _oauth_sessions.get(session_id)


def _consume_oauth_session(session_id: str) -> Optional[dict]:
    """Get and remove OAuth session (one-time use)"""
    _cleanup_expired_sessions()
    return _oauth_sessions.pop(session_id, None)


# =============================================================================
# Google OAuth Endpoints
# =============================================================================

@router.get("/google/login", response_model=OAuthLoginResponse)
async def initiate_google_oauth(
    request: Request,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Initiate Google OAuth flow.

    Returns authorization URL for frontend to redirect user to Google consent screen.
    """
    config = get_google_config()
    if not config.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )

    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state in database
    oauth_state = OAuthState(
        user_id=calendar_user.id,
        provider=CalendarProvider.GOOGLE,
        state=state,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(oauth_state)
    db.commit()

    # Generate auth URL
    client = GoogleCalendarClient(config)
    auth_url = client.get_auth_url(state)

    logger.info(f"Google OAuth initiated for user {calendar_user.id}")

    return OAuthLoginResponse(auth_url=auth_url, state=state)


@router.get("/google/callback")
async def handle_google_callback(
    request: Request,
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    db: Session = Depends(get_db),
):
    """
    Handle Google OAuth callback.

    Exchanges authorization code for tokens, fetches available calendars,
    and redirects to frontend with session ID for calendar selection.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Handle OAuth errors
    if error:
        logger.warning(f"Google OAuth error: {error}")
        return RedirectResponse(url=f"{frontend_url}/calendars?error={error}")

    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/calendars?error=missing_params")

    try:
        # Validate state token
        oauth_state = db.query(OAuthState).filter(
            OAuthState.state == state,
            OAuthState.provider == CalendarProvider.GOOGLE,
            OAuthState.consumed == False,
            OAuthState.expires_at > datetime.utcnow(),
        ).first()

        if not oauth_state:
            logger.warning("Invalid or expired OAuth state")
            return RedirectResponse(url=f"{frontend_url}/calendars?error=invalid_state")

        # Mark state as consumed
        oauth_state.consumed = True
        db.commit()

        # Exchange code for tokens
        client = GoogleCalendarClient()
        tokens = await client.get_tokens(code)

        # Fetch available calendars
        calendars = await client.list_calendars(tokens.access_token)

        # Create session for calendar selection
        calendar_list = [
            {
                "id": cal.id,
                "name": cal.name,
                "color": cal.background_color,
                "isPrimary": cal.is_primary,
            }
            for cal in calendars
        ]

        session_id = _create_oauth_session(
            user_id=oauth_state.user_id,
            provider=CalendarProvider.GOOGLE,
            calendars=calendar_list,
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_expires_at=tokens.expires_at,
        )

        # Log success
        audit_log = CalendarAuditLog(
            user_id=oauth_state.user_id,
            action="google_oauth_success",
            resource_type="oauth",
            status=AuditStatus.SUCCESS,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        db.add(audit_log)
        db.commit()

        logger.info(f"Google OAuth successful for user {oauth_state.user_id}")

        # Redirect to frontend with session ID
        return RedirectResponse(
            url=f"{frontend_url}/oauth/google/callback?provider=google&session={session_id}"
        )

    except Exception as e:
        logger.error(f"Google OAuth callback failed: {e}")
        return RedirectResponse(url=f"{frontend_url}/calendars?error=auth_failed")


@router.post("/google/select", response_model=CalendarSelectResponse)
async def select_google_calendars(
    request: Request,
    body: CalendarSelectRequest,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Select Google calendars to connect.

    Consumes the OAuth session and creates calendar connections for
    the selected calendars.
    """
    # Get and consume OAuth session
    session = _consume_oauth_session(body.code)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or expired. Please re-authenticate.",
        )

    # Verify session belongs to this user
    if session["user_id"] != str(calendar_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to this user",
        )

    # Verify provider
    if session["provider"] != CalendarProvider.GOOGLE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid provider for this endpoint",
        )

    # Get tokens and encrypt for storage
    access_token = encrypt_token(session["access_token"])
    refresh_token = encrypt_token(session["refresh_token"])
    token_expires_at = datetime.fromisoformat(session["token_expires_at"])

    # Create calendar connections for selected calendars
    connected = []
    available_calendars = {cal["id"]: cal for cal in session["calendars"]}

    for cal_id in body.selected_calendar_ids:
        if cal_id not in available_calendars:
            continue

        cal_info = available_calendars[cal_id]

        # Check if connection already exists
        existing = db.query(CalendarConnection).filter(
            CalendarConnection.user_id == calendar_user.id,
            CalendarConnection.provider == CalendarProvider.GOOGLE,
            CalendarConnection.calendar_id == cal_id,
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = token_expires_at
            existing.is_connected = True
            existing.deleted_at = None
            existing.updated_at = datetime.utcnow()
            connection = existing
        else:
            # Create new connection
            connection = CalendarConnection(
                user_id=calendar_user.id,
                provider=CalendarProvider.GOOGLE,
                calendar_id=cal_id,
                calendar_name=cal_info["name"],
                calendar_color=cal_info.get("color"),
                is_primary=cal_info.get("isPrimary", False),
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=token_expires_at,
                is_connected=True,
            )
            db.add(connection)

        db.flush()
        connected.append(connection)

    db.commit()

    # Log success
    audit_log = CalendarAuditLog(
        user_id=calendar_user.id,
        action="google_calendars_connected",
        resource_type="calendar_connection",
        status=AuditStatus.SUCCESS,
        metadata={"count": len(connected)},
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    db.add(audit_log)
    db.commit()

    logger.info(f"Connected {len(connected)} Google calendars for user {calendar_user.id}")

    return CalendarSelectResponse(
        success=True,
        connected_count=len(connected),
        calendars=[
            CalendarConnectionResponse(
                id=c.id,
                provider=c.provider,
                calendar_id=c.calendar_id,
                calendar_name=c.calendar_name,
                calendar_color=c.calendar_color,
                is_primary=c.is_primary,
                is_connected=c.is_connected,
                is_read_only=c.is_read_only,
                last_synced_at=c.last_synced_at,
                created_at=c.created_at,
            )
            for c in connected
        ],
    )


# =============================================================================
# Microsoft OAuth Endpoints
# =============================================================================

@router.get("/microsoft/login", response_model=OAuthLoginResponse)
async def initiate_microsoft_oauth(
    request: Request,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Initiate Microsoft OAuth flow.

    Returns authorization URL for frontend to redirect user to Microsoft consent screen.
    """
    config = get_microsoft_config()
    if not config.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Microsoft OAuth is not configured",
        )

    # Generate state token for CSRF protection
    state = secrets.token_urlsafe(32)

    # Store state in database
    oauth_state = OAuthState(
        user_id=calendar_user.id,
        provider=CalendarProvider.MICROSOFT,
        state=state,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(oauth_state)
    db.commit()

    # Generate auth URL
    client = MicrosoftCalendarClient(config)
    auth_url = await client.get_auth_url(state)

    logger.info(f"Microsoft OAuth initiated for user {calendar_user.id}")

    return OAuthLoginResponse(auth_url=auth_url, state=state)


@router.get("/microsoft/callback")
async def handle_microsoft_callback(
    request: Request,
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    db: Session = Depends(get_db),
):
    """
    Handle Microsoft OAuth callback.

    Exchanges authorization code for tokens, fetches available calendars,
    and redirects to frontend with session ID for calendar selection.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Handle OAuth errors
    if error:
        logger.warning(f"Microsoft OAuth error: {error}")
        return RedirectResponse(url=f"{frontend_url}/calendars?error={error}")

    if not code or not state:
        return RedirectResponse(url=f"{frontend_url}/calendars?error=missing_params")

    try:
        # Validate state token
        oauth_state = db.query(OAuthState).filter(
            OAuthState.state == state,
            OAuthState.provider == CalendarProvider.MICROSOFT,
            OAuthState.consumed == False,
            OAuthState.expires_at > datetime.utcnow(),
        ).first()

        if not oauth_state:
            logger.warning("Invalid or expired OAuth state")
            return RedirectResponse(url=f"{frontend_url}/calendars?error=invalid_state")

        # Mark state as consumed
        oauth_state.consumed = True
        db.commit()

        # Exchange code for tokens
        client = MicrosoftCalendarClient()
        tokens = await client.get_tokens(code)

        # Fetch available calendars
        calendars = await client.list_calendars(tokens.access_token)

        # Create session for calendar selection
        calendar_list = [
            {
                "id": cal.id,
                "name": cal.name,
                "color": cal.color,
                "isPrimary": cal.is_default_calendar,
                "canEdit": cal.can_edit,
            }
            for cal in calendars
        ]

        session_id = _create_oauth_session(
            user_id=oauth_state.user_id,
            provider=CalendarProvider.MICROSOFT,
            calendars=calendar_list,
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            token_expires_at=tokens.expires_at,
        )

        # Log success
        audit_log = CalendarAuditLog(
            user_id=oauth_state.user_id,
            action="microsoft_oauth_success",
            resource_type="oauth",
            status=AuditStatus.SUCCESS,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
        )
        db.add(audit_log)
        db.commit()

        logger.info(f"Microsoft OAuth successful for user {oauth_state.user_id}")

        # Redirect to frontend with session ID
        return RedirectResponse(
            url=f"{frontend_url}/oauth/microsoft/callback?provider=microsoft&session={session_id}"
        )

    except Exception as e:
        logger.error(f"Microsoft OAuth callback failed: {e}")
        return RedirectResponse(url=f"{frontend_url}/calendars?error=auth_failed")


@router.post("/microsoft/select", response_model=CalendarSelectResponse)
async def select_microsoft_calendars(
    request: Request,
    body: CalendarSelectRequest,
    calendar_user: CalendarUser = Depends(get_calendar_user),
    db: Session = Depends(get_db),
):
    """
    Select Microsoft calendars to connect.

    Consumes the OAuth session and creates calendar connections for
    the selected calendars.
    """
    # Get and consume OAuth session
    session = _consume_oauth_session(body.code)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or expired. Please re-authenticate.",
        )

    # Verify session belongs to this user
    if session["user_id"] != str(calendar_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to this user",
        )

    # Verify provider
    if session["provider"] != CalendarProvider.MICROSOFT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid provider for this endpoint",
        )

    # Get tokens and encrypt for storage
    access_token = encrypt_token(session["access_token"])
    refresh_token = encrypt_token(session["refresh_token"])
    token_expires_at = datetime.fromisoformat(session["token_expires_at"])

    # Create calendar connections for selected calendars
    connected = []
    available_calendars = {cal["id"]: cal for cal in session["calendars"]}

    for cal_id in body.selected_calendar_ids:
        if cal_id not in available_calendars:
            continue

        cal_info = available_calendars[cal_id]

        # Check if connection already exists
        existing = db.query(CalendarConnection).filter(
            CalendarConnection.user_id == calendar_user.id,
            CalendarConnection.provider == CalendarProvider.MICROSOFT,
            CalendarConnection.calendar_id == cal_id,
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = token_expires_at
            existing.is_connected = True
            existing.deleted_at = None
            existing.updated_at = datetime.utcnow()
            connection = existing
        else:
            # Create new connection
            connection = CalendarConnection(
                user_id=calendar_user.id,
                provider=CalendarProvider.MICROSOFT,
                calendar_id=cal_id,
                calendar_name=cal_info["name"],
                calendar_color=cal_info.get("color"),
                is_primary=cal_info.get("isPrimary", False),
                is_read_only=not cal_info.get("canEdit", True),
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=token_expires_at,
                is_connected=True,
            )
            db.add(connection)

        db.flush()
        connected.append(connection)

    db.commit()

    # Log success
    audit_log = CalendarAuditLog(
        user_id=calendar_user.id,
        action="microsoft_calendars_connected",
        resource_type="calendar_connection",
        status=AuditStatus.SUCCESS,
        metadata={"count": len(connected)},
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    db.add(audit_log)
    db.commit()

    logger.info(f"Connected {len(connected)} Microsoft calendars for user {calendar_user.id}")

    return CalendarSelectResponse(
        success=True,
        connected_count=len(connected),
        calendars=[
            CalendarConnectionResponse(
                id=c.id,
                provider=c.provider,
                calendar_id=c.calendar_id,
                calendar_name=c.calendar_name,
                calendar_color=c.calendar_color,
                is_primary=c.is_primary,
                is_connected=c.is_connected,
                is_read_only=c.is_read_only,
                last_synced_at=c.last_synced_at,
                created_at=c.created_at,
            )
            for c in connected
        ],
    )


# =============================================================================
# Session Endpoint
# =============================================================================

@router.get("/session/{session_id}", response_model=OAuthSessionResponse)
async def get_oauth_session(
    session_id: str,
    calendar_user: CalendarUser = Depends(get_calendar_user),
):
    """
    Get OAuth session data for calendar selection.

    This endpoint peeks at the session without consuming it.
    The session is consumed when calendars are selected.
    """
    session = _get_oauth_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or expired. Please re-authenticate.",
        )

    # Verify session belongs to this user
    if session["user_id"] != str(calendar_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session does not belong to this user",
        )

    return OAuthSessionResponse(
        provider=CalendarProvider(session["provider"]),
        calendars=[
            CalendarListItem(
                id=cal["id"],
                name=cal["name"],
                color=cal.get("color"),
                is_primary=cal.get("isPrimary", False),
                is_selected=False,
            )
            for cal in session["calendars"]
        ],
        user_email=calendar_user.email,
        expires_at=session["expires_at"],
    )
