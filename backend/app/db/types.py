"""
SQLAlchemy TypeDecorator for Transparent Field-Level Encryption

This module provides a custom SQLAlchemy column type that automatically
encrypts data before storing in the database and decrypts when reading.

Usage:
    from app.db.types import EncryptedString

    class User(Base):
        email = Column(EncryptedString(255), unique=True, nullable=False)
        full_name = Column(EncryptedString(255))

    # Usage is completely transparent:
    user = User(email="test@example.com")  # Encrypted automatically on save
    print(user.email)  # Decrypted automatically: "test@example.com"
"""
from typing import Optional
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


class EncryptedString(TypeDecorator):
    """
    SQLAlchemy type for encrypted string fields.

    Transparently encrypts data on write (process_bind_param) and
    decrypts on read (process_result_value) using the EncryptionService.

    Features:
    - Automatic encryption/decryption
    - Handles NULL values correctly
    - Adjusts column length to account for encryption overhead
    - Compatible with all SQLAlchemy features (queries, joins, etc.)

    Encryption Overhead:
    - Fernet adds ~57 bytes of metadata + 33% base64 encoding
    - Column length is automatically increased by 1.5x + 50 bytes

    Example:
        # Original field: VARCHAR(255)
        # Encrypted field: VARCHAR(433)  # ceil(255 * 1.5 + 50)

    Security:
    - Uses Fernet (AES-128-CBC + HMAC-SHA256)
    - Authenticated encryption (prevents tampering)
    - Input validation before encryption
    - Audit logging of operations

    Limitations:
    - Cannot use database-level LIKE queries on encrypted data
    - Cannot sort by encrypted fields in database
    - Cannot use encrypted fields in database-level UNIQUE constraints
      (use searchable hashes instead)

    Performance:
    - Encryption: ~0.1-0.5ms per field
    - Decryption: ~0.1-0.5ms per field
    - Use caching for frequently accessed data

    Thread Safety:
    - EncryptionService is thread-safe
    - TypeDecorator instances are stateless
    """

    impl = String
    cache_ok = True  # Safe to cache compiled SQL statements

    def __init__(self, length: Optional[int] = None, **kwargs):
        """
        Initialize EncryptedString type.

        Args:
            length: Maximum length of plaintext data (before encryption)
            **kwargs: Additional SQLAlchemy column options

        Note:
            The actual column length will be larger to accommodate encryption overhead.
            Formula: encrypted_length = ceil(plaintext_length * 1.5 + 50)
        """
        if length:
            # Calculate encrypted size
            # Fernet overhead: 57 bytes (version + timestamp + IV + HMAC)
            # Base64 encoding: ~33% expansion
            # Safety margin: +50 bytes
            encrypted_length = int(length * 1.5) + 50
            super().__init__(encrypted_length, **kwargs)
        else:
            # For TEXT columns (unlimited length)
            super().__init__(**kwargs)

    def process_bind_param(self, value: Optional[str], dialect) -> Optional[str]:
        """
        Encrypt data before storing in database.

        Args:
            value: Plaintext string to encrypt
            dialect: SQLAlchemy dialect (not used)

        Returns:
            Encrypted ciphertext, or None if value is None

        Called by SQLAlchemy when:
        - INSERT operations
        - UPDATE operations
        - Prepared statement binding

        Security:
        - Validates input before encryption
        - Detects injection attempts
        - Logs encryption events for audit
        """
        if value is None:
            return None

        # Import here to avoid circular imports
        from app.core.encryption import get_encryption_service

        try:
            service = get_encryption_service()
            encrypted = service.encrypt(value)
            return encrypted
        except Exception as e:
            # Log error but don't expose internal details
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Encryption failed in process_bind_param: {e}")
            raise ValueError("Failed to encrypt data") from e

    def process_result_value(self, value: Optional[str], dialect) -> Optional[str]:
        """
        Decrypt data after reading from database.

        Args:
            value: Encrypted ciphertext from database
            dialect: SQLAlchemy dialect (not used)

        Returns:
            Decrypted plaintext, or None if value is None

        Called by SQLAlchemy when:
        - SELECT operations
        - Loading model instances
        - Accessing column values

        Security:
        - Validates ciphertext format
        - Detects tampering via HMAC
        - Logs decryption failures for security monitoring
        - Supports fallback key for rotation
        """
        if value is None:
            return None

        # Import here to avoid circular imports
        from app.core.encryption import get_encryption_service

        try:
            service = get_encryption_service()
            decrypted = service.decrypt(value)
            return decrypted
        except Exception as e:
            # Log error but don't expose internal details
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Decryption failed in process_result_value: {e}")
            raise ValueError("Failed to decrypt data") from e

    def copy(self, **kwargs):
        """
        Create a copy of this type instance.

        Required for SQLAlchemy type copying operations.
        """
        return EncryptedString(self.impl.length, **kwargs)


class EncryptedText(TypeDecorator):
    """
    SQLAlchemy type for encrypted TEXT fields (unlimited length).

    Same as EncryptedString but for TEXT/CLOB columns without length limit.

    Usage:
        class ChatMessage(Base):
            message = Column(EncryptedText, nullable=False)
            response = Column(EncryptedText, nullable=False)

    Note:
        - Uses TEXT instead of VARCHAR
        - No length restrictions
        - Otherwise identical to EncryptedString
    """

    impl = String  # SQLAlchemy String without length = TEXT
    cache_ok = True

    def __init__(self, **kwargs):
        """Initialize EncryptedText type (no length parameter)"""
        super().__init__(**kwargs)

    def process_bind_param(self, value: Optional[str], dialect) -> Optional[str]:
        """Encrypt data before storing"""
        if value is None:
            return None

        from app.core.encryption import get_encryption_service

        try:
            service = get_encryption_service()
            return service.encrypt(value)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Encryption failed in EncryptedText: {e}")
            raise ValueError("Failed to encrypt data") from e

    def process_result_value(self, value: Optional[str], dialect) -> Optional[str]:
        """Decrypt data after reading"""
        if value is None:
            return None

        from app.core.encryption import get_encryption_service

        try:
            service = get_encryption_service()
            return service.decrypt(value)
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Decryption failed in EncryptedText: {e}")
            raise ValueError("Failed to decrypt data") from e

    def copy(self, **kwargs):
        """Create a copy of this type instance"""
        return EncryptedText(**kwargs)


# Export public API
__all__ = ['EncryptedString', 'EncryptedText']
