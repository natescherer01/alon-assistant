/**
 * Encryption Utilities
 *
 * Provides AES-256-GCM encryption/decryption for sensitive data
 * such as OAuth access tokens and refresh tokens.
 *
 * Security Features:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Random IV (Initialization Vector) for each encryption
 * - Authentication tag for integrity verification
 * - Base64 encoding for storage
 *
 * Environment Variables Required:
 * - ENCRYPTION_KEY: 32-character string (256 bits)
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

/**
 * Get encryption key as Buffer
 *
 * @returns Buffer - Encryption key
 * @throws Error if encryption key is not configured
 */
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // SECURITY: Enforce exactly 32 characters - no padding allowed
  if (ENCRYPTION_KEY.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 characters (256 bits). Current length: ${ENCRYPTION_KEY.length}`
    );
  }

  // Validate key has sufficient entropy (basic check)
  const uniqueChars = new Set(ENCRYPTION_KEY).size;
  if (uniqueChars < 10) {
    throw new Error(
      'ENCRYPTION_KEY appears to have low entropy. Use a cryptographically secure random key.'
    );
  }

  // Convert string to 32-byte buffer (no padding)
  return Buffer.from(ENCRYPTION_KEY, 'utf-8');
}

/**
 * Encrypt a token using AES-256-GCM
 *
 * @param token - Token to encrypt (OAuth access token, refresh token, etc.)
 * @returns string - Encrypted text in format: iv:encrypted:tag (base64 encoded)
 * @throws Error if encryption fails
 *
 * @example
 * const encrypted = encryptToken('oauth-access-token-xyz');
 * // Returns: "base64_iv:base64_encrypted:base64_tag"
 */
export function encryptToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token for encryption');
  }

  try {
    const key = getEncryptionKey();

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    let encrypted = cipher.update(token, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Return iv:encrypted:tag format (all base64 encoded)
    return `${iv.toString('base64')}:${encrypted}:${tag.toString('base64')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt a token using AES-256-GCM
 *
 * @param encryptedData - Encrypted text in format: iv:encrypted:tag (base64 encoded)
 * @returns string - Decrypted token
 * @throws Error if decryption fails
 *
 * @example
 * const decrypted = decryptToken(encryptedToken);
 * // Returns: "oauth-access-token-xyz"
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('Invalid encrypted data for decryption');
  }

  try {
    const key = getEncryptionKey();

    // Split encrypted data into components
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivBase64, encryptedBase64, tagBase64] = parts;

    // Convert from base64
    const iv = Buffer.from(ivBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }

    if (tag.length !== TAG_LENGTH) {
      throw new Error('Invalid authentication tag length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    let decrypted = decipher.update(encrypted.toString('base64'), 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Hash a string using SHA-256
 *
 * Useful for creating non-reversible hashes for comparison
 * (e.g., session token hashes)
 *
 * @param data - Data to hash
 * @returns string - SHA-256 hash (hex encoded)
 *
 * @example
 * const hash = hashSHA256('sensitive-data');
 */
export function hashSHA256(data: string): string {
  if (!data || typeof data !== 'string') {
    throw new Error('Invalid data for hashing');
  }

  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a cryptographically secure random token
 *
 * @param length - Length of token in bytes (default: 32)
 * @returns string - Random token (hex encoded)
 *
 * @example
 * const token = generateSecureToken(32);
 * // Returns: 64-character hex string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a random encryption key
 *
 * Use this to generate a new ENCRYPTION_KEY for .env file
 * WARNING: Only use during initial setup, never in production code
 *
 * @returns string - 32-character random key
 *
 * @example
 * const newKey = generateEncryptionKey();
 * console.log('Add to .env: ENCRYPTION_KEY=' + newKey);
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex').substring(0, 32);
}

/**
 * Verify encryption key is properly configured
 *
 * @returns boolean - true if key is valid, false otherwise
 */
export function verifyEncryptionKey(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Test encryption/decryption roundtrip
 *
 * @returns boolean - true if encryption is working correctly
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-encryption-data-' + Date.now();
    const encrypted = encryptToken(testData);
    const decrypted = decryptToken(encrypted);

    return testData === decrypted;
  } catch {
    return false;
  }
}
