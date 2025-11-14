"""
Rate Limiting Middleware

Implements rate limiting to prevent DoS attacks:
- Per-user rate limits (authenticated endpoints)
- Per-IP rate limits (unauthenticated endpoints)
- Configurable limits per minute/hour
- Returns 429 Too Many Requests when exceeded
"""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from typing import Callable
import logging

logger = logging.getLogger(__name__)


def get_user_identifier(request: Request) -> str:
    """
    Get unique identifier for rate limiting

    Uses user ID if authenticated, otherwise falls back to IP address
    """
    # Try to get user ID from request state (set by auth dependency)
    user_id = getattr(request.state, "user_id", None)

    if user_id:
        return f"user:{user_id}"

    # Fall back to IP address for unauthenticated requests
    return f"ip:{get_remote_address(request)}"


# Create limiter instance
limiter = Limiter(
    key_func=get_user_identifier,
    default_limits=["60/minute", "1000/hour"],
    storage_uri="memory://",  # Use in-memory storage (upgrade to Redis for production)
    strategy="fixed-window",
    headers_enabled=True,  # Include X-RateLimit-* headers in response
)


# Custom rate limit exceeded handler
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """
    Handle rate limit exceeded errors

    Returns 429 with informative error message and Retry-After header
    """
    identifier = get_user_identifier(request)
    logger.warning(
        f"Rate limit exceeded for {identifier} on {request.method} {request.url.path}"
    )

    return _rate_limit_exceeded_handler(request, exc)
