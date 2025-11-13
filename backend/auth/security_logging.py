"""
Security event logging with log injection prevention

Following OWASP Logging Cheat Sheet and Top 10:2025 recommendations
"""
import json
import re
from datetime import datetime
from typing import Optional, Dict, Any
from logger import get_logger

security_logger = get_logger("security")


def sanitize_log_input(value: str, max_length: int = 200) -> str:
    """
    Sanitize input to prevent log injection attacks

    Args:
        value: String to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized string safe for logging
    """
    if not value:
        return ""

    # Remove newlines and carriage returns (log injection vectors)
    sanitized = value.replace('\n', '').replace('\r', '').replace('\t', ' ')

    # Truncate to max length
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length] + "..."

    # Remove control characters
    sanitized = re.sub(r'[\x00-\x1F\x7F]', '', sanitized)

    return sanitized


class SecurityEvent:
    """
    Security event logging with structured JSON format
    Follows OWASP logging best practices
    """

    @staticmethod
    def log_authentication_attempt(
        email: str,
        ip_address: str,
        user_agent: Optional[str],
        success: bool,
        failure_reason: Optional[str] = None
    ):
        """
        Log authentication attempt (success or failure)

        OWASP requirement: All login attempts must be logged
        """
        log_entry = {
            "event": "authentication_attempt",
            "timestamp": datetime.utcnow().isoformat(),
            "email": sanitize_log_input(email, max_length=100),
            "ip_address": sanitize_log_input(ip_address, max_length=45),
            "user_agent": sanitize_log_input(user_agent or "", max_length=200),
            "success": success,
            "failure_reason": sanitize_log_input(failure_reason or "", max_length=100)
        }

        if success:
            security_logger.info(json.dumps(log_entry))
        else:
            security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_account_locked(
        email: str,
        ip_address: str,
        failed_attempts: int,
        locked_until: datetime
    ):
        """Log account lockout event"""
        log_entry = {
            "event": "account_locked",
            "timestamp": datetime.utcnow().isoformat(),
            "email": sanitize_log_input(email),
            "ip_address": sanitize_log_input(ip_address),
            "failed_attempts": failed_attempts,
            "locked_until": locked_until.isoformat()
        }

        security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_password_change(
        user_id: int,
        email: str,
        ip_address: str
    ):
        """Log password change (security-sensitive event)"""
        log_entry = {
            "event": "password_change",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "email": sanitize_log_input(email),
            "ip_address": sanitize_log_input(ip_address)
        }

        security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_account_deletion(
        user_id: int,
        email: str,
        ip_address: str
    ):
        """Log account deletion"""
        log_entry = {
            "event": "account_deletion",
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "email": sanitize_log_input(email),
            "ip_address": sanitize_log_input(ip_address)
        }

        security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_token_refresh(
        email: str,
        ip_address: str,
        success: bool
    ):
        """Log refresh token usage"""
        log_entry = {
            "event": "token_refresh",
            "timestamp": datetime.utcnow().isoformat(),
            "email": sanitize_log_input(email),
            "ip_address": sanitize_log_input(ip_address),
            "success": success
        }

        if success:
            security_logger.info(json.dumps(log_entry))
        else:
            security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_suspicious_activity(
        event_type: str,
        details: Dict[str, Any],
        ip_address: str,
        severity: str = "MEDIUM"
    ):
        """
        Log suspicious activity requiring investigation

        Args:
            event_type: Type of suspicious activity
            details: Additional context (will be sanitized)
            ip_address: Source IP
            severity: LOW, MEDIUM, HIGH, CRITICAL
        """
        # Sanitize all string values in details
        sanitized_details = {}
        for key, value in details.items():
            if isinstance(value, str):
                sanitized_details[key] = sanitize_log_input(value)
            else:
                sanitized_details[key] = value

        log_entry = {
            "event": "suspicious_activity",
            "event_type": sanitize_log_input(event_type),
            "timestamp": datetime.utcnow().isoformat(),
            "severity": severity,
            "details": sanitized_details,
            "ip_address": sanitize_log_input(ip_address)
        }

        if severity in ["HIGH", "CRITICAL"]:
            security_logger.error(json.dumps(log_entry))
            # TODO: Send alert to security team (email, Slack, PagerDuty)
        else:
            security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_rate_limit_exceeded(
        ip_address: str,
        endpoint: str,
        limit: str
    ):
        """Log rate limit violations"""
        log_entry = {
            "event": "rate_limit_exceeded",
            "timestamp": datetime.utcnow().isoformat(),
            "ip_address": sanitize_log_input(ip_address),
            "endpoint": sanitize_log_input(endpoint),
            "limit": limit
        }

        security_logger.warning(json.dumps(log_entry))

    @staticmethod
    def log_invalid_token(
        token_type: str,
        reason: str,
        ip_address: str
    ):
        """Log invalid token usage attempts"""
        log_entry = {
            "event": "invalid_token",
            "timestamp": datetime.utcnow().isoformat(),
            "token_type": token_type,
            "reason": sanitize_log_input(reason),
            "ip_address": sanitize_log_input(ip_address)
        }

        security_logger.warning(json.dumps(log_entry))


def get_client_ip(request) -> str:
    """
    Extract client IP from request, checking for proxy headers

    Args:
        request: FastAPI Request object

    Returns:
        Client IP address
    """
    # Check for Railway's forwarded headers
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first
        return forwarded_for.split(',')[0].strip()

    # Check for Cloudflare or other proxy headers
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fallback to direct client host
    return request.client.host if request.client else "unknown"


def get_user_agent(request) -> str:
    """Extract user agent from request"""
    return request.headers.get("User-Agent", "unknown")
