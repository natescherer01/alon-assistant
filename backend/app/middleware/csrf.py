"""
CSRF Protection Middleware

Implements CSRF (Cross-Site Request Forgery) protection:
- Double-submit cookie pattern
- Token validation for state-changing requests (POST, PUT, PATCH, DELETE)
- Exempts GET, HEAD, OPTIONS requests
- Uses itsdangerous for secure token generation
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from typing import Callable
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
import secrets
import logging
import os

logger = logging.getLogger(__name__)


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection using double-submit cookie pattern

    How it works:
    1. Client requests CSRF token from /api/v1/csrf-token endpoint
    2. Server sets CSRF cookie and returns token in response body
    3. Client includes token in X-CSRF-Token header for state-changing requests
    4. Server validates token matches cookie
    """

    # Methods that require CSRF protection
    PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    # Paths that are exempt from CSRF protection
    EXEMPT_PATHS = {
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/v1/auth/login",  # Login creates the CSRF token
        "/api/v1/csrf-token",  # CSRF token endpoint itself
    }

    def __init__(self, app, secret_key: str, token_expiry: int = 3600):
        """
        Initialize CSRF protection

        Args:
            app: FastAPI application
            secret_key: Secret key for signing tokens
            token_expiry: Token expiry in seconds (default: 1 hour)
        """
        super().__init__(app)
        self.serializer = URLSafeTimedSerializer(secret_key, salt="csrf")
        self.token_expiry = token_expiry

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with CSRF validation"""

        # Skip CSRF check for safe methods
        if request.method not in self.PROTECTED_METHODS:
            return await call_next(request)

        # Skip CSRF check for exempt paths
        if request.url.path in self.EXEMPT_PATHS:
            return await call_next(request)

        # Validate CSRF token
        if not self._validate_csrf_token(request):
            logger.warning(
                f"CSRF validation failed for {request.method} {request.url.path} "
                f"from {request.client.host if request.client else 'unknown'}"
            )
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "CSRF token validation failed",
                    "type": "csrf_error"
                }
            )

        # CSRF validation passed, process request
        response = await call_next(request)
        return response

    def _validate_csrf_token(self, request: Request) -> bool:
        """
        Validate CSRF token from header matches cookie

        Returns:
            True if valid, False otherwise
        """
        # Get token from header
        header_token = request.headers.get("X-CSRF-Token")
        if not header_token:
            logger.debug("No X-CSRF-Token header found")
            return False

        # Get token from cookie
        cookie_token = request.cookies.get("csrf_token")
        if not cookie_token:
            logger.debug("No csrf_token cookie found")
            return False

        # Verify both tokens are valid and match
        try:
            # Verify header token signature and expiry
            header_data = self.serializer.loads(
                header_token,
                max_age=self.token_expiry
            )

            # Verify cookie token signature and expiry
            cookie_data = self.serializer.loads(
                cookie_token,
                max_age=self.token_expiry
            )

            # Tokens must match
            if header_data != cookie_data:
                logger.debug("CSRF tokens do not match")
                return False

            return True

        except SignatureExpired:
            logger.debug("CSRF token expired")
            return False
        except BadSignature:
            logger.debug("CSRF token signature invalid")
            return False
        except Exception as e:
            logger.error(f"CSRF validation error: {e}")
            return False

    def generate_csrf_token(self) -> str:
        """
        Generate a new CSRF token

        Returns:
            Signed CSRF token
        """
        # Generate random token
        random_token = secrets.token_urlsafe(32)

        # Sign the token with timestamp
        signed_token = self.serializer.dumps(random_token)

        return signed_token


# Helper function to create CSRF token response
def create_csrf_token_response(middleware: CSRFProtectionMiddleware) -> Response:
    """
    Create response with CSRF token in cookie and body

    Usage in endpoint:
    @app.get("/api/v1/csrf-token")
    async def get_csrf_token(request: Request):
        csrf_middleware = app.state.csrf_middleware
        return create_csrf_token_response(csrf_middleware)
    """
    token = middleware.generate_csrf_token()

    response = JSONResponse(
        content={"csrf_token": token}
    )

    # Set CSRF token in HTTP-only cookie
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=True,  # Prevent JavaScript access
        secure=os.getenv("ENVIRONMENT") == "production",  # HTTPS only in production
        samesite="strict",  # Strict same-site policy
        max_age=3600,  # 1 hour
    )

    return response
