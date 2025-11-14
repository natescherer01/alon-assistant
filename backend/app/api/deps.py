"""
API Dependencies

Provides:
- Database session management
- Authentication
- Cache ownership validation
- Optimistic locking validation
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

# Import from existing modules
from database import get_db as _get_db
from auth.dependencies import get_current_user


# Re-export get_db
def get_db():
    """Get database session"""
    return _get_db()


async def get_current_user_id(user = Depends(get_current_user)) -> str:
    """
    Get current user ID from authenticated user

    Args:
        user: Current authenticated user

    Returns:
        User ID as string
    """
    return str(user.id)


def validate_cache_ownership(resource_user_id: str, current_user_id: str) -> None:
    """
    Validate that cached data belongs to requesting user

    Prevents cache poisoning attack where user A could access user B's cached data.

    Args:
        resource_user_id: User ID who owns the resource
        current_user_id: User ID making the request

    Raises:
        HTTPException 403: If user doesn't own the resource
    """
    if resource_user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Resource does not belong to current user"
        )


def require_etag_match(if_match: Optional[str], current_etag: str) -> None:
    """
    Require If-Match header for optimistic locking

    Prevents race conditions when updating resources by ensuring client has latest version.

    Args:
        if_match: If-Match header value from request
        current_etag: Current ETag of the resource

    Raises:
        HTTPException 428: If If-Match header is missing
        HTTPException 412: If ETag doesn't match (resource was modified)
    """
    if not if_match:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="If-Match header required for update operations"
        )

    # Clean up ETags for comparison
    if_match_clean = if_match.strip().strip('"')
    current_etag_clean = current_etag.strip().strip('"')

    # Handle weak ETags
    if if_match_clean.startswith('W/'):
        if_match_clean = if_match_clean[2:].strip('"')
    if current_etag_clean.startswith('W/'):
        current_etag_clean = current_etag_clean[2:].strip('"')

    if if_match_clean != current_etag_clean:
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail="Resource was modified. Please refetch and try again."
        )
