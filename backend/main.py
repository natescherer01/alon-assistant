"""
Personal AI Assistant - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
# GZipMiddleware disabled - it buffers SSE streams
# from fastapi.middleware.gzip import GZipMiddleware
from starlette.responses import Response
from config import get_settings
from database import init_db
from auth.router import router as auth_router
from tasks.router import router as tasks_router
from chat.router import router as chat_router
from cal.router import router as calendar_router
from logger import get_logger
from rate_limit import setup_rate_limiting

settings = get_settings()
logger = get_logger(__name__)


class SecurityHeadersMiddleware:
    """
    OWASP-compliant security headers middleware (2025)

    Implemented as pure ASGI middleware to avoid BaseHTTPMiddleware issues
    with exception handling and CORS header propagation.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = dict(message.get("headers", []))

                # Add security headers
                security_headers = [
                    (b"x-frame-options", b"DENY"),
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-xss-protection", b"0"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    (b"permissions-policy", b"geolocation=(), microphone=(), camera=(), payment=()"),
                ]

                # CSP header
                csp_directives = [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: https:",
                    "font-src 'self' data:",
                    "connect-src 'self' https://alon-assistant.up.railway.app",
                    "frame-ancestors 'none'",
                    "base-uri 'self'",
                    "form-action 'self'"
                ]
                security_headers.append(
                    (b"content-security-policy", "; ".join(csp_directives).encode())
                )

                # HSTS for production
                if settings.environment == "production":
                    security_headers.append(
                        (b"strict-transport-security", b"max-age=31536000; includeSubDomains; preload")
                    )

                # Merge with existing headers
                existing_headers = list(message.get("headers", []))
                existing_headers.extend(security_headers)
                message["headers"] = existing_headers

            await send(message)

        await self.app(scope, receive, send_with_headers)


# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Smart task management system with Claude AI integration",
    debug=settings.debug
)

# Add security headers middleware (FIRST)
app.add_middleware(SecurityHeadersMiddleware)

# Note: GZipMiddleware disabled as it buffers SSE streams, breaking real-time streaming
# If you need compression for other endpoints, implement selective compression that
# excludes text/event-stream content types

# CORS middleware (production-hardened)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,  # Specific origins only (set in Railway env vars)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Specific methods only
    allow_headers=["Authorization", "Content-Type"],  # Specific headers only
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Set up rate limiting
limiter = setup_rate_limiting(app)

# Include routers
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(tasks_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)
app.include_router(calendar_router, prefix=f"{settings.api_prefix}/calendar")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    try:
        init_db()
        logger.info("✓ Database initialized")

        # Clean up old completed tasks (7 day retention)
        from database import SessionLocal
        from tasks.cleanup import cleanup_old_completed_tasks
        db = SessionLocal()
        try:
            deleted_count = cleanup_old_completed_tasks(db, retention_days=7)
            if deleted_count > 0:
                logger.info(f"✓ Cleaned up {deleted_count} old completed tasks")
        finally:
            db.close()

        logger.info(f"✓ {settings.app_name} v{settings.app_version} is running")
        logger.info(f"✓ Environment: {settings.environment}")
        logger.info(f"✓ CORS origins: {', '.join(settings.cors_origins)}")

        if not settings.anthropic_api_key:
            logger.warning("⚠️  ANTHROPIC_API_KEY not set - AI chat features will not work")
        else:
            logger.info("✓ Company Anthropic API key configured")

        # Start calendar background scheduler
        try:
            from cal.services.jobs import start_scheduler
            start_scheduler()
            logger.info("✓ Calendar background scheduler started")
        except Exception as e:
            logger.warning(f"⚠️  Calendar scheduler failed to start: {e}")

    except Exception as e:
        logger.error(f"❌ Startup failed: {e}", exc_info=True)
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Application shutting down...")

    # Stop calendar background scheduler
    try:
        from cal.services.jobs import stop_scheduler
        stop_scheduler()
        logger.info("✓ Calendar background scheduler stopped")
    except Exception as e:
        logger.warning(f"⚠️  Failed to stop calendar scheduler: {e}")


@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "environment": settings.environment
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
