"""
Account security functions: lockout, failed attempts tracking
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import User
import logging

logger = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30

def is_account_locked(user: User) -> bool:
    """Check if account is currently locked"""
    if not user.locked_until:
        return False

    # Check if lockout period has expired
    if datetime.utcnow() >= user.locked_until:
        return False

    return True

def get_lockout_time_remaining(user: User) -> int:
    """Get remaining lockout time in seconds"""
    if not user.locked_until:
        return 0

    remaining = (user.locked_until - datetime.utcnow()).total_seconds()
    return max(0, int(remaining))

def record_failed_login(db: Session, user: User) -> int:
    """
    Record failed login attempt and lock account if threshold exceeded.

    Returns:
        Number of failed attempts
    """
    user.failed_login_attempts += 1
    user.last_failed_login = datetime.utcnow()

    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        logger.warning(
            f"Account locked due to {user.failed_login_attempts} failed attempts: {user.email}"
        )

    db.commit()
    return user.failed_login_attempts

def reset_failed_attempts(db: Session, user: User):
    """Reset failed login attempts on successful login"""
    user.failed_login_attempts = 0
    user.last_failed_login = None
    user.locked_until = None
    db.commit()
