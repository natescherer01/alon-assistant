"""
Field-Level Encryption Service with Production-Ready Security

Features:
- AES-128-CBC + HMAC-SHA256 (Fernet)
- Versioned key rotation support
- Input validation and sanitization
- Comprehensive audit logging
- Prometheus metrics for monitoring
- Integration with secrets manager (GCP/AWS/Vault)
"""
import os
import re
import hashlib
import logging
from typing import Optional, List
from functools import lru_cache
from datetime import datetime

from cryptography.fernet import Fernet, InvalidToken
from prometheus_client import Counter, Histogram, Gauge

# Configure audit logging
audit_logger = logging.getLogger('audit.encryption')
audit_logger.setLevel(logging.INFO)

# Prometheus metrics
encryption_operations = Counter(
    'encryption_operations_total',
    'Total number of encryption operations',
    ['operation', 'status']
)
encryption_duration = Histogram(
    'encryption_duration_seconds',
    'Time spent on encryption operations',
    ['operation']
)
encryption_errors = Counter(
    'encryption_errors_total',
    'Total encryption/decryption errors',
    ['error_type']
)
active_encryption_key_version = Gauge(
    'active_encryption_key_version',
    'Currently active encryption key version'
)


class EncryptionSettings:
    """Configuration for encryption service"""

    def __init__(self):
        # Try to load from secrets manager first, fallback to env vars
        try:
            from secrets_manager import get_secrets_manager
            secrets_mgr = get_secrets_manager()

            # Primary encryption key
            self.encryption_key = (
                secrets_mgr.get_secret("ENCRYPTION_KEY") or
                os.getenv("ENCRYPTION_KEY", "")
            )

            # Fallback key for rotation
            self.encryption_key_fallback = (
                secrets_mgr.get_secret("ENCRYPTION_KEY_FALLBACK") or
                os.getenv("ENCRYPTION_KEY_FALLBACK")
            )

            # Key version tracking
            self.encryption_key_version = int(
                secrets_mgr.get_secret("ENCRYPTION_KEY_VERSION") or
                os.getenv("ENCRYPTION_KEY_VERSION", "1")
            )

        except Exception as e:
            audit_logger.warning(
                f"Failed to load from secrets manager, using environment variables: {e}"
            )
            self.encryption_key = os.getenv("ENCRYPTION_KEY", "")
            self.encryption_key_fallback = os.getenv("ENCRYPTION_KEY_FALLBACK")
            self.encryption_key_version = int(os.getenv("ENCRYPTION_KEY_VERSION", "1"))

        # Validate key is set
        if not self.encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY not set. Generate with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )

        # Validate key format
        if not self._is_valid_fernet_key(self.encryption_key):
            raise ValueError("ENCRYPTION_KEY is not a valid Fernet key (must be 44-char base64 string)")

        if self.encryption_key_fallback and not self._is_valid_fernet_key(self.encryption_key_fallback):
            raise ValueError("ENCRYPTION_KEY_FALLBACK is not a valid Fernet key")

        # Max input size (10 MB) - prevent memory exhaustion attacks
        self.max_plaintext_size = int(os.getenv("ENCRYPTION_MAX_SIZE", 10 * 1024 * 1024))

        # Enable/disable input sanitization
        self.sanitize_input = os.getenv("ENCRYPTION_SANITIZE_INPUT", "true").lower() == "true"

        # Audit logging enabled by default
        self.audit_logging = os.getenv("ENCRYPTION_AUDIT_LOGGING", "true").lower() == "true"

    @staticmethod
    def _is_valid_fernet_key(key: str) -> bool:
        """Validate that key is a proper Fernet key"""
        try:
            # Fernet keys are 44 characters (32 bytes base64-encoded)
            if len(key) != 44:
                return False
            # Try to create a Fernet instance
            Fernet(key.encode())
            return True
        except Exception:
            return False


