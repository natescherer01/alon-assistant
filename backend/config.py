"""
Configuration management for the Personal AI Assistant API
"""
import os
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # API Settings
    app_name: str = "Personal AI Assistant"
    app_version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # Security
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./personal_assistant.db")

    # Claude API
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "")
    claude_model: str = "claude-3-5-sonnet-20241022"

    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = environment == "development"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def cors_origins(self) -> List[str]:
        """
        Parse CORS origins from environment variable or use defaults

        For production, set CORS_ORIGINS env var:
        CORS_ORIGINS=https://your-app.vercel.app,https://your-domain.com
        """
        default_origins = "http://localhost:5173,http://localhost:3000,http://localhost:8000"
        cors_str = os.getenv("CORS_ORIGINS", default_origins)
        return [origin.strip() for origin in cors_str.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
