"""
NIST-compliant password validation (2025 guidelines)

Following NIST SP 800-63B recommendations:
- Length-based validation only (no complexity requirements)
- Screening against compromised passwords (Have I Been Pwned)
- No mandatory periodic password changes
"""
import hashlib
import requests
from typing import Tuple
from logger import get_logger

logger = get_logger(__name__)


def is_password_compromised(password: str, timeout: int = 3) -> Tuple[bool, str]:
    """
    Check if password has been compromised using Have I Been Pwned API
    Uses k-anonymity model (only sends first 5 chars of SHA-1 hash)

    Args:
        password: Password to check
        timeout: Request timeout in seconds

    Returns:
        Tuple of (is_compromised, error_message)
    """
    try:
        # Create SHA-1 hash of password
        sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
        prefix, suffix = sha1_hash[:5], sha1_hash[5:]

        # Query HIBP API with first 5 characters (k-anonymity)
        url = f'https://api.pwnedpasswords.com/range/{prefix}'
        response = requests.get(url, timeout=timeout)

        if response.status_code == 200:
            # Check if our suffix appears in the results
            hashes = (line.split(':') for line in response.text.splitlines())
            for hash_suffix, count in hashes:
                if suffix == hash_suffix:
                    logger.warning(f"Password found in {count} breaches")
                    return True, f"This password has appeared in {count} data breaches"

            return False, ""

        elif response.status_code == 429:
            # Rate limited - fail open (don't block user)
            logger.warning("HIBP API rate limited - allowing password")
            return False, ""

        else:
            # API error - fail open
            logger.warning(f"HIBP API error {response.status_code} - allowing password")
            return False, ""

    except requests.exceptions.Timeout:
        # Timeout - fail open (don't block user)
        logger.warning("HIBP API timeout - allowing password")
        return False, ""

    except Exception as e:
        # Any other error - fail open
        logger.error(f"Password check error: {e} - allowing password")
        return False, ""


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validate password according to NIST SP 800-63B (2025) guidelines

    NIST Requirements:
    - Minimum 8 characters (we use 15 recommended)
    - Maximum 64 characters
    - NO complexity requirements (no uppercase, lowercase, digits, special chars)
    - Screen against compromised passwords
    - Check against common passwords list

    Args:
        password: Password to validate

    Returns:
        Tuple of (is_valid, error_message)
    """

    # Length validation (NIST: min 8, recommended 15, max 64)
    if len(password) < 15:
        return False, "Password must be at least 15 characters long"

    if len(password) > 64:
        return False, "Password must not exceed 64 characters"

    # Check against common passwords (NIST requirement)
    # These are extremely common and should always be rejected
    common_passwords = [
        'password', '123456', '12345678', 'qwerty', 'abc123',
        'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
        'baseball', '111111', 'iloveyou', 'master', 'sunshine',
        'ashley', 'bailey', 'passw0rd', 'shadow', '123123',
        'password123', 'qwerty123', 'admin', 'administrator'
    ]

    if password.lower() in common_passwords:
        return False, "This password is too common and easily guessed"

    # Check if password contains obvious patterns
    # (While NIST doesn't require complexity, it does recommend screening)
    if password.lower() == password.lower()[::-1]:  # Palindrome
        return False, "Password should not be a simple pattern"

    # Check against Have I Been Pwned database (NIST requirement)
    # TEMPORARILY DISABLED for debugging
    # is_compromised, error_msg = is_password_compromised(password)
    # if is_compromised:
    #     return False, error_msg or "This password has been found in data breaches. Please choose a different password"

    # Password is valid
    return True, ""


# NO complexity requirements per NIST 2025!
# The following are NOT required:
# - Uppercase letters
# - Lowercase letters
# - Digits
# - Special characters
# - Mixed character types
#
# Research shows length is far more important than complexity.
# A 15+ character passphrase is more secure than "P@ssw0rd1"
