"""
Authentication utilities: JWT tokens and password hashing
"""
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict
from jose import JWTError, jwt
from config import get_settings
from auth.token_blacklist import get_token_blacklist
from logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a bcrypt hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Bcrypt hash to verify against

    Returns:
        True if password matches, False otherwise
    """
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Hash password using bcrypt with 12 rounds.

    Args:
        password: Plain text password to hash

    Returns:
        Bcrypt hash string

    Raises:
        ValueError: If password exceeds 72 bytes after UTF-8 encoding

    Note:
        bcrypt has a 72-byte limit. Passwords exceeding this are rejected
        to prevent truncation-based authentication bypass attacks.
    """
    password_bytes = password.encode('utf-8')

    # Enforce bcrypt's 72-byte limit
    if len(password_bytes) > 72:
        raise ValueError(
            "Password exceeds maximum length of 72 bytes. "
            "Please use a shorter password."
        )

    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token (short-lived)

    Args:
        data: Dictionary to encode in the token (typically {"sub": user_email})
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({
        "exp": expire,
        "type": "access"
    })
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """
    Create JWT refresh token (long-lived)

    Args:
        data: Dictionary to encode in the token (typically {"sub": user_email})

    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)

    to_encode.update({
        "exp": expire,
        "type": "refresh"
    })
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    return encoded_jwt


def create_token_pair(user_email: str) -> Dict[str, str]:
    """
    Create both access and refresh tokens

    Args:
        user_email: User's email address

    Returns:
        Dictionary with access_token, refresh_token, and expires_in
    """
    access_token = create_access_token(data={"sub": user_email})
    refresh_token = create_refresh_token(data={"sub": user_email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60  # Convert to seconds
    }


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode JWT token and extract user email

    Args:
        token: JWT token string

    Returns:
        User email if valid, None otherwise
    """
    try:
        # Check if token is blacklisted
        blacklist = get_token_blacklist()
        if blacklist.is_token_revoked(token):
            logger.warning("Attempted use of revoked token")
            return None

        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])

        # Verify token type
        token_type = payload.get("type")
        if token_type != "access":
            logger.warning(f"Invalid token type: {token_type}")
            return None

        email: str = payload.get("sub")

        # Check if user is blacklisted
        if email and blacklist.is_user_blacklisted(email):
            logger.warning(f"Attempted use of token for blacklisted user: {email}")
            return None

        return email
    except JWTError as e:
        logger.debug(f"JWT decode error: {e}")
        return None


def decode_refresh_token(token: str) -> Optional[str]:
    """
    Decode JWT refresh token and extract user email

    Args:
        token: JWT refresh token string

    Returns:
        User email if valid, None otherwise
    """
    try:
        # Check if token is blacklisted
        blacklist = get_token_blacklist()
        if blacklist.is_token_revoked(token):
            logger.warning("Attempted use of revoked refresh token")
            return None

        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])

        # Verify token type
        token_type = payload.get("type")
        if token_type != "refresh":
            logger.warning(f"Invalid token type for refresh: {token_type}")
            return None

        email: str = payload.get("sub")

        # Check if user is blacklisted
        if email and blacklist.is_user_blacklisted(email):
            logger.warning(f"Attempted refresh for blacklisted user: {email}")
            return None

        return email
    except JWTError as e:
        logger.debug(f"Refresh token decode error: {e}")
        return None


def revoke_token(token: str, token_type: str = "access") -> bool:
    """
    Revoke a specific token

    Args:
        token: JWT token to revoke
        token_type: Type of token ("access" or "refresh")

    Returns:
        True if successfully revoked, False otherwise
    """
    blacklist = get_token_blacklist()

    # Determine expiration time based on token type
    expires_in_minutes = settings.access_token_expire_minutes
    if token_type == "refresh":
        expires_in_minutes = settings.refresh_token_expire_days * 24 * 60

    return blacklist.revoke_token(token, expires_in_minutes)


def revoke_all_user_tokens(user_email: str) -> bool:
    """
    Revoke all tokens for a user (e.g., on password change)

    Args:
        user_email: User's email address

    Returns:
        True if successfully revoked, False otherwise
    """
    blacklist = get_token_blacklist()
    return blacklist.revoke_all_user_tokens(user_email)
