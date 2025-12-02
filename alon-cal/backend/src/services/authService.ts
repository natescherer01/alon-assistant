/**
 * Authentication Service
 *
 * Core business logic for user authentication, registration, and session management.
 *
 * Features:
 * - User signup with password hashing
 * - User login with credentials verification
 * - Token generation (access + refresh)
 * - Session management
 * - Audit logging for all auth events
 * - Soft delete prevention
 */

import { User, Session } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  comparePassword,
  generateJWT,
  generateRefreshToken,
  getAccessTokenExpiration,
  getRefreshTokenExpiration,
} from '../utils/auth';
import { hashSHA256 } from '../utils/encryption';
import { validateEmail, validatePassword, sanitizeInput } from '../utils/validation';

/**
 * Signup result interface
 */
export interface SignupResult {
  user: User;
  token: string;
  refreshToken: string;
}

/**
 * Login result interface
 */
export interface LoginResult {
  user: User;
  token: string;
  refreshToken: string;
}

/**
 * Authentication Service Class
 *
 * Handles all authentication-related operations including signup, login,
 * logout, token refresh, and session management.
 */
export class AuthService {
  /**
   * Register a new user
   *
   * @param email - User's email address
   * @param password - User's password (plain text)
   * @param firstName - User's first name (optional)
   * @param lastName - User's last name (optional)
   * @returns Promise<User> - Created user
   * @throws Error if validation fails or user already exists
   */
  async signup(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ): Promise<User> {
    // Validate email
    if (!validateEmail(email)) {
      throw new Error('Invalid email address');
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());
    const sanitizedFirstName = firstName ? sanitizeInput(firstName.trim()) : null;
    const sanitizedLastName = lastName ? sanitizeInput(lastName.trim()) : null;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (existingUser) {
      // Log failed signup attempt
      await this.createAuditLog({
        userId: null,
        action: 'SIGNUP_FAILURE',
        resourceType: 'user',
        status: 'FAILURE',
        errorMessage: 'Email already registered',
        metadata: { email: sanitizedEmail },
      });

      throw new Error('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        passwordHash,
        firstName: sanitizedFirstName,
        lastName: sanitizedLastName,
      },
    });

    // Log successful signup
    await this.createAuditLog({
      userId: user.id,
      action: 'SIGNUP_SUCCESS',
      resourceType: 'user',
      resourceId: user.id,
      status: 'SUCCESS',
      metadata: {
        email: sanitizedEmail,
        hasFirstName: !!firstName,
        hasLastName: !!lastName,
      },
    });

