/**
 * OAuth Session Management Service
 *
 * Manages temporary OAuth session data between callback and calendar selection.
 * Implements single-use semantics to prevent authorization code reuse.
 * Uses in-memory storage for MVP, can be replaced with Redis for production.
 *
 * Security Features:
 * - Single-use sessions (deleted after retrieval)
 * - 10-minute TTL for session data
 * - Automatic cleanup of expired sessions
 * - Cryptographically secure session IDs
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { CalendarProvider } from '@prisma/client';

/**
 * OAuth session data stored temporarily between callback and selection
 */
export interface OAuthSessionData {
  /** OAuth tokens received from provider */
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  /** List of calendars fetched from provider */
  calendars: any[];
  /** User ID who initiated the OAuth flow */
  userId: string;
  /** Calendar provider (GOOGLE, MICROSOFT, APPLE) */
  provider: CalendarProvider;
  /** Session creation timestamp */
  createdAt: Date;
  /** Session expiration timestamp */
  expiresAt: Date;
}

class SessionService {
  private sessionStore: Map<string, OAuthSessionData>;
  private readonly SESSION_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.sessionStore = new Map();
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Create a new OAuth session
   *
   * Stores OAuth tokens and calendar data temporarily until user selects calendars.
   * Session is automatically cleaned up after 10 minutes or upon retrieval.
   *
   * @param data - OAuth session data (tokens, calendars, userId, provider)
   * @returns Cryptographically secure session ID
   */
  async createSession(data: Omit<OAuthSessionData, 'createdAt' | 'expiresAt'>): Promise<string> {
    try {
      const sessionId = uuidv4();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.SESSION_EXPIRY_MS);

      const sessionData: OAuthSessionData = {
        ...data,
        createdAt: now,
        expiresAt,
      };

      this.sessionStore.set(sessionId, sessionData);

      logger.info('Created OAuth session', {
        sessionId,
        userId: data.userId,
        provider: data.provider,
        calendarCount: data.calendars.length,
        expiresAt: expiresAt.toISOString(),
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create OAuth session', { error });
      throw new Error(
        `Failed to create OAuth session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Retrieve OAuth session data (single-use)
   *
   * IMPORTANT: This method deletes the session after retrieval to enforce
   * single-use semantics and prevent authorization code reuse attacks.
   *
   * @param sessionId - Session ID to retrieve
   * @returns OAuth session data or null if not found/expired
   */
  async getSession(sessionId: string): Promise<OAuthSessionData | null> {
    try {
      const sessionData = this.sessionStore.get(sessionId);

      if (!sessionData) {
        logger.warn('OAuth session not found', { sessionId });
        return null;
      }

      // Check expiration
      if (new Date() > sessionData.expiresAt) {
        logger.warn('OAuth session expired', { sessionId });
        this.sessionStore.delete(sessionId);
        return null;
      }

      // CRITICAL: Delete session immediately after retrieval (single-use)
      this.sessionStore.delete(sessionId);

      logger.info('Retrieved and deleted OAuth session (single-use)', {
        sessionId,
        userId: sessionData.userId,
        provider: sessionData.provider,
      });

      return sessionData;
    } catch (error) {
      logger.error('Failed to retrieve OAuth session', { sessionId, error });
      throw new Error(
        `Failed to retrieve OAuth session: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete session manually
   *
   * Use this to clean up sessions when OAuth flow is cancelled or fails.
   *
   * @param sessionId - Session ID to delete
   */
  async deleteSession(sessionId: string): Promise<void> {
    const deleted = this.sessionStore.delete(sessionId);
    if (deleted) {
      logger.debug('Deleted OAuth session', { sessionId });
    }
  }

  /**
   * Peek at session data without deleting (for validation only)
   *
   * WARNING: Use sparingly. Does not enforce single-use semantics.
   * Only use for validation before retrieval.
   *
   * @param sessionId - Session ID to peek at
   * @returns OAuth session data or null if not found/expired
   */
  async peekSession(sessionId: string): Promise<OAuthSessionData | null> {
    const sessionData = this.sessionStore.get(sessionId);

    if (!sessionData) {
      return null;
    }

    // Check expiration
    if (new Date() > sessionData.expiresAt) {
      this.sessionStore.delete(sessionId);
      return null;
    }

    return sessionData;
  }

  /**
   * Validate session exists and belongs to user
   *
   * Use this for authorization checks before retrieving session.
   *
   * @param sessionId - Session ID to validate
   * @param userId - Expected user ID
   * @returns True if session exists and belongs to user
   */
  async validateSession(sessionId: string, userId: string): Promise<boolean> {
    const sessionData = await this.peekSession(sessionId);

    if (!sessionData) {
      return false;
    }

    if (sessionData.userId !== userId) {
      logger.warn('OAuth session user mismatch', {
        sessionId,
        expectedUserId: userId,
        actualUserId: sessionData.userId,
      });
      return false;
    }

    return true;
  }

  /**
   * Clean up expired sessions
   *
   * Runs automatically every 5 minutes via setInterval in constructor.
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, data] of this.sessionStore.entries()) {
      if (now > data.expiresAt) {
        this.sessionStore.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired OAuth sessions', { count: cleanedCount });
    }
  }

  /**
   * Get count of active sessions (for monitoring)
   *
   * @returns Number of active OAuth sessions
   */
  getActiveSessionCount(): number {
    return this.sessionStore.size;
  }

  /**
   * Get session statistics (for monitoring)
   *
   * @returns Session statistics by provider
   */
  getSessionStats(): {
    total: number;
    byProvider: Record<string, number>;
  } {
    const stats = {
      total: this.sessionStore.size,
      byProvider: {} as Record<string, number>,
    };

    for (const [, data] of this.sessionStore.entries()) {
      const provider = data.provider;
      stats.byProvider[provider] = (stats.byProvider[provider] || 0) + 1;
    }

    return stats;
  }
}

export default new SessionService();
