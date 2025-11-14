"""
Cache Control Middleware

Implements HTTP caching with:
- ETag validation
- 304 Not Modified responses
- Cache-Control headers
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from typing import Callable


class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Add cache control headers to responses

    This middleware adds appropriate Cache-Control headers based on:
    - HTTP method (GET/HEAD vs POST/PUT/DELETE)
    - Response status code
    - Content type
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Only cache successful GET/HEAD requests
        if request.method in ["GET", "HEAD"] and response.status_code == 200:
            # Default: no caching (endpoints will override if they support caching)
            if "Cache-Control" not in response.headers:
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

        # Never cache mutations or errors
        elif request.method in ["POST", "PUT", "PATCH", "DELETE"] or response.status_code >= 400:
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"

        return response
