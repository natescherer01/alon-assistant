/**
 * OAuth State Management Service
 *
 * Manages CSRF protection state tokens for OAuth flows
 * Stores state in database with expiration (30 minutes)
 * Uses database for persistence across server restarts
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { CalendarProvider } from '@prisma/client';
import logger from '../utils/logger';

interface StateData {
  userId: string;
  provider: 'GOOGLE' | 'MICROSOFT' | 'APPLE';
  createdAt: Date;
  expiresAt: Date;
}

class StateService {
  private readonly STATE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up expired states every 5 minutes
    setInterval(() => this.cleanupExpiredStates(), 5 * 60 * 1000);
  }

  /**
   * Create a new state token for OAuth flow
   *
   * @param userId - User ID initiating OAuth flow
   * @param provider - OAuth provider (GOOGLE, MICROSOFT, or APPLE)
   * @returns Cryptographically random state token
   */
  async createState(userId: string, provider: 'GOOGLE' | 'MICROSOFT' | 'APPLE'): Promise<string> {
    const state = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.STATE_EXPIRY_MS);

    // Store in database for persistence across server restarts
    await prisma.oAuthState.create({
      data: {
        state,
        userId,
        provider: provider as CalendarProvider,
        expiresAt,
      },
    });

    logger.debug('Created OAuth state token', { userId, provider, state });

    return state;
  }

  /**
   * Validate state token from OAuth callback
   *
   * @param state - State token from OAuth callback
   * @param userId - Expected user ID (optional for validation)
   * @param provider - Expected provider (optional for validation)
   * @returns True if valid, false otherwise
   */
  async validateState(
    state: string,
    userId?: string,
    provider?: 'GOOGLE' | 'MICROSOFT' | 'APPLE'
  ): Promise<{ valid: boolean; userId?: string; provider?: 'GOOGLE' | 'MICROSOFT' | 'APPLE' }> {
    // Fetch from database
    const stateData = await prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!stateData) {
      logger.warn('Invalid OAuth state token - not found', { state });
      return { valid: false };
    }

    // Check expiration
    if (new Date() > stateData.expiresAt) {
      logger.warn('OAuth state token expired', { state });
      await prisma.oAuthState.delete({ where: { state } }).catch(() => {});
      return { valid: false };
    }

    // Validate user ID if provided
    if (userId && stateData.userId !== userId) {
      logger.warn('OAuth state token user mismatch', { state, expectedUserId: userId });
      return { valid: false };
    }

    // Validate provider if provided
    if (provider && stateData.provider !== provider) {
      logger.warn('OAuth state token provider mismatch', { state, expectedProvider: provider });
      return { valid: false };
    }

    logger.debug('OAuth state token validated successfully', { state, userId: stateData.userId });

    return {
      valid: true,
      userId: stateData.userId,
      provider: stateData.provider as 'GOOGLE' | 'MICROSOFT' | 'APPLE',
    };
  }

  /**
   * Delete state token after use (single-use)
   *
   * @param state - State token to delete
   */
  async deleteState(state: string): Promise<void> {
    try {
      await prisma.oAuthState.delete({ where: { state } });
      logger.debug('Deleted OAuth state token', { state });
    } catch (error) {
      // State might not exist, that's okay
      logger.debug('OAuth state token already deleted or not found', { state });
    }
  }

  /**
   * Clean up expired state tokens
   * Runs automatically every 5 minutes
   */
  private async cleanupExpiredStates(): Promise<void> {
    try {
      const now = new Date();
      const result = await prisma.oAuthState.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up expired OAuth state tokens', { count: result.count });
      }
    } catch (error) {
      logger.error('Failed to clean up expired state tokens', { error });
    }
  }

  /**
   * Get count of active state tokens (for monitoring)
   *
   * @returns Number of active state tokens
   */
  async getActiveStateCount(): Promise<number> {
    const count = await prisma.oAuthState.count({
      where: {
        expiresAt: { gt: new Date() },
      },
    });
    return count;
  }
}

export default new StateService();
