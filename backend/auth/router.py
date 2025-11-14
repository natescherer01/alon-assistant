"""
Authentication API routes: signup, login
Production-hardened with OWASP security best practices
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin, UserResponse, Token, RefreshTokenRequest, UserUpdate
from auth.utils import (
    verify_password, get_password_hash, create_token_pair,
    decode_refresh_token, revoke_token, revoke_all_user_tokens,
    create_access_token
)
from auth.dependencies import get_current_user
from auth.account_lockout import (
    is_account_locked, increment_failed_attempts,
    reset_failed_attempts, get_lockout_time_remaining
)
from auth.security_logging import SecurityEvent, get_client_ip, get_user_agent
from rate_limit import limiter
from logger import get_logger
from app.core.encryption import get_encryption_service

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = get_logger(__name__)


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/hour")  # Max 3 signups per hour per IP
async def signup(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user account and return authentication tokens

    Args:
        user_data: User registration data (email, password, full_name)
        db: Database session

    Returns:
        JWT access and refresh tokens

    Raises:
        HTTPException: If email already exists
    """
    # Generate email hash for lookup (can't search encrypted fields)
    encryption_service = get_encryption_service()
    email_hash = encryption_service.generate_searchable_hash(user_data.email)

    # Check if user already exists (using email_hash)
    existing_user = db.query(User).filter(User.email_hash == email_hash).first()
    if existing_user:
        logger.warning(f"Signup attempt with existing email: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash password
    hashed_password = get_password_hash(user_data.password)

    # Create new user
    new_user = User(
        password_hash=hashed_password,
        full_name=user_data.full_name
    )
    # Set email and generate email_hash for searchable lookups (must be done before adding to session)
    new_user.set_email(user_data.email)

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"New user created: {new_user.email} (ID: {new_user.id})")

    # Create token pair (access + refresh) and return immediately
    tokens = create_token_pair(new_user.email)
    return tokens


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # Max 5 login attempts per minute per IP
async def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login and receive JWT access and refresh tokens

    Security features:
    - Account lockout after 5 failed attempts (30 min lock)
    - Security event logging
    - Rate limiting (per-IP)

    Args:
        credentials: Login credentials (email, password)
        db: Database session

    Returns:
        JWT access token (1 hour) and refresh token (30 days)

    Raises:
        HTTPException: If credentials are invalid or account is locked
    """
    client_ip = get_client_ip(request)
    user_agent = get_user_agent(request)

    # Generate email hash for lookup (can't search encrypted fields)
    encryption_service = get_encryption_service()
    email_hash = encryption_service.generate_searchable_hash(credentials.email)

    # Find user by email_hash
    user = db.query(User).filter(User.email_hash == email_hash).first()
    if not user:
        # Log failed attempt (don't reveal that user doesn't exist)
        SecurityEvent.log_authentication_attempt(
            email=credentials.email,
            ip_address=client_ip,
            user_agent=user_agent,
            success=False,
            failure_reason="Invalid credentials"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if account is locked
    if is_account_locked(user):
        remaining_seconds = get_lockout_time_remaining(user)
        remaining_minutes = remaining_seconds // 60

        SecurityEvent.log_authentication_attempt(
            email=credentials.email,
            ip_address=client_ip,
            user_agent=user_agent,
            success=False,
            failure_reason=f"Account locked ({remaining_minutes}m remaining)"
        )

        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is locked due to multiple failed login attempts. "
                   f"Please try again in {remaining_minutes} minutes.",
            headers={"Retry-After": str(remaining_seconds)},
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        # Increment failed attempts and potentially lock account
        attempts = increment_failed_attempts(db, user)

        # Log failed attempt
        SecurityEvent.log_authentication_attempt(
            email=credentials.email,
            ip_address=client_ip,
            user_agent=user_agent,
            success=False,
            failure_reason="Invalid password"
        )

        # Check if account was just locked
        if is_account_locked(user):
            SecurityEvent.log_account_locked(
                email=user.email,
                ip_address=client_ip,
                failed_attempts=attempts,
                locked_until=user.locked_until
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Password correct - reset failed attempts
    reset_failed_attempts(db, user)

    # Create token pair (access + refresh)
    tokens = create_token_pair(user.email)

    # Log successful authentication
    SecurityEvent.log_authentication_attempt(
        email=user.email,
        ip_address=client_ip,
        user_agent=user_agent,
        success=True
    )

    logger.info(f"Successful login: {user.email}")

    return tokens


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information

    Args:
        current_user: Authenticated user from token

    Returns:
        User object
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
@limiter.limit("10/minute")
async def update_current_user(
    request: Request,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user profile

    Args:
        user_update: User update data (full_name, timezone)
        current_user: Authenticated user from token
        db: Database session

    Returns:
        Updated user object
    """
    # Update fields if provided
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name

    if user_update.timezone is not None:
        current_user.timezone = user_update.timezone

    db.commit()
    db.refresh(current_user)

    logger.info(f"User profile updated: {current_user.email}")

    return current_user


