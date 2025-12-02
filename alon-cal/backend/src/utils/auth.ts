/**
 * Authentication Utilities
 *
 * Core authentication functions for password hashing, JWT generation/verification,
 * and token management.
 *
 * Security Features:
 * - bcrypt with 12 salt rounds for password hashing
 * - JWT tokens with 24-hour expiration
 * - Refresh tokens with 7-day expiration
 * - Secure token verification with error handling
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h'; // Access token expires in 24 hours
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Refresh token expires in 7 days

/**
 * JWT Payload Interface
 */
export interface JWTPayload {
  userId: string;
  email: string;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Hash a password using bcrypt
 *
 * @param password - Plain text password to hash
 * @returns Promise<string> - Hashed password
 * @throws Error if hashing fails
 *
 * @example
 * const hash = await hashPassword('MySecurePassword123!');
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare a plain text password with a hashed password
 *
 * @param password - Plain text password to verify
 * @param hash - Hashed password to compare against
 * @returns Promise<boolean> - true if passwords match, false otherwise
 *
 * @example
 * const isValid = await comparePassword('MyPassword123!', hashedPassword);
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

/**
 * Generate a JWT access token
 *
 * @param userId - User's unique identifier
 * @param email - User's email address
 * @returns string - Signed JWT token
 *
 * @example
 * const token = generateJWT('user-uuid', 'user@example.com');
 */
export function generateJWT(userId: string, email: string): string {
  const payload: JWTPayload = {
    userId,
    email,
    type: 'access',
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return token;
}

/**
 * Generate a refresh token
 *
 * @param userId - User's unique identifier
 * @returns string - Signed refresh token
 *
 * @example
 * const refreshToken = generateRefreshToken('user-uuid');
 */
export function generateRefreshToken(userId: string): string {
  const payload: JWTPayload = {
    userId,
    email: '', // Not needed for refresh token
    type: 'refresh',
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  return token;
}

/**
 * Verify and decode a JWT token
 *
 * @param token - JWT token to verify
 * @returns JWTPayload | null - Decoded payload or null if invalid
 *
 * @example
 * const payload = verifyJWT(token);
 * if (payload) {
 *   console.log('User ID:', payload.userId);
 * }
 */
export function verifyJWT(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.log('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.log('Invalid token');
    } else {
      console.error('Token verification error:', error);
    }
    return null;
  }
}

/**
 * Verify a refresh token
 *
 * @param token - Refresh token to verify
 * @returns JWTPayload | null - Decoded payload or null if invalid
 *
 * @example
 * const payload = verifyRefreshToken(refreshToken);
 * if (payload && payload.type === 'refresh') {
 *   // Generate new access token
 * }
 */
export function verifyRefreshToken(token: string): JWTPayload | null {
  const payload = verifyJWT(token);

  if (payload && payload.type === 'refresh') {
    return payload;
  }

  return null;
}

/**
 * Generate a hash for storing token references in database
 * Used for session management and token revocation
 *
 * @param token - Token to hash
 * @returns Promise<string> - SHA-256 hash of token
 *
 * @example
 * const tokenHash = await generateTokenHash(jwtToken);
 */
export async function generateTokenHash(token: string): Promise<string> {
  // Use first 64 characters of bcrypt hash as token identifier
  // This is sufficient for session tracking without storing the actual token
  const hash = await bcrypt.hash(token, 6); // Lower rounds for faster lookup
  return hash.substring(0, 64);
}

/**
 * Extract token from Authorization header
 *
 * @param authHeader - Authorization header value
 * @returns string | null - Extracted token or null if invalid format
 *
 * @example
 * const token = extractTokenFromHeader(req.headers.authorization);
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get token expiration date
 *
 * @param expiresIn - Expiration duration (e.g., '24h', '7d')
 * @returns Date - Expiration date
 *
 * @example
 * const expiresAt = getTokenExpiration('24h');
 */
export function getTokenExpiration(expiresIn: string): Date {
  const now = new Date();

  // Parse expiration string (e.g., '24h', '7d')
  const match = expiresIn.match(/^(\d+)([dhms])$/);

  if (!match) {
    // Default to 24 hours if invalid format
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  let milliseconds = 0;

  switch (unit) {
    case 'd':
      milliseconds = value * 24 * 60 * 60 * 1000;
      break;
    case 'h':
      milliseconds = value * 60 * 60 * 1000;
      break;
    case 'm':
      milliseconds = value * 60 * 1000;
      break;
    case 's':
      milliseconds = value * 1000;
      break;
    default:
      milliseconds = 24 * 60 * 60 * 1000; // Default 24 hours
  }

  return new Date(now.getTime() + milliseconds);
}

/**
 * Get access token expiration date (24 hours)
 */
export function getAccessTokenExpiration(): Date {
  return getTokenExpiration(JWT_EXPIRES_IN);
}

/**
 * Get refresh token expiration date (7 days)
 */
export function getRefreshTokenExpiration(): Date {
  return getTokenExpiration(REFRESH_TOKEN_EXPIRES_IN);
}
