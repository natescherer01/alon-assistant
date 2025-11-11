"""
Authentication API routes: signup, login
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin, UserResponse, Token, RefreshTokenRequest
from auth.utils import (
    verify_password, get_password_hash, create_token_pair,
    decode_refresh_token, revoke_token, revoke_all_user_tokens,
    create_access_token
)
from auth.dependencies import get_current_user
from rate_limit import limiter
from logger import get_logger

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
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        logger.warning(f"Signup attempt with existing email: {user_data.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Validate and hash password
    try:
        hashed_password = get_password_hash(user_data.password)
    except ValueError as e:
        logger.warning(f"Password validation failed during signup: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    # Create new user
    new_user = User(
        email=user_data.email,
        password_hash=hashed_password,
        full_name=user_data.full_name
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"New user created: {new_user.email} (ID: {new_user.id})")

    # Create token pair (access + refresh) and return immediately
    tokens = create_token_pair(new_user.email)
    return tokens


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")  # Max 5 login attempts per minute
async def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login and receive JWT access and refresh tokens

    Args:
        credentials: Login credentials (email, password)
        db: Database session

    Returns:
        JWT access token (1 hour) and refresh token (30 days)

    Raises:
        HTTPException: If credentials are invalid
    """
    # Find user
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        logger.warning(f"Login attempt with non-existent email: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.password_hash):
        logger.warning(f"Failed login attempt for user: {credentials.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create token pair (access + refresh)
    tokens = create_token_pair(user.email)

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

    # Verify user still exists
    user = db.query(User).filter(User.email == email).first()
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

    # Revoke all tokens for this user
    revoke_all_user_tokens(user_email)

    # Delete all user data (cascade delete should handle tasks and chat messages)
    db.delete(current_user)
    db.commit()

    logger.info(f"User account deleted: {user_email} (ID: {user_id})")

    return None
