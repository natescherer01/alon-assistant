/**
 * Token Refresh Service
 *
 * Handles automatic token refresh for OAuth connections
 * Checks token expiration and refreshes before expiry
 */

import { prisma } from '../lib/prisma';
import { CalendarProvider } from '@prisma/client';
import { GoogleCalendarClient } from '../integrations/google';
import { MicrosoftCalendarClient } from '../integrations/microsoft';
import { encryptToken, decryptToken } from '../utils/encryption';
import auditService from './auditService';
import logger from '../utils/logger';

class TokenRefreshService {
  private googleClient: GoogleCalendarClient;
  private microsoftClient: MicrosoftCalendarClient;

  // Refresh token if it expires within 5 minutes
  private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

  constructor() {
    this.googleClient = new GoogleCalendarClient();
    this.microsoftClient = new MicrosoftCalendarClient();
  }

  /**
   * Check if token needs refresh and refresh if necessary
   * Returns decrypted access token for immediate use
   *
   * @param connectionId - Calendar connection ID
   * @param userId - User ID (for authorization verification)
   * @returns Valid access token
   */
  async checkAndRefreshToken(connectionId: string, userId?: string): Promise<string> {
    try {
      const connection = await prisma.calendarConnection.findUnique({
        where: { id: connectionId, deletedAt: null },
      });

      if (!connection) {
        throw new Error('Calendar connection not found');
      }

      // SECURITY: Verify connection belongs to the requesting user
      if (userId && connection.userId !== userId) {
        logger.warn('Unauthorized token refresh attempt', {
          connectionId,
          requestingUserId: userId,
          actualUserId: connection.userId,
        });
        throw new Error('Unauthorized: Connection does not belong to this user');
      }

      if (!connection.isConnected) {
        throw new Error('Calendar connection is disconnected');
      }

      const now = new Date();
      const expiresAt = new Date(connection.tokenExpiresAt);
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();

      // If token is still valid for more than 5 minutes, return existing token
      if (timeUntilExpiry > this.REFRESH_THRESHOLD_MS) {
        logger.debug('Token still valid, no refresh needed', { connectionId });
        return decryptToken(connection.accessToken);
      }

      logger.info('Token expiring soon, refreshing', { connectionId, provider: connection.provider });

      // Refresh token based on provider
      const decryptedRefreshToken = decryptToken(connection.refreshToken);
      let newAccessToken: string;
      let expiresIn: number;

      if (connection.provider === CalendarProvider.GOOGLE) {
        const tokens = await this.googleClient.refreshAccessToken(decryptedRefreshToken);
        newAccessToken = tokens.accessToken;
        expiresIn = tokens.expiresIn;
      } else if (connection.provider === CalendarProvider.MICROSOFT) {
        const tokens = await this.microsoftClient.refreshAccessToken(decryptedRefreshToken);
        newAccessToken = tokens.accessToken;
        expiresIn = tokens.expiresIn;
      } else {
        throw new Error(`Unsupported provider: ${connection.provider}`);
      }

      // Update connection with new token
      const newExpiresAt = new Date(Date.now() + expiresIn * 1000);
      await prisma.calendarConnection.update({
        where: { id: connectionId },
        data: {
          accessToken: encryptToken(newAccessToken),
          tokenExpiresAt: newExpiresAt,
        },
      });

      // Log successful refresh
      await auditService.logTokenRefresh(connection.userId, connection.provider, connectionId);

      logger.info('Token refreshed successfully', { connectionId });
      return newAccessToken;
    } catch (error) {
      logger.error('Failed to refresh token', { connectionId, error });

      // Try to get connection for audit log
      try {
        const connection = await prisma.calendarConnection.findUnique({
          where: { id: connectionId },
        });

        if (connection) {
          // Mark connection as disconnected
          await prisma.calendarConnection.update({
            where: { id: connectionId },
            data: { isConnected: false },
          });

          // Log failure
          await auditService.logTokenRefreshFailure(
            connection.userId,
            connection.provider,
            connectionId,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      } catch (auditError) {
        logger.error('Failed to log token refresh failure', { auditError });
      }

      throw new Error(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Background job to refresh tokens for all connections
   * Should be run periodically (e.g., every hour)
   */
  async scheduleTokenRefresh(): Promise<void> {
    try {
      logger.info('Starting scheduled token refresh job');

      // Find all connections that will expire within the next hour
      const thresholdDate = new Date(Date.now() + 60 * 60 * 1000);

      const connections = await prisma.calendarConnection.findMany({
        where: {
          isConnected: true,
          deletedAt: null,
          tokenExpiresAt: {
            lt: thresholdDate,
          },
        },
      });

      logger.info(`Found ${connections.length} connections needing token refresh`);

      let successCount = 0;
      let failureCount = 0;

      for (const connection of connections) {
        try {
          await this.checkAndRefreshToken(connection.id);
          successCount++;
        } catch (error) {
          failureCount++;
          logger.error('Failed to refresh token in scheduled job', {
            connectionId: connection.id,
            error,
          });
        }
      }

      logger.info('Scheduled token refresh job completed', { successCount, failureCount });
    } catch (error) {
      logger.error('Scheduled token refresh job failed', { error });
    }
  }
}

export default new TokenRefreshService();
