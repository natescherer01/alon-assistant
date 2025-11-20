"""
Configuration management for the Personal AI Assistant API
"""
import os
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Settings
    app_name: str = "Personal AI Assistant"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # Security - REQUIRED in production
    secret_key: str = os.getenv("SECRET_KEY", "")
    algorithm: str = "HS256"
    # Extended to 30 days (43200 min) for personal use on trusted devices
    # Security maintained via token blacklist, account lockout, and Redis-backed revocation
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./personal_assistant.db")

    # Redis for token blacklist and caching
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Claude API - System-wide key (company pays for this)
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    claude_model: str = "claude-sonnet-4-20250514"

    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = False

    # Logging
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = 'ignore'  # Ignore extra fields from .env

    def __init__(self, **kwargs):
        """Initialize settings"""
        super().__init__(**kwargs)
        # Set debug based on environment
        self.debug = self.environment == "development"

    @validator('secret_key')
    def validate_secret_key(cls, v, values):
        """Validate SECRET_KEY is set and secure"""
        if not v:
            raise ValueError(
                "SECRET_KEY not configured. "
                "Set SECRET_KEY environment variable. "
                "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )

        # Check if using a default/weak key
        weak_keys = [
            "your-secret-key-change-in-production",
            "secret",
            "changeme",
            "12345",
            "test"
        ]
        if v.lower() in weak_keys or len(v) < 32:
            raise ValueError(
                "SECRET_KEY is too weak. Must be at least 32 characters. "
                "Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )

        return v

    @property
    def cors_origins(self) -> List[str]:
        """
        Parse CORS origins from environment variable or use defaults

        For production, set CORS_ORIGINS env var:
        CORS_ORIGINS=https://your-app.vercel.app,https://your-domain.com
        """
        default_origins = "http://localhost:5173,http://localhost:3000,http://localhost:8000"
        if self.environment == "production":
            default_origins = ""  # No default CORS in production - must be explicitly set
        cors_str = os.getenv("CORS_ORIGINS", default_origins)
        return [origin.strip() for origin in cors_str.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.environment == "production"

    @property
    def database_is_postgres(self) -> bool:
        """Check if using PostgreSQL"""
        return self.database_url.startswith("postgresql://") or self.database_url.startswith("postgres://")


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
