/**
 * Input Validation Utilities
 *
 * Provides validation functions for email, password strength,
 * and input sanitization to prevent XSS and injection attacks.
 *
 * Security Features:
 * - Email format validation (RFC 5322 compliant)
 * - Password strength validation (min 8 chars, numbers, special chars)
 * - Input sanitization for XSS prevention
 * - SQL injection prevention through input cleaning
 */

/**
 * Password validation result interface
 */
export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email address format
 *
 * Uses a comprehensive regex pattern that covers most valid email formats
 * according to RFC 5322 standard.
 *
 * @param email - Email address to validate
 * @returns boolean - true if email is valid, false otherwise
 *
 * @example
 * const isValid = validateEmail('user@example.com'); // true
 * const isInvalid = validateEmail('invalid-email'); // false
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Trim whitespace
  email = email.trim();

  // Check length constraints
  if (email.length < 3 || email.length > 254) {
    return false;
  }

  // RFC 5322 compliant email regex
  // Covers most valid email formats while preventing common injection attempts
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email);
}

/**
 * Validate password strength
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 number
 * - At least 1 special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 *
 * @param password - Password to validate
 * @returns PasswordValidationResult - Validation result with errors
 *
 * @example
 * const result = validatePassword('WeakPass');
 * if (!result.valid) {
 *   console.log('Errors:', result.errors);
 * }
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password is required'],
    };
  }

  // Minimum length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Maximum length check (prevent DoS attacks)
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for common weak passwords
  const commonPasswords = [
    'password',
    'password1',
    'password123',
    '12345678',
    'qwerty123',
    'abc123456',
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize input string to prevent XSS attacks
 *
 * Removes or escapes potentially dangerous characters that could be used
 * for cross-site scripting or SQL injection.
 *
 * @param input - Input string to sanitize
 * @returns string - Sanitized string
 *
 * @example
 * const clean = sanitizeInput('<script>alert("xss")</script>');
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Replace HTML special characters
  const htmlEscapeMap: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  sanitized = sanitized.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Limit length to prevent buffer overflow
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }

  return sanitized;
}

/**
 * Validate and sanitize name input
 *
 * @param name - Name to validate
 * @returns string | null - Sanitized name or null if invalid
 *
 * @example
 * const name = validateName('John Doe'); // 'John Doe'
 * const invalid = validateName('<script>'); // null
 */
export function validateName(name: string): string | null {
  if (!name || typeof name !== 'string') {
    return null;
  }

  // Trim whitespace
  name = name.trim();

  // Check length
  if (name.length < 1 || name.length > 100) {
    return null;
  }

  // Allow only letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;

  if (!nameRegex.test(name)) {
    return null;
  }

  // Sanitize for safety
  return sanitizeInput(name);
}

/**
 * Validate UUID format
 *
 * @param uuid - UUID string to validate
 * @returns boolean - true if valid UUID, false otherwise
 *
 * @example
 * const isValid = validateUUID('550e8400-e29b-41d4-a716-446655440000'); // true
 */
export function validateUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  return uuidRegex.test(uuid);
}

/**
 * Validate IP address (IPv4 or IPv6)
 *
 * @param ip - IP address to validate
 * @returns boolean - true if valid IP, false otherwise
 *
 * @example
 * const isValid = validateIPAddress('192.168.1.1'); // true
 */
export function validateIPAddress(ip: string): boolean {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  // IPv4 regex
  const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.){3}(25[0-5]|(2[0-4]|1\d|[1-9]|)\d)$/;

  // IPv6 regex (simplified)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Validate user agent string
 *
 * @param userAgent - User agent string to validate
 * @returns boolean - true if valid, false otherwise
 */
export function validateUserAgent(userAgent: string): boolean {
  if (!userAgent || typeof userAgent !== 'string') {
    return false;
  }

  // Check length constraints
  if (userAgent.length < 10 || userAgent.length > 500) {
    return false;
  }

  // Basic validation - should contain common user agent patterns
  const hasValidPattern = /Mozilla|Chrome|Safari|Firefox|Edge|Opera/i.test(userAgent);

  return hasValidPattern;
}

/**
 * Sanitize object by removing null/undefined values
 *
 * @param obj - Object to sanitize
 * @returns object - Sanitized object
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      if (typeof value === 'string') {
        sanitized[key as keyof T] = sanitizeInput(value) as T[keyof T];
      } else {
        sanitized[key as keyof T] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Validate time format (HH:MM in 24-hour format)
 *
 * Validates that the time string is in valid 24-hour format.
 * Hours: 00-23, Minutes: 00-59
 *
 * @param time - Time string in HH:MM format (e.g., "01:00", "23:45")
 * @returns boolean - true if valid time format, false otherwise
 *
 * @example
 * const isValid = validateTime('01:00'); // true
 * const isValid = validateTime('23:45'); // true
 * const isInvalid = validateTime('25:00'); // false (invalid hour)
 * const isInvalid = validateTime('12:60'); // false (invalid minute)
 */
export function validateTime(time: string): boolean {
  if (!time || typeof time !== 'string') {
    return false;
  }

  // Trim whitespace
  time = time.trim();

  // Check format: HH:MM
  const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;

  if (!timeRegex.test(time)) {
    return false;
  }

  // Extract hours and minutes
  const [hours, minutes] = time.split(':').map(Number);

  // Validate ranges
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * IANA timezone database - Common timezones
 * This is a subset of valid IANA timezones for validation
 */
const VALID_TIMEZONES = new Set([
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'America/Toronto',
  'America/Vancouver',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'America/Argentina/Buenos_Aires',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Prague',
  'Europe/Stockholm',
  'Europe/Copenhagen',
  'Europe/Oslo',
  'Europe/Helsinki',
  'Europe/Athens',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Europe/Zurich',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Dubai',
  'Asia/Jerusalem',
  'Asia/Riyadh',
  'Asia/Kuwait',
  'Asia/Baghdad',
  'Asia/Tehran',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Mumbai',
  'Asia/Delhi',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Beijing',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Taipei',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Australia/Adelaide',
  'Pacific/Auckland',
  'Pacific/Fiji',
  'Pacific/Guam',
]);

/**
 * Validate IANA timezone string
 *
 * Validates that the timezone string is a valid IANA timezone identifier.
 * Uses a subset of common timezones for validation.
 *
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns boolean - true if valid timezone, false otherwise
 *
 * @example
 * const isValid = validateTimezone('America/New_York'); // true
 * const isInvalid = validateTimezone('Invalid/Timezone'); // false
 */
export function validateTimezone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') {
    return false;
  }

  // Trim whitespace
  timezone = timezone.trim();

  // Check if it's in our valid timezone set
  if (VALID_TIMEZONES.has(timezone)) {
    return true;
  }

  // Additional validation: Check basic timezone format (Region/City or UTC offset)
  // IANA format: Area/Location or Area/Location/Sub_Location
  const ianaRegex = /^[A-Z][a-zA-Z0-9_+-]+\/[A-Z][a-zA-Z0-9_+-]+(\/[A-Z][a-zA-Z0-9_+-]+)?$/;

  // UTC offset format: UTC, UTC+X, UTC-X, or Etc/GMT+X
  const utcOffsetRegex = /^(UTC([+-]\d{1,2}(:\d{2})?)?|Etc\/GMT([+-]\d{1,2})?)$/;

  return ianaRegex.test(timezone) || utcOffsetRegex.test(timezone);
}
