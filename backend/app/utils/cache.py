"""
Cache Utilities

Implements secure caching features:
- HMAC-SHA256 ETags to prevent cache poisoning
- Cache metrics tracking
- Cache-Control header generation
"""

import hashlib
import hmac
import json
from typing import Any, Optional
from datetime import datetime


class CacheMetrics:
    """Track cache hit/miss metrics"""

    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.etag_validations = 0
        self.not_modified_responses = 0

    def record_hit(self):
        """Record a cache hit"""
        self.hits += 1
        self.not_modified_responses += 1

    def record_miss(self):
        """Record a cache miss"""
        self.misses += 1

    def record_etag_validation(self):
        """Record an ETag validation"""
        self.etag_validations += 1

    def get_metrics(self) -> dict:
        """Get current metrics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0

        return {
            "hits": self.hits,
            "misses": self.misses,
            "304_responses": self.not_modified_responses,
            "etag_validations": self.etag_validations,
            "hit_rate_percent": round(hit_rate, 2),
            "total_requests": total_requests,
        }

    def reset(self):
        """Reset all metrics"""
        self.hits = 0
        self.misses = 0
        self.etag_validations = 0
        self.not_modified_responses = 0


# Global cache metrics instance
cache_metrics = CacheMetrics()


def generate_secure_etag(data: Any, user_id: str, secret_key: str) -> str:
    """
    Generate cryptographically secure ETag using HMAC-SHA256

    Prevents cache poisoning by signing the data hash with:
    1. User context (user_id)
    2. Data hash (SHA256)
    3. Secret key (HMAC signature)

    Args:
        data: Data to hash (will be JSON serialized)
        user_id: User ID for user-scoped caching
        secret_key: Secret key for HMAC signature

    Returns:
        Weak ETag (W/"signature") for secure cache validation
    """
    # Serialize data consistently
    data_str = json.dumps(data, sort_keys=True, default=str)

    # Hash the data
    data_hash = hashlib.sha256(data_str.encode()).hexdigest()

    # Create message with user context
    message = f"{user_id}:{data_hash}"

    # Sign with HMAC-SHA256
    signature = hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()

    # Return weak ETag (indicates semantic equivalence, not byte-for-byte)
    return f'W/"{signature}"'


def should_return_304(if_none_match: Optional[str], current_etag: str) -> bool:
    """
    Check if 304 Not Modified should be returned

    Args:
        if_none_match: If-None-Match header value from request
        current_etag: Current ETag for the resource

    Returns:
        True if 304 should be returned, False otherwise
    """
    if not if_none_match:
        return False

    cache_metrics.record_etag_validation()

    # Clean up both ETags for comparison
    if_none_match_clean = if_none_match.strip().strip('"')
    current_etag_clean = current_etag.strip().strip('"')

    # Handle weak ETags
    if if_none_match_clean.startswith('W/'):
        if_none_match_clean = if_none_match_clean[2:].strip('"')
    if current_etag_clean.startswith('W/'):
        current_etag_clean = current_etag_clean[2:].strip('"')

    return if_none_match_clean == current_etag_clean


def generate_cache_control_header(
    max_age: int = 300,
    private: bool = True,
    must_revalidate: bool = True,
    stale_while_revalidate: Optional[int] = None,
) -> str:
    """
    Generate Cache-Control header

    Args:
        max_age: Time in seconds resource is fresh (default: 5 minutes)
        private: If True, cache is private (user-specific)
        must_revalidate: If True, must revalidate after stale
        stale_while_revalidate: Time in seconds to serve stale while revalidating

    Returns:
        Cache-Control header value
    """
    directives = []

    if private:
        directives.append("private")
    else:
        directives.append("public")

    directives.append(f"max-age={max_age}")

    if must_revalidate:
        directives.append("must-revalidate")

    if stale_while_revalidate:
        directives.append(f"stale-while-revalidate={stale_while_revalidate}")

    return ", ".join(directives)
