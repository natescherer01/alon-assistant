"""
Authentication dependencies for FastAPI endpoints
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth.utils import decode_access_token
from app.core.encryption import get_encryption_service

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token

    Args:
        token: JWT token from Authorization header
        db: Database session

    Returns:
        User object

    Raises:
        HTTPException: If token is invalid or user not found
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Decode token
    email = decode_access_token(token)
    if email is None:
        raise credentials_exception

    # Generate email hash for lookup (can't search encrypted fields)
    encryption_service = get_encryption_service()
    email_hash = encryption_service.generate_searchable_hash(email)

    # Get user from database (using email_hash)
    user = db.query(User).filter(User.email_hash == email_hash).first()
    if user is None:
        raise credentials_exception

    return user
