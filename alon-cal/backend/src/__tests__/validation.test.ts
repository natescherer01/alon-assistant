/**
 * Validation Tests
 *
 * Test suite for input validation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateEmail,
  validatePassword,
  validateName,
  validateUUID,
  validateIPAddress,
  validateUserAgent,
  sanitizeInput,
  sanitizeObject,
} from '../utils/validation';
import { validEmails, invalidEmails } from './helpers/testData';

describe('Validation Utilities', () => {
  describe('sanitizeInput', () => {
    it('should escape HTML special characters', () => {
      const xss = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(xss);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;');
      expect(sanitized).toContain('&gt;');
    });

    it('should escape quotes', () => {
      expect(sanitizeInput('test"quotes"')).toContain('&quot;');
      expect(sanitizeInput("test'quotes'")).toContain('&#x27;');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  test  ')).toBe('test');
    });

    it('should remove null bytes', () => {
      expect(sanitizeInput('test\0data')).toBe('testdata');
    });

    it('should limit length to prevent buffer overflow', () => {
      const longString = 'a'.repeat(2000);
      const sanitized = sanitizeInput(longString);
      
      expect(sanitized.length).toBe(1000);
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(123 as any)).toBe('');
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      expect(validateName('John')).toBe('John');
      expect(validateName('Mary-Jane')).toBe('Mary-Jane');
      expect(validateName("O'Connor")).not.toBeNull();
      expect(validateName('Jean Paul')).not.toBeNull();
    });

    it('should reject invalid names', () => {
      expect(validateName('')).toBeNull();
      expect(validateName('   ')).toBeNull();
      expect(validateName('a'.repeat(101))).toBeNull(); // Too long
      expect(validateName('John123')).toBeNull(); // Numbers not allowed
      expect(validateName('John@Doe')).toBeNull(); // Special chars not allowed
    });

    it('should sanitize names', () => {
      const name = validateName('<script>alert()</script>');
      expect(name).toBeNull(); // Contains invalid characters
    });
  });

  describe('validateUUID', () => {
    it('should accept valid UUIDs', () => {
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validateUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(validateUUID('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(validateUUID('not-a-uuid')).toBe(false);
      expect(validateUUID('550e8400-e29b-41d4-a716')).toBe(false); // Too short
      expect(validateUUID('550e8400e29b41d4a716446655440000')).toBe(false); // No dashes
      expect(validateUUID('')).toBe(false);
      expect(validateUUID('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
    });
  });

  describe('validateIPAddress', () => {
    it('should accept valid IPv4 addresses', () => {
      expect(validateIPAddress('127.0.0.1')).toBe(true);
      expect(validateIPAddress('192.168.1.1')).toBe(true);
      expect(validateIPAddress('255.255.255.255')).toBe(true);
      expect(validateIPAddress('0.0.0.0')).toBe(true);
    });

    it('should accept valid IPv6 addresses', () => {
      expect(validateIPAddress('::1')).toBe(true);
      expect(validateIPAddress('::')).toBe(true);
    });

    it('should reject invalid IP addresses', () => {
      expect(validateIPAddress('256.256.256.256')).toBe(false);
      expect(validateIPAddress('192.168.1')).toBe(false);
      expect(validateIPAddress('not-an-ip')).toBe(false);
      expect(validateIPAddress('')).toBe(false);
    });
  });

  describe('validateUserAgent', () => {
    it('should accept valid user agents', () => {
      const validUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      expect(validateUserAgent(validUA)).toBe(true);
      
      const chromeUA = 'Chrome/120.0.0.0 Safari/537.36';
      expect(validateUserAgent(chromeUA)).toBe(true);
    });

    it('should reject invalid user agents', () => {
      expect(validateUserAgent('short')).toBe(false); // Too short
      expect(validateUserAgent('a'.repeat(501))).toBe(false); // Too long
      expect(validateUserAgent('NoKnownBrowser/1.0')).toBe(false); // No known pattern
      expect(validateUserAgent('')).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should remove null and undefined values', () => {
      const obj = {
        a: 'value',
        b: null,
        c: undefined,
        d: 0,
        e: false,
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized.a).toBe('value');
      expect(sanitized.b).toBeUndefined();
      expect(sanitized.c).toBeUndefined();
      expect(sanitized.d).toBe(0);
      expect(sanitized.e).toBe(false);
    });

    it('should sanitize string values', () => {
      const obj = {
        name: '<script>alert()</script>',
        age: 25,
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.name).toContain('&lt;');
      expect(sanitized.age).toBe(25);
    });
  });
});
