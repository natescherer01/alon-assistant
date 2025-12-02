/**
 * Frontend Validation Tests
 */

import { describe, it, expect } from 'vitest';
import { validateEmail, validatePassword, validateName, validatePasswordMatch } from '../../utils/validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('user @example.com')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(validateEmail('  user@example.com  ')).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const result = validatePassword('SecurePass123!');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = validatePassword('Pass1!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject passwords without uppercase', () => {
      const result = validatePassword('password123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase', () => {
      const result = validatePassword('PASSWORD123!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = validatePassword('Password!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject passwords without special characters', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should return multiple errors for very weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      expect(validateName('John')).toBe(true);
      expect(validateName('Mary Jane')).toBe(true);
      expect(validateName('A')).toBe(true);
    });

    it('should reject empty names', () => {
      expect(validateName('')).toBe(false);
      expect(validateName('   ')).toBe(false);
    });

    it('should reject names that are too long', () => {
      const longName = 'a'.repeat(51);
      expect(validateName(longName)).toBe(false);
    });

    it('should trim whitespace', () => {
      expect(validateName('  John  ')).toBe(true);
    });
  });

  describe('validatePasswordMatch', () => {
    it('should return true when passwords match', () => {
      expect(validatePasswordMatch('Password123!', 'Password123!')).toBe(true);
    });

    it('should return false when passwords do not match', () => {
      expect(validatePasswordMatch('Password123!', 'DifferentPass123!')).toBe(false);
    });

    it('should return false for empty passwords', () => {
      expect(validatePasswordMatch('', '')).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(validatePasswordMatch('Password123!', 'password123!')).toBe(false);
    });
  });
});
