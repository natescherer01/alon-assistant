/**
 * Validation utilities for form inputs
 */

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns True if email is valid
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

/**
 * Validates password strength
 * @param password - Password to validate
 * @returns Object with validation result and error messages
 */
export const validatePassword = (
  password: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validates name (first name or last name)
 * @param name - Name to validate
 * @returns True if name is valid
 */
export const validateName = (name: string): boolean => {
  const trimmedName = name.trim();
  return trimmedName.length >= 1 && trimmedName.length <= 50;
};

/**
 * Validates password confirmation matches original password
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns True if passwords match
 */
export const validatePasswordMatch = (
  password: string,
  confirmPassword: string
): boolean => {
  return password === confirmPassword && password.length > 0;
};
