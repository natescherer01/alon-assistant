"""
Rate limiting configuration using slowapi

Protects against:
- Brute force attacks on authentication
- API abuse and DoS
- Cost explosion from excessive API calls
"""
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, Response
from logger import get_logger

logger = get_logger(__name__)


def get_remote_address_with_logging(request: Request) -> str:
    """
    Get client's IP address and log rate limit attempts

    Args:
        request: FastAPI request object

    Returns:
        Client IP address
    """
    ip = get_remote_address(request)
    return ip


# Create limiter instance
limiter = Limiter(
    key_func=get_remote_address_with_logging,
    default_limits=["100/minute"],  # Global default
    storage_uri="memory://",  # Use in-memory storage (for production, use Redis)
)


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Custom handler for rate limit exceeded errors

    Args:
        request: FastAPI request
        exc: Rate limit exception

    Returns:
        JSON error response
    """
    ip = get_remote_address(request)
    logger.warning(
        f"Rate limit exceeded for {request.method} {request.url.path} from {ip}"
    )

    return _rate_limit_exceeded_handler(request, exc)


def setup_rate_limiting(app):
    """
    Configure rate limiting for FastAPI app

    Args:
        app: FastAPI application instance
    """
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    logger.info("✓ Rate limiting configured")
    return limiter