@router.post("/refresh", response_model=Token)
@limiter.limit("10/minute")  # Max 10 token refreshes per minute
async def refresh_access_token(
    request: Request,
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token

    Args:
        refresh_data: Refresh token request containing refresh_token
        db: Database session

    Returns:
        New access token and same refresh token

    Raises:
        HTTPException: If refresh token is invalid or expired
    """
    # Decode and validate refresh token
    email = decode_refresh_token(refresh_data.refresh_token)

    if not email:
        logger.warning("Invalid or expired refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Generate email hash for lookup (can't search encrypted fields)
    encryption_service = get_encryption_service()
    email_hash = encryption_service.generate_searchable_hash(email)

    # Verify user still exists (using email_hash)
    user = db.query(User).filter(User.email_hash == email_hash).first()
    if not user:
        logger.warning(f"Refresh token used for non-existent user: {email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create new access token (refresh token stays the same)
    access_token = create_access_token(data={"sub": user.email})

    logger.info(f"Token refreshed for user: {user.email}")

    return {
        "access_token": access_token,
        "refresh_token": refresh_data.refresh_token,  # Return same refresh token
        "token_type": "bearer"
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    authorization: str = Header(None)
):
    """
    Logout and revoke current access token

    Extracts the token from Authorization header and adds it to blacklist

    Args:
        current_user: Authenticated user
        authorization: Authorization header containing Bearer token

    Returns:
        204 No Content
    """
    # Extract token from Authorization header
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")

        # Revoke the token
        revoked = revoke_token(token, token_type="access")

        if revoked:
            logger.info(f"User logged out and token revoked: {current_user.email}")
        else:
            logger.warning(f"Failed to revoke token on logout for user: {current_user.email}")

    return None


@router.post("/revoke-all", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")  # Max 3 full revocations per hour
async def revoke_all_tokens(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Revoke all tokens for current user (useful after password change or security breach)

    Args:
        current_user: Authenticated user

    Returns:
        204 No Content
    """
    revoked = revoke_all_user_tokens(current_user.email)

    if revoked:
        logger.info(f"All tokens revoked for user: {current_user.email}")
    else:
        logger.warning(f"Failed to revoke all tokens for user: {current_user.email}")

    return None


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/hour")  # Max 3 delete attempts per hour
async def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete current user account and all associated data

    This will permanently delete:
    - User account
    - All tasks
    - All chat history
    - All tokens

    Args:
        current_user: Authenticated user
        db: Database session

    Returns:
        204 No Content
    """
    user_email = current_user.email
    user_id = current_user.id
    client_ip = get_client_ip(request)

    # Log account deletion for security audit
    SecurityEvent.log_account_deletion(
        user_id=user_id,
        email=user_email,
        ip_address=client_ip
    )

    # Revoke all tokens for this user
    revoke_all_user_tokens(user_email)

    # Delete all user data (cascade delete should handle tasks and chat messages)
    db.delete(current_user)
    db.commit()

    logger.info(f"User account deleted: {user_email} (ID: {user_id})")

    return None