class EncryptionService:
    """
    Production-ready encryption service for field-level encryption.

    Features:
    - Transparent encryption/decryption with Fernet (AES-128-CBC + HMAC-SHA256)
    - Versioned key rotation support
    - Input validation and sanitization
    - Comprehensive audit logging with PII redaction
    - Prometheus metrics for monitoring
    - Defense against common attacks (injection, overflow, etc.)

    Usage:
        service = EncryptionService()
        ciphertext = service.encrypt("sensitive data")
        plaintext = service.decrypt(ciphertext)
    """

    # Dangerous characters/patterns to detect in input
    SUSPICIOUS_PATTERNS = [
        r'<script[^>]*>.*?</script>',  # XSS
        r'javascript:',                 # JavaScript injection
        r'on\w+\s*=',                   # Event handlers
        r'eval\s*\(',                   # Code execution
        r'(?:^|[^\\])[\'\"].*?(?:UNION|SELECT|INSERT|UPDATE|DELETE|DROP)',  # SQL keywords
    ]

    def __init__(self, settings: Optional[EncryptionSettings] = None):
        """
        Initialize encryption service.

        Args:
            settings: Optional EncryptionSettings instance. If None, loads from environment.

        Raises:
            ValueError: If ENCRYPTION_KEY is not set or invalid
        """
        if settings is None:
            settings = EncryptionSettings()

        self.settings = settings

        # Initialize primary cipher
        self.primary_cipher = Fernet(settings.encryption_key.encode())
        self.primary_version = settings.encryption_key_version

        # Initialize fallback cipher for key rotation
        self.fallback_cipher: Optional[Fernet] = None
        self.fallback_version: Optional[int] = None

        if settings.encryption_key_fallback:
            self.fallback_cipher = Fernet(settings.encryption_key_fallback.encode())
            self.fallback_version = settings.encryption_key_version - 1  # Assume previous version

            if self.settings.audit_logging:
                audit_logger.info(
                    "Encryption service initialized with key rotation support",
                    extra={
                        "event": "service_init",
                        "primary_version": self.primary_version,
                        "fallback_version": self.fallback_version,
                        "timestamp": datetime.utcnow().isoformat(),
                        "key_fingerprint": self._get_key_fingerprint(settings.encryption_key)
                    }
                )
        else:
            if self.settings.audit_logging:
                audit_logger.info(
                    "Encryption service initialized",
                    extra={
                        "event": "service_init",
                        "key_version": self.primary_version,
                        "timestamp": datetime.utcnow().isoformat(),
                        "key_fingerprint": self._get_key_fingerprint(settings.encryption_key)
                    }
                )

        # Update Prometheus gauge
        active_encryption_key_version.set(self.primary_version)

    def encrypt(self, plaintext: Optional[str]) -> Optional[str]:
        """
        Encrypt plaintext string to ciphertext with validation and monitoring.

        Args:
            plaintext: String to encrypt (can be None)

        Returns:
            Encrypted ciphertext as base64 string, or None if input is None

        Raises:
            ValueError: If input validation fails
            RuntimeError: If encryption operation fails

        Security:
            - Validates input size to prevent memory exhaustion
            - Sanitizes input to detect injection attempts
            - Logs encryption events (without PII) for audit
            - Records metrics for monitoring
        """
        if plaintext is None:
            return None

        with encryption_duration.labels(operation='encrypt').time():
            try:
                # Input validation
                self._validate_input(plaintext, operation='encrypt')

                # Sanitize input (detect suspicious patterns)
                if self.settings.sanitize_input:
                    self._sanitize_input(plaintext)

                # Encrypt
                ciphertext_bytes = self.primary_cipher.encrypt(plaintext.encode('utf-8'))
                ciphertext = ciphertext_bytes.decode('utf-8')

                # Audit log (without PII)
                if self.settings.audit_logging:
                    audit_logger.debug(
                        "Encryption operation completed",
                        extra={
                            "event": "encrypt",
                            "plaintext_length": len(plaintext),
                            "ciphertext_length": len(ciphertext),
                            "key_version": self.primary_version,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                    )

                # Metrics
                encryption_operations.labels(operation='encrypt', status='success').inc()

                return ciphertext

            except ValueError as e:
                encryption_errors.labels(error_type='validation').inc()
                encryption_operations.labels(operation='encrypt', status='validation_error').inc()
                audit_logger.warning(f"Encryption validation failed: {e}")
                raise

            except Exception as e:
                encryption_errors.labels(error_type='encryption_failed').inc()
                encryption_operations.labels(operation='encrypt', status='error').inc()
                audit_logger.error(
                    f"Encryption operation failed: {e}",
                    extra={
                        "event": "encrypt_error",
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                raise RuntimeError(f"Encryption failed: {e}") from e

    def decrypt(self, ciphertext: Optional[str]) -> Optional[str]:
        """
        Decrypt ciphertext to plaintext with fallback key support.

        Args:
            ciphertext: Encrypted string to decrypt (can be None)

        Returns:
            Decrypted plaintext string, or None if input is None

        Raises:
            ValueError: If ciphertext is invalid or tampered
            RuntimeError: If decryption fails

        Security:
            - Tries primary key first, falls back to old key for rotation
            - Detects tampering via HMAC verification (built into Fernet)
            - Logs decryption failures for security monitoring
            - Records metrics for alerting
        """
        if ciphertext is None:
            return None

        with encryption_duration.labels(operation='decrypt').time():
            try:
                # Input validation
                self._validate_input(ciphertext, operation='decrypt')

                # Try primary key first
                try:
                    plaintext_bytes = self.primary_cipher.decrypt(ciphertext.encode('utf-8'))
                    plaintext = plaintext_bytes.decode('utf-8')

                    # Metrics
                    encryption_operations.labels(operation='decrypt', status='success_primary').inc()

                    return plaintext

                except InvalidToken:
                    # Try fallback key (for key rotation)
                    if self.fallback_cipher:
                        try:
                            plaintext_bytes = self.fallback_cipher.decrypt(ciphertext.encode('utf-8'))
                            plaintext = plaintext_bytes.decode('utf-8')

                            # Audit log (data encrypted with old key)
                            if self.settings.audit_logging:
                                audit_logger.info(
                                    "Decryption used fallback key (data needs re-encryption)",
                                    extra={
                                        "event": "decrypt_fallback",
                                        "fallback_version": self.fallback_version,
                                        "timestamp": datetime.utcnow().isoformat()
                                    }
                                )

                            # Metrics
                            encryption_operations.labels(operation='decrypt', status='success_fallback').inc()

                            return plaintext

                        except InvalidToken:
                            # Both keys failed - possible tampering or corruption
                            raise ValueError("Decryption failed with both primary and fallback keys. Data may be corrupted or tampered.")
                    else:
                        # No fallback key available
                        raise ValueError("Decryption failed. Invalid ciphertext or key mismatch.")

            except ValueError as e:
                encryption_errors.labels(error_type='invalid_token').inc()
                encryption_operations.labels(operation='decrypt', status='invalid_token').inc()
                audit_logger.error(
                    f"Decryption failed - possible tampering or corruption: {e}",
                    extra={
                        "event": "decrypt_error",
                        "error": "invalid_token",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                raise

            except Exception as e:
                encryption_errors.labels(error_type='decryption_failed').inc()
                encryption_operations.labels(operation='decrypt', status='error').inc()
                audit_logger.error(
                    f"Decryption operation failed: {e}",
                    extra={
                        "event": "decrypt_error",
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                raise RuntimeError(f"Decryption failed: {e}") from e

    def _validate_input(self, value: str, operation: str) -> None:
        """
        Validate input for encryption/decryption operations.

        Args:
            value: Input string to validate
            operation: Operation type ('encrypt' or 'decrypt')

        Raises:
            ValueError: If validation fails
        """
        if not isinstance(value, str):
            raise ValueError(f"Input must be a string, got {type(value).__name__}")

        # Check size to prevent memory exhaustion attacks
        if len(value) > self.settings.max_plaintext_size:
            raise ValueError(
                f"Input too large ({len(value)} bytes). "
                f"Maximum allowed: {self.settings.max_plaintext_size} bytes"
            )

        # For decryption, validate base64 format (Fernet ciphertext)
        if operation == 'decrypt':
            if not value.startswith('gAAAAA'):  # Fernet version byte (0x80) in base64
                raise ValueError("Invalid ciphertext format (not Fernet)")

    def _sanitize_input(self, value: str) -> None:
        """
        Detect suspicious patterns in input that might indicate injection attempts.

        Args:
            value: Input string to check

        Raises:
            ValueError: If suspicious patterns detected

        Note:
            This is defense-in-depth. The application should already validate/sanitize
            input before encryption, but we check again here as a safety net.
        """
        for pattern in self.SUSPICIOUS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                # Log security event
                audit_logger.warning(
                    f"Suspicious pattern detected in encryption input",
                    extra={
                        "event": "suspicious_input",
                        "pattern": pattern,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                )
                encryption_errors.labels(error_type='suspicious_input').inc()
                raise ValueError(f"Input contains suspicious patterns. Please sanitize input before encryption.")

    @staticmethod
    def _get_key_fingerprint(key: str) -> str:
        """
        Generate SHA-256 fingerprint of encryption key for audit logging.

        Args:
            key: Encryption key

        Returns:
            First 16 characters of SHA-256 hash (for logging/identification)

        Note:
            Never logs the actual key, only a fingerprint for identification
        """
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def generate_searchable_hash(self, value: str) -> str:
        """
        Generate SHA-256 hash for searchable lookups on encrypted fields.

        Args:
            value: Plaintext value to hash (e.g., email address)

        Returns:
            64-character hex SHA-256 hash

        Usage:
            # For user email lookups
            email_hash = service.generate_searchable_hash(user_email.lower())

        Security:
            - Uses SHA-256 (one-way, irreversible)
            - Case-insensitive (normalizes to lowercase)
            - Allows indexed database lookups without decryption
        """
        normalized = value.lower().strip()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    @classmethod
    @lru_cache(maxsize=1)
    def get_instance(cls) -> 'EncryptionService':
        """
        Get singleton instance of EncryptionService.

        Returns:
            Cached EncryptionService instance

        Note:
            Singleton pattern ensures encryption key is loaded only once,
            improving performance and reducing secrets manager API calls.
        """
        return cls()


@lru_cache(maxsize=1)
def get_encryption_service() -> EncryptionService:
    """
    Get singleton instance of EncryptionService.

    Returns:
        Cached EncryptionService instance

    Usage:
        from app.core.encryption import get_encryption_service

        service = get_encryption_service()
        encrypted = service.encrypt("sensitive data")
    """
    return EncryptionService.get_instance()


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.

    Returns:
        Base64-encoded 32-byte key (44 characters)

    Usage:
        key = generate_encryption_key()
        print(f"ENCRYPTION_KEY={key}")

    Security:
        Uses cryptographically secure random number generator
    """
    return Fernet.generate_key().decode('utf-8')


if __name__ == "__main__":
    # Generate new encryption key
    print("Generated Encryption Key:")
    print(generate_encryption_key())
    print("\nAdd to .env or secrets manager:")
    print(f"ENCRYPTION_KEY={generate_encryption_key()}")
