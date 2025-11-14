"""
Rate limiting configuration for API endpoints
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"]  # Default limit for all endpoints
)
