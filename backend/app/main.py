"""
FastAPI Main Application

Production-ready API with:
- Security headers middleware (Critical Issue #2)
- Cache control middleware (Critical Issue #1)
- CORS configuration
- GZip compression (Phase 3)
- Error handling
- Health checks

@see docs/IMPLEMENTATION_PLAN.md
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import logging
import time

from app.core.config import settings
from app.middleware.cache import CacheControlMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.csrf import CSRFProtectionMiddleware, create_csrf_token_response
# from app.api.endpoints import conversations  # TODO: Enable after implementing CRUD/schemas

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Initialize CSRF protection middleware
csrf_middleware = CSRFProtectionMiddleware(
    app=None,  # Will be set by add_middleware
    secret_key=settings.secret_key,
    token_expiry=3600  # 1 hour
)
app.state.csrf_middleware = csrf_middleware

# Add CSRF Protection Middleware (BLOCKER #2)
app.add_middleware(
    CSRFProtectionMiddleware,
    secret_key=settings.secret_key,
    token_expiry=3600
)

# Add Security Headers Middleware (Critical Issue #2)
app.add_middleware(SecurityHeadersMiddleware)

# Add Cache Control Middleware (Critical Issue #1)
app.add_middleware(CacheControlMiddleware)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["ETag", "Cache-Control", "X-Process-Time", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
)

# Add GZip Compression Middleware (Phase 3.4)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware (Medium Priority Issue #11)
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add X-Process-Time header to track request performance"""
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000  # Convert to ms
    response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

    # Log slow requests
    if process_time > 1000:  # > 1 second
        logger.warning(
            f"Slow request: {request.method} {request.url.path} took {process_time:.2f}ms"
        )

    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions gracefully"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error" if settings.environment == "production" else str(exc),
            "type": "internal_server_error",
        }
    )


# Health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
    }


# CSRF token endpoint
@app.get("/api/v1/csrf-token", tags=["security"])
@limiter.limit("10/minute")  # Rate limit CSRF token requests
async def get_csrf_token(request: Request):
    """
    Get CSRF token for state-changing requests

    Returns:
        JSON with csrf_token and sets HTTP-only cookie
    """
    return create_csrf_token_response(app.state.csrf_middleware)


# Cache metrics endpoint (development only)
if settings.environment == "development":
    from app.utils.cache import cache_metrics

    @app.get("/metrics/cache", tags=["metrics"])
    async def get_cache_metrics():
        """Get cache hit/miss metrics"""
        return cache_metrics.get_metrics()


# Include routers
# TODO: Enable after implementing CRUD/schemas
# app.include_router(
#     conversations.router,
#     prefix="/api/v1/conversations",
#     tags=["conversations"]
# )


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")

    # Validate SECRET_KEY security
    if len(settings.secret_key) < 32:
        raise ValueError(
            "CRITICAL SECURITY ERROR: SECRET_KEY must be at least 32 characters. "
            "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
        )

    # Check for insecure default keys
    weak_keys = ["changeme-insecure-secret-key", "secret", "changeme", "12345", "test"]
    if settings.secret_key.lower() in weak_keys or settings.secret_key == "your-secret-key-change-in-production":
        raise ValueError(
            "CRITICAL SECURITY ERROR: Using default/weak SECRET_KEY is forbidden. "
            "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
        )

    logger.info("✅ SECRET_KEY validation passed")

    # TODO: Initialize database connection pool
    # TODO: Run database migrations if needed
    # TODO: Initialize Redis connection if enabled


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info(f"Shutting down {settings.app_name}")

    # TODO: Close database connections
    # TODO: Close Redis connection

    # Log final cache metrics
    from app.utils.cache import cache_metrics
    logger.info(f"Final cache metrics: {cache_metrics.get_metrics()}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
