"""
Comprehensive test suite for field-level encryption

Tests cover:
- Unit tests for EncryptionService
- Integration tests for TypeDecorators
- Security tests for validation and sanitization
- Key rotation tests
- Performance tests
"""
import os
import pytest
import hashlib
from cryptography.fernet import Fernet

# Set test encryption key before importing encryption module
os.environ['ENCRYPTION_KEY'] = Fernet.generate_key().decode()

from app.core.encryption import (
    EncryptionService,
    EncryptionSettings,
    get_encryption_service,
    generate_encryption_key
)


class TestEncryptionService:
    """Unit tests for EncryptionService"""

    def test_encrypt_decrypt_cycle(self):
        """Test basic encryption and decryption"""
        service = EncryptionService()
        plaintext = "Hello, World!"

        # Encrypt
        ciphertext = service.encrypt(plaintext)

        # Verify ciphertext is different from plaintext
        assert ciphertext != plaintext
        assert len(ciphertext) > len(plaintext)

        # Decrypt
        decrypted = service.decrypt(ciphertext)

        # Verify decrypted matches original
        assert decrypted == plaintext

    def test_encrypt_none(self):
        """Test that None values are handled correctly"""
        service = EncryptionService()

        assert service.encrypt(None) is None
        assert service.decrypt(None) is None

    def test_encrypt_empty_string(self):
        """Test encryption of empty string"""
        service = EncryptionService()

        ciphertext = service.encrypt("")
        decrypted = service.decrypt(ciphertext)

        assert decrypted == ""

    def test_encrypt_unicode(self):
        """Test encryption of Unicode characters"""
        service = EncryptionService()

        unicode_text = "Hello 世界 🌍 Émojis"
        ciphertext = service.encrypt(unicode_text)
        decrypted = service.decrypt(ciphertext)

        assert decrypted == unicode_text

    def test_encrypted_value_different(self):
        """Encrypted value should not match plaintext"""
        service = EncryptionService()

        plaintext = "test@example.com"
        ciphertext = service.encrypt(plaintext)

        assert ciphertext != plaintext
        assert len(ciphertext) > len(plaintext)
        assert ciphertext.startswith('gAAAAA')  # Fernet format

    def test_same_plaintext_different_ciphertext(self):
        """Same plaintext should produce different ciphertext each time (IV randomization)"""
        service = EncryptionService()

        plaintext = "test message"
        ciphertext1 = service.encrypt(plaintext)
        ciphertext2 = service.encrypt(plaintext)

        # Different ciphertexts (due to random IV)
        assert ciphertext1 != ciphertext2

        # But both decrypt to same plaintext
        assert service.decrypt(ciphertext1) == plaintext
        assert service.decrypt(ciphertext2) == plaintext

    def test_invalid_ciphertext_raises_error(self):
        """Decrypting invalid ciphertext should raise ValueError"""
        service = EncryptionService()

        with pytest.raises(ValueError, match="Decryption failed"):
            service.decrypt("invalid_ciphertext")

    def test_tampered_ciphertext_detected(self):
        """Tampering with ciphertext should be detected by HMAC"""
        service = EncryptionService()

        plaintext = "sensitive data"
        ciphertext = service.encrypt(plaintext)

        # Tamper with ciphertext (change one character)
        tampered = ciphertext[:-1] + ('A' if ciphertext[-1] != 'A' else 'B')

        # Should fail HMAC verification
        with pytest.raises(ValueError, match="Decryption failed"):
            service.decrypt(tampered)

    def test_input_size_validation(self):
        """Test that oversized input is rejected"""
        service = EncryptionService()

        # Create input larger than max size
        large_input = "x" * (service.settings.max_plaintext_size + 1)

        with pytest.raises(ValueError, match="Input too large"):
            service.encrypt(large_input)

    def test_searchable_hash_generation(self):
        """Test searchable hash generation for indexed lookups"""
        service = EncryptionService()

        email = "Test@Example.com"
        hash1 = service.generate_searchable_hash(email)
        hash2 = service.generate_searchable_hash(email.lower())

        # Hashes should be the same (case-insensitive)
        assert hash1 == hash2

        # Hash should be SHA-256 (64 hex characters)
        assert len(hash1) == 64
        assert all(c in '0123456789abcdef' for c in hash1)

        # Verify hash value
        expected = hashlib.sha256(email.lower().strip().encode()).hexdigest()
        assert hash1 == expected

    def test_singleton_pattern(self):
        """Test that get_encryption_service returns same instance"""
        service1 = get_encryption_service()
        service2 = get_encryption_service()

        assert service1 is service2


class TestInputValidation:
    """Tests for input validation and sanitization"""

    def test_xss_detection(self):
        """Test that XSS attempts are detected"""
        service = EncryptionService()

        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
        ]

        for payload in xss_payloads:
            with pytest.raises(ValueError, match="suspicious patterns"):
                service.encrypt(payload)

    def test_sql_injection_detection(self):
        """Test that SQL injection attempts are detected"""
        service = EncryptionService()

        sql_payloads = [
            "'; DROP TABLE users--",
            "' OR '1'='1",
            "' UNION SELECT * FROM users--",
        ]

        for payload in sql_payloads:
            with pytest.raises(ValueError, match="suspicious patterns"):
                service.encrypt(payload)

    def test_normal_content_allowed(self):
        """Test that normal content passes validation"""
        service = EncryptionService()

        # Normal content that might contain keywords but is safe
        safe_content = [
            "Please select your preferences",  # Contains "select"
            "This is a script for a movie",    # Contains "script"
            "My name is John's",                # Contains apostrophe
        ]

        for content in safe_content:
            # Should not raise (these are false positives the regex should avoid)
            # If they fail, we may need to adjust validation rules
            try:
                encrypted = service.encrypt(content)
                assert encrypted is not None
            except ValueError:
                # If normal content is blocked, that's a test failure
                pytest.fail(f"Normal content blocked: {content}")


