"""
Application configuration

Imports settings from root config.py
"""

from config import get_settings

# Get settings instance
settings = get_settings()

# Re-export for convenience
__all__ = ["settings"]
