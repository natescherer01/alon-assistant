/**
 * Encryption Utilities Tests
 *
 * Tests for token encryption/decryption and security utilities
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  encryptToken,
  decryptToken,
  hashSHA256,
  generateSecureToken,
  verifyEncryptionKey,
  testEncryption,
} from '../../src/utils/encryption';

describe('Encryption Utilities', () => {
  beforeAll(() => {
    // Ensure encryption key is set (from setup.ts)
    expect(process.env.ENCRYPTION_KEY).toBeDefined();
  });

  describe('encryptToken', () => {
    it('should encrypt a token', () => {
      const token = 'test_access_token_123';
      const encrypted = encryptToken(token);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(token);
      expect(encrypted).toContain(':'); // Format: iv:encrypted:tag
    });

    it('should produce different ciphertexts for same input (random IV)', () => {
      const token = 'test_token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2); // Different due to random IV
    });

    it('should throw error for invalid token', () => {
      expect(() => encryptToken('')).toThrow('Invalid token for encryption');
      expect(() => encryptToken(null as any)).toThrow('Invalid token for encryption');
      expect(() => encryptToken(undefined as any)).toThrow('Invalid token for encryption');
    });

    it('should encrypt long tokens', () => {
      const longToken = 'A'.repeat(10000);
      const encrypted = encryptToken(longToken);

      expect(encrypted).toBeDefined();
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const specialToken = 'token-with-special!@#$%^&*()_+{}|:"<>?[];,./';
      const encrypted = encryptToken(specialToken);

      expect(encrypted).toBeDefined();
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(specialToken);
    });

    it('should handle unicode characters', () => {
      const unicodeToken = 'token-with-emoji-😀-and-中文';
      const encrypted = encryptToken(unicodeToken);

      expect(encrypted).toBeDefined();
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(unicodeToken);
    });
  });

  describe('decryptToken', () => {
    it('should decrypt an encrypted token', () => {
      const originalToken = 'test_access_token_123';
      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decryptToken('invalid_format')).toThrow('Invalid encrypted data format');
      expect(() => decryptToken('only:two:parts')).toBe; // Should work with 3 parts
      expect(() => decryptToken('too:many:parts:here')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for corrupted data', () => {
      const encrypted = encryptToken('token');
      const corrupted = encrypted.replace(/./g, 'X'); // Corrupt the data

      expect(() => decryptToken(corrupted)).toThrow('Failed to decrypt token');
    });

    it('should throw error for tampered authentication tag', () => {
      const encrypted = encryptToken('token');
      const parts = encrypted.split(':');
      parts[2] = 'tampered_tag_here'; // Tamper with auth tag
      const tampered = parts.join(':');

      expect(() => decryptToken(tampered)).toThrow('Failed to decrypt token');
    });

    it('should throw error for invalid IV length', () => {
      const invalidIv = 'shortIV:encrypted:tag';

      expect(() => decryptToken(invalidIv)).toThrow();
    });

    it('should throw error for empty encrypted data', () => {
      expect(() => decryptToken('')).toThrow('Invalid encrypted data for decryption');
      expect(() => decryptToken(null as any)).toThrow('Invalid encrypted data for decryption');
    });
  });

  describe('Encryption Round-trip', () => {
    const testCases = [
      'simple_token',
      'token-with-dashes',
      'token_with_underscores',
      'TokenWithMixedCase123',
      'very_long_token_' + 'A'.repeat(1000),
      'token.with.dots',
      'token/with/slashes',
      'token=with=equals',
      '😀🎉🚀', // Emojis
      '中文日本語한국어', // Asian characters
    ];

    testCases.forEach((testToken) => {
      it(`should correctly encrypt and decrypt: "${testToken.substring(0, 50)}..."`, () => {
        const encrypted = encryptToken(testToken);
        const decrypted = decryptToken(encrypted);

        expect(decrypted).toBe(testToken);
      });
    });
  });

  describe('hashSHA256', () => {
    it('should create SHA-256 hash', () => {
      const data = 'test_data';
      const hash = hashSHA256(data);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent hashes for same input', () => {
      const data = 'test_data';
      const hash1 = hashSHA256(data);
      const hash2 = hashSHA256(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different input', () => {
      const hash1 = hashSHA256('data1');
      const hash2 = hashSHA256('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for invalid data', () => {
      expect(() => hashSHA256('')).toThrow('Invalid data for hashing');
      expect(() => hashSHA256(null as any)).toThrow('Invalid data for hashing');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate random token of default length', () => {
      const token = generateSecureToken();

      expect(token).toBeDefined();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate random token of custom length', () => {
      const token = generateSecureToken(16);

      expect(token).toHaveLength(32); // 16 bytes = 32 hex characters
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of various lengths', () => {
      const lengths = [8, 16, 32, 64, 128];

      lengths.forEach((length) => {
        const token = generateSecureToken(length);
        expect(token).toHaveLength(length * 2); // bytes * 2 for hex
      });
    });
  });

  describe('verifyEncryptionKey', () => {
    it('should verify valid encryption key', () => {
      const isValid = verifyEncryptionKey();

      expect(isValid).toBe(true);
    });

    it('should return false for missing encryption key', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = '';

      const isValid = verifyEncryptionKey();

      expect(isValid).toBe(false);

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('should return false for invalid key length', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'short'; // Less than 32 characters

      const isValid = verifyEncryptionKey();

      expect(isValid).toBe(false);

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('testEncryption', () => {
    it('should pass encryption test', () => {
      const result = testEncryption();

      expect(result).toBe(true);
    });

    it('should fail with invalid encryption key', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = '';

      const result = testEncryption();

      expect(result).toBe(false);

      // Restore key
      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('Security Properties', () => {
    it('should not leak plaintext in encrypted output', () => {
      const plaintext = 'secret_password_123';
      const encrypted = encryptToken(plaintext);

      expect(encrypted).not.toContain(plaintext);
      expect(encrypted.toLowerCase()).not.toContain('secret');
      expect(encrypted.toLowerCase()).not.toContain('password');
    });

    it('should use authenticated encryption (GCM mode)', () => {
      const token = 'test_token';
      const encrypted = encryptToken(token);
      const parts = encrypted.split(':');

      // Should have IV, ciphertext, and auth tag
      expect(parts).toHaveLength(3);
      expect(parts[2]).toBeDefined(); // Auth tag present
    });

    it('should fail decryption with modified ciphertext', () => {
      const encrypted = encryptToken('token');
      const parts = encrypted.split(':');

      // Modify the ciphertext (middle part)
      const modified = Buffer.from(parts[1], 'base64');
      modified[0] = modified[0] ^ 0xFF; // Flip bits
      parts[1] = modified.toString('base64');

      const tamperedEncrypted = parts.join(':');

      expect(() => decryptToken(tamperedEncrypted)).toThrow();
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt within reasonable time', () => {
      const token = 'test_token_' + 'A'.repeat(1000);

      const encryptStart = Date.now();
      const encrypted = encryptToken(token);
      const encryptTime = Date.now() - encryptStart;

      const decryptStart = Date.now();
      const decrypted = decryptToken(encrypted);
      const decryptTime = Date.now() - decryptStart;

      expect(encryptTime).toBeLessThan(100); // Less than 100ms
      expect(decryptTime).toBeLessThan(100);
      expect(decrypted).toBe(token);
    });

    it('should handle bulk encryption efficiently', () => {
      const tokens = Array.from({ length: 100 }, (_, i) => `token_${i}`);

      const start = Date.now();
      const encrypted = tokens.map(encryptToken);
      const time = Date.now() - start;

      expect(time).toBeLessThan(1000); // 100 encryptions in less than 1 second
      expect(encrypted).toHaveLength(100);

      // Verify all can be decrypted
      const decrypted = encrypted.map(decryptToken);
      expect(decrypted).toEqual(tokens);
    });
  });
});