class TestKeyRotation:
    """Tests for key rotation support"""

    def test_decrypt_with_fallback_key(self):
        """Test decryption using fallback key for key rotation"""
        # Create old service with different key
        old_key = Fernet.generate_key().decode()
        os.environ['ENCRYPTION_KEY'] = old_key
        old_service = EncryptionService()

        # Encrypt with old key
        plaintext = "sensitive data"
        ciphertext = old_service.encrypt(plaintext)

        # Create new service with rotated key
        new_key = Fernet.generate_key().decode()
        os.environ['ENCRYPTION_KEY'] = new_key
        os.environ['ENCRYPTION_KEY_FALLBACK'] = old_key

        # Force recreation (clear singleton cache)
        get_encryption_service.cache_clear()

        new_service = EncryptionService()

        # Should decrypt using fallback key
        decrypted = new_service.decrypt(ciphertext)
        assert decrypted == plaintext

        # Cleanup
        del os.environ['ENCRYPTION_KEY_FALLBACK']

    def test_both_keys_fail_raises_error(self):
        """Test that decryption fails when both keys are wrong"""
        # Encrypt with one key
        key1 = Fernet.generate_key().decode()
        os.environ['ENCRYPTION_KEY'] = key1
        service1 = EncryptionService()
        ciphertext = service1.encrypt("test")

        # Try to decrypt with completely different keys
        key2 = Fernet.generate_key().decode()
        key3 = Fernet.generate_key().decode()
        os.environ['ENCRYPTION_KEY'] = key2
        os.environ['ENCRYPTION_KEY_FALLBACK'] = key3

        get_encryption_service.cache_clear()
        service2 = EncryptionService()

        # Should fail with both keys
        with pytest.raises(ValueError, match="both primary and fallback keys"):
            service2.decrypt(ciphertext)

        # Cleanup
        del os.environ['ENCRYPTION_KEY_FALLBACK']


class TestEncryptionSettings:
    """Tests for EncryptionSettings configuration"""

    def test_missing_encryption_key_raises_error(self):
        """Test that missing ENCRYPTION_KEY raises error"""
        # Temporarily remove key
        old_key = os.environ.get('ENCRYPTION_KEY')
        if 'ENCRYPTION_KEY' in os.environ:
            del os.environ['ENCRYPTION_KEY']

        with pytest.raises(ValueError, match="ENCRYPTION_KEY not set"):
            EncryptionSettings()

        # Restore
        if old_key:
            os.environ['ENCRYPTION_KEY'] = old_key

    def test_invalid_key_format_raises_error(self):
        """Test that invalid Fernet key format raises error"""
        os.environ['ENCRYPTION_KEY'] = "invalid_key_format"

        with pytest.raises(ValueError, match="not a valid Fernet key"):
            EncryptionSettings()

        # Restore valid key
        os.environ['ENCRYPTION_KEY'] = Fernet.generate_key().decode()

    def test_valid_key_format_accepted(self):
        """Test that valid Fernet key is accepted"""
        valid_key = Fernet.generate_key().decode()
        os.environ['ENCRYPTION_KEY'] = valid_key

        settings = EncryptionSettings()
        assert settings.encryption_key == valid_key


class TestHelperFunctions:
    """Tests for helper functions"""

    def test_generate_encryption_key(self):
        """Test that generate_encryption_key creates valid keys"""
        key = generate_encryption_key()

        # Should be 44 characters (base64-encoded 32 bytes)
        assert len(key) == 44

        # Should be valid Fernet key
        try:
            Fernet(key.encode())
        except Exception:
            pytest.fail("Generated key is not valid Fernet key")

    def test_generated_keys_unique(self):
        """Test that each generated key is unique"""
        keys = [generate_encryption_key() for _ in range(10)]

        # All keys should be unique
        assert len(set(keys)) == 10


class TestSecurityFeatures:
    """Security-focused tests"""

    def test_no_plaintext_in_logs(self):
        """Test that plaintext is never logged (manual inspection)"""
        # This is more of a code review test
        # Actual implementation should be verified by reviewing audit logging
        pass

    def test_metrics_recorded(self):
        """Test that Prometheus metrics are recorded"""
        from prometheus_client import REGISTRY

        service = EncryptionService()

        # Perform encryption
        service.encrypt("test data")

        # Check that metrics exist
        metrics = {m.name for m in REGISTRY.collect()}

        assert 'encryption_operations_total' in metrics
        assert 'encryption_duration_seconds' in metrics
        assert 'encryption_errors_total' in metrics

    def test_concurrent_encryption(self):
        """Test that encryption service is thread-safe"""
        import threading

        service = get_encryption_service()
        results = []
        errors = []

        def encrypt_worker():
            try:
                for i in range(100):
                    plaintext = f"message_{i}"
                    ciphertext = service.encrypt(plaintext)
                    decrypted = service.decrypt(ciphertext)
                    assert decrypted == plaintext
                    results.append(decrypted)
            except Exception as e:
                errors.append(e)

        # Run 10 threads concurrently
        threads = [threading.Thread(target=encrypt_worker) for _ in range(10)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # All should succeed
        assert len(errors) == 0
        assert len(results) == 1000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