    return user;
  }

  /**
   * Authenticate user and create session
   *
   * @param email - User's email address
   * @param password - User's password (plain text)
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   * @returns Promise<LoginResult> - User, tokens, and session
   * @throws Error if credentials are invalid
   */
  async login(
    email: string,
    password: string,
    ipAddress: string,
    userAgent: string
  ): Promise<LoginResult> {
    // Validate email format
    if (!validateEmail(email)) {
      await this.createAuditLog({
        userId: null,
        action: 'LOGIN_FAILURE',
        resourceType: 'auth',
        status: 'FAILURE',
        errorMessage: 'Invalid email format',
        ipAddress,
        userAgent,
        metadata: { email },
      });

      throw new Error('Invalid email or password');
    }

    const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    if (!user) {
      // Log failed login attempt
      await this.createAuditLog({
        userId: null,
        action: 'LOGIN_FAILURE',
        resourceType: 'auth',
        status: 'FAILURE',
        errorMessage: 'User not found',
        ipAddress,
        userAgent,
        metadata: { email: sanitizedEmail },
      });

      throw new Error('Invalid email or password');
    }

    // Check if user is deleted (soft delete)
    if (user.deletedAt) {
      await this.createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILURE',
        resourceType: 'auth',
        status: 'FAILURE',
        errorMessage: 'Account deleted',
        ipAddress,
        userAgent,
      });

      throw new Error('Account has been deleted');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
      // Log failed login attempt
      await this.createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILURE',
        resourceType: 'auth',
        status: 'FAILURE',
        errorMessage: 'Invalid password',
        ipAddress,
        userAgent,
      });

      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const token = generateJWT(user.id, user.email);
    const refreshToken = generateRefreshToken(user.id);

    // Create session
    const tokenHash = hashSHA256(token);
    const expiresAt = getAccessTokenExpiration();

    await this.createSession(user.id, tokenHash, expiresAt, ipAddress, userAgent);

    // Log successful login
    await this.createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'auth',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: {
        email: user.email,
      },
    });

    return {
      user,
      token,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - Valid refresh token
   * @returns Promise<{ token: string }> - New access token
   * @throws Error if refresh token is invalid
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    // Note: In a production app, you'd verify the refresh token
    // and check if it's been revoked. For now, we'll use the JWT verification
    // from auth utils and regenerate the access token.

    // This is a simplified implementation
    // In production, store refresh tokens in database with expiration
    throw new Error('Refresh token functionality not yet implemented');
  }

  /**
   * Logout user and invalidate session
   *
   * @param userId - User ID
   * @param tokenHash - Hash of the token to invalidate
   * @returns Promise<void>
   */
  async logout(userId: string, tokenHash: string): Promise<void> {
    // Delete session
    await prisma.session.deleteMany({
      where: {
        userId,
        tokenHash,
      },
    });

    // Log logout
    await this.createAuditLog({
      userId,
      action: 'LOGOUT_SUCCESS',
      resourceType: 'auth',
      status: 'SUCCESS',
    });
  }

  /**
   * Create a new session for user
   *
   * @param userId - User ID
   * @param tokenHash - Hash of the JWT token
   * @param expiresAt - Session expiration date
   * @param ipAddress - Client IP address
   * @param userAgent - Client user agent
   * @returns Promise<Session> - Created session
   */
  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Session> {
    const session = await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return session;
  }

  /**
   * Get current user by ID
   *
   * @param userId - User ID
   * @returns Promise<User> - User object
   * @throws Error if user not found
   */
  async getMe(userId: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.deletedAt) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Update user settings
   *
   * @param userId - User ID
   * @param timezone - User's preferred IANA timezone
   * @param sleepStartTime - Sleep start time in HH:MM format (optional)
   * @param sleepEndTime - Sleep end time in HH:MM format (optional)
   * @returns Promise<User> - Updated user object
   * @throws Error if user not found or timezone is invalid
   */
  async updateSettings(
    userId: string,
    timezone: string,
    sleepStartTime?: string | null,
    sleepEndTime?: string | null
  ): Promise<User> {
    // Verify user exists and is not deleted
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser || existingUser.deletedAt) {
      throw new Error('User not found');
    }

    // Build update data object
    const updateData: {
      timezone: string;
      sleepStartTime?: string | null;
      sleepEndTime?: string | null;
    } = { timezone };

    // Add sleep hours to update if provided
    if (sleepStartTime !== undefined) {
      updateData.sleepStartTime = sleepStartTime;
    }
    if (sleepEndTime !== undefined) {
      updateData.sleepEndTime = sleepEndTime;
    }

    // Update user settings
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Build audit log metadata
    const metadata: Record<string, any> = {
      timezone,
      previousTimezone: existingUser.timezone,
    };

    // Include sleep hours in audit log if they were updated
    if (sleepStartTime !== undefined) {
      metadata.sleepStartTime = sleepStartTime;
      metadata.previousSleepStartTime = existingUser.sleepStartTime;
    }
    if (sleepEndTime !== undefined) {
      metadata.sleepEndTime = sleepEndTime;
      metadata.previousSleepEndTime = existingUser.sleepEndTime;
    }

    // Log settings update
    await this.createAuditLog({
      userId,
      action: 'SETTINGS_UPDATE',
      resourceType: 'user',
      resourceId: userId,
      status: 'SUCCESS',
      metadata,
    });

    return updatedUser;
  }

  /**
   * Get all active sessions for a user
   *
   * @param userId - User ID
   * @returns Promise<Session[]> - Active sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions;
  }

  /**
   * Delete all sessions for a user (logout all devices)
   *
   * @param userId - User ID
   * @returns Promise<number> - Number of sessions deleted
   */
  async logoutAllSessions(userId: string): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    await this.createAuditLog({
      userId,
      action: 'LOGOUT_ALL_SESSIONS',
      resourceType: 'auth',
      status: 'SUCCESS',
      metadata: { sessionsDeleted: result.count },
    });

    return result.count;
  }

  /**
   * Create audit log entry
   *
   * @param data - Audit log data
   * @returns Promise<void>
   */
  private async createAuditLog(data: {
    userId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string;
    status: 'SUCCESS' | 'FAILURE';
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId || null,
          status: data.status,
          errorMessage: data.errorMessage || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          metadata: data.metadata || null,
        },
      });
    } catch (error) {
      // Don't throw error if audit logging fails
      console.error('Failed to create audit log:', error);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
