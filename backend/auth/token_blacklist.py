"""
Token blacklist using Redis for token revocation
"""
from typing import Optional
import redis
from datetime import timedelta
from config import get_settings
from logger import get_logger

settings = get_settings()
logger = get_logger(__name__)


class TokenBlacklist:
    """Redis-based token blacklist for revoked tokens"""

    def __init__(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=5
            )
            # Test connection
            self.redis_client.ping()
            self.enabled = True
            logger.info("Token blacklist (Redis) initialized successfully")
        except redis.ConnectionError as e:
            logger.warning(f"Redis connection failed: {e}. Token revocation disabled.")
            self.enabled = False
        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}. Token revocation disabled.")
            self.enabled = False

    def revoke_token(self, token: str, expires_in_minutes: int = None) -> bool:
        """
        Add a token to the blacklist with TTL matching token's remaining lifetime

        Args:
            token: JWT token to revoke
            expires_in_minutes: Time until token naturally expires (calculated from JWT if not provided)

        Returns:
            True if successfully added to blacklist, False otherwise
        """
        if not self.enabled:
            logger.warning("Token revocation attempted but Redis is not available")
            return False

        try:
            # If expires_in_minutes not provided, calculate from token
            if expires_in_minutes is None:
                from jose import jwt
                from datetime import datetime
                try:
                    # Decode without verification to get exp claim
                    payload = jwt.decode(
                        token,
                        options={"verify_signature": False, "verify_exp": False}
                    )
                    exp_timestamp = payload.get("exp")
                    if exp_timestamp:
                        current_time = datetime.utcnow().timestamp()
                        remaining_seconds = int(exp_timestamp - current_time)
                        expires_in_minutes = max(remaining_seconds // 60, 1)  # At least 1 minute
                    else:
                        # Fallback to access token expiration
                        expires_in_minutes = settings.access_token_expire_minutes
                except Exception as e:
                    logger.warning(f"Could not extract exp from token: {e}, using default TTL")
                    expires_in_minutes = settings.access_token_expire_minutes

            # Store token with expiration matching token's natural expiration
            # After the token expires naturally, it will be auto-removed from Redis
            key = f"blacklist:{token}"
            self.redis_client.setex(
                key,
                timedelta(minutes=expires_in_minutes),
                "revoked"
            )
            logger.info(f"Token revoked and added to blacklist (expires in {expires_in_minutes}m)")
            return True
        except Exception as e:
            logger.error(f"Failed to revoke token: {e}")
            return False

    def is_token_revoked(self, token: str) -> bool:
        """
        Check if a token has been revoked

        Behavior:
        - If Redis not configured at startup (self.enabled=False): FAIL OPEN (return False)
        - If Redis configured but transient error occurs: FAIL CLOSED (return True)

        Args:
            token: JWT token to check

        Returns:
            True if token is revoked or on transient error, False if valid or Redis not configured
        """
        if not self.enabled:
            # If Redis not configured at startup, fail open - allow tokens
            # Token will still be validated for expiration and signature
            return False

        try:
            key = f"blacklist:{token}"
            result = self.redis_client.exists(key) > 0
            return result
        except redis.TimeoutError:
            logger.error("Redis timeout checking token blacklist - FAILING CLOSED")
            return True  # Fail closed: treat as revoked on timeout
        except redis.ConnectionError:
            logger.error("Redis connection error checking token blacklist - FAILING CLOSED")
            return True  # Fail closed: treat as revoked on connection error
        except Exception as e:
            logger.error(f"Failed to check token blacklist - FAILING CLOSED: {e}")
            return True  # Fail closed: treat as revoked on any error

    def revoke_all_user_tokens(self, user_email: str) -> bool:
        """
        Revoke all tokens for a specific user (e.g., on password change)

        Args:
            user_email: Email of the user

        Returns:
            True if successfully added to blacklist, False otherwise
        """
        if not self.enabled:
            return False

        try:
            # Store user email in blacklist for longest token duration
            key = f"user_blacklist:{user_email}"
            max_token_duration = max(
                settings.access_token_expire_minutes,
                settings.refresh_token_expire_days * 24 * 60
            )
            self.redis_client.setex(
                key,
                timedelta(minutes=max_token_duration),
                "all_tokens_revoked"
            )
            logger.info(f"All tokens revoked for user: {user_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to revoke all user tokens: {e}")
            return False

    def is_user_blacklisted(self, user_email: str) -> bool:
        """
        Check if all tokens for a user have been revoked

        Behavior:
        - If Redis not configured at startup (self.enabled=False): FAIL OPEN (return False)
        - If Redis configured but transient error occurs: FAIL CLOSED (return True)

        Args:
            user_email: Email of the user

        Returns:
            True if user is blacklisted or on transient error, False otherwise
        """
        if not self.enabled:
            # If Redis not configured at startup, fail open - allow access
            return False

        try:
            key = f"user_blacklist:{user_email}"
            return self.redis_client.exists(key) > 0
        except redis.TimeoutError:
            logger.error("Redis timeout checking user blacklist - FAILING CLOSED")
            return True
        except redis.ConnectionError:
            logger.error("Redis connection error checking user blacklist - FAILING CLOSED")
            return True
        except Exception as e:
            logger.error(f"Failed to check user blacklist - FAILING CLOSED: {e}")
            return True

    def clear_user_blacklist(self, user_email: str) -> bool:
        """
        Clear user blacklist (e.g., after user successfully re-authenticates)

        Args:
            user_email: Email of the user

        Returns:
            True if successfully removed, False otherwise
        """
        if not self.enabled:
            return False

        try:
            key = f"user_blacklist:{user_email}"
            self.redis_client.delete(key)
            logger.info(f"User blacklist cleared for: {user_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to clear user blacklist: {e}")
            return False


# Global instance
_blacklist: Optional[TokenBlacklist] = None


def get_token_blacklist() -> TokenBlacklist:
    """Get or create the token blacklist instance"""
    global _blacklist
    if _blacklist is None:
        _blacklist = TokenBlacklist()
    return _blacklist
