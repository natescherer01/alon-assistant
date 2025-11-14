"""
Security Headers Middleware

Implements security headers to protect against common web vulnerabilities:
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security (HSTS) in production
- Permissions-Policy
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Callable
import os


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses

    Protects against:
    - XSS attacks (CSP, X-XSS-Protection)
    - Clickjacking (X-Frame-Options)
    - MIME-sniffing (X-Content-Type-Options)
    - Man-in-the-middle attacks (HSTS in production)
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Get environment
        environment = os.getenv("ENVIRONMENT", "development")

        # X-Content-Type-Options: Prevent MIME-sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options: Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # X-XSS-Protection: Enable XSS filter (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer-Policy: Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy: Control browser features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Strict-Transport-Security: Force HTTPS (production only)
        if environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        # Content-Security-Policy: Prevent XSS and injection attacks
        self._add_csp_header(response, environment)

        return response

    def _add_csp_header(self, response: Response, environment: str) -> None:
        """
        Add Content-Security-Policy header

        Note: In development, we allow 'unsafe-inline' and 'unsafe-eval' for React DevTools.
        In production, these should be removed and replaced with nonces or hashes.
        """
        if environment == "development":
            # Development: More permissive for hot reload and DevTools
            csp_directives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' http://localhost:* ws://localhost:*",
                "frame-ancestors 'none'",
            ]
        else:
            # Production: Strict CSP
            csp_directives = [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",  # May need hashes for inline styles
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self'",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
            ]

        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
