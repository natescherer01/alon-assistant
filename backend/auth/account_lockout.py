"""
Account lockout mechanism for brute force protection

Implements progressive lockout based on failed login attempts
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import User
from logger import get_logger

logger = get_logger(__name__)

# Lockout configuration
MAX_FAILED_ATTEMPTS = 5  # Lock after 5 failed attempts
LOCKOUT_DURATION_MINUTES = 30  # Lock for 30 minutes


def is_account_locked(user: User) -> bool:
    """
    Check if user account is currently locked

    Args:
        user: User model instance

    Returns:
        True if account is locked, False otherwise
    """
    if not user.locked_until:
        return False

    # Check if lockout period has expired
    if user.locked_until > datetime.utcnow():
        return True

    # Lockout expired, clear it
    return False


def get_lockout_time_remaining(user: User) -> int:
    """
    Get remaining lockout time in seconds

    Args:
        user: User model instance

    Returns:
        Seconds remaining, or 0 if not locked
    """
    if not user.locked_until:
        return 0

    remaining = (user.locked_until - datetime.utcnow()).total_seconds()
    return max(0, int(remaining))


def increment_failed_attempts(db: Session, user: User) -> int:
    """
    Increment failed login attempts and lock account if threshold reached

    Args:
        db: Database session
        user: User model instance

    Returns:
        Current number of failed attempts
    """
    user.failed_login_attempts += 1
    user.last_failed_login = datetime.utcnow()

    # Lock account if threshold reached
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        logger.warning(
            f"Account locked for user {user.email} after {user.failed_login_attempts} failed attempts"
        )

    db.commit()
    db.refresh(user)

    return user.failed_login_attempts


def reset_failed_attempts(db: Session, user: User):
    """
    Reset failed login attempts after successful login

    Args:
        db: Database session
        user: User model instance
    """
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_failed_login = None
    user.last_successful_login = datetime.utcnow()

    db.commit()


def unlock_account_manually(db: Session, user: User):
    """
    Manually unlock an account (admin function)

    Args:
        db: Database session
        user: User model instance
    """
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_failed_login = None

    db.commit()

    logger.info(f"Account manually unlocked for user {user.email}")
