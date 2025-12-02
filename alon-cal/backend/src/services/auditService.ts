/**
 * Audit Logging Service
 *
 * Centralized service for logging security-relevant events
 * Records user actions, OAuth events, and system events to database
 */

import { prisma } from '../lib/prisma';
import { AuditStatus } from '@prisma/client';
import logger from '../utils/logger';

export interface AuditLogData {
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  status: AuditStatus;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class AuditService {
  /**
   * Create an audit log entry
   *
   * @param data - Audit log data
   */
  async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          status: data.status,
          errorMessage: data.errorMessage,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata,
        },
      });

      logger.debug('Audit log created', { action: data.action, userId: data.userId });
    } catch (error) {
      logger.error('Failed to create audit log', { error, data });
      // Don't throw - audit logging failure shouldn't break the application
    }
  }

  /**
   * Log successful OAuth connection
   */
  async logOAuthConnect(
    userId: string,
    provider: string,
    calendarId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'OAUTH_CONNECT',
      resourceType: 'calendar_connection',
      resourceId: calendarId,
      status: AuditStatus.SUCCESS,
      ipAddress,
      userAgent,
      metadata: { provider },
    });
  }

  /**
   * Log failed OAuth connection
   */
  async logOAuthConnectFailure(
    userId: string,
    provider: string,
    errorMessage: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'OAUTH_CONNECT',
      resourceType: 'calendar_connection',
      status: AuditStatus.FAILURE,
      errorMessage,
      ipAddress,
      userAgent,
      metadata: { provider },
    });
  }

  /**
   * Log calendar connection (ICS or OAuth)
   */
  async logCalendarConnect(
    userId: string,
    calendarId: string,
    provider: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'CALENDAR_CONNECT',
      resourceType: 'calendar_connection',
      resourceId: calendarId,
      status: AuditStatus.SUCCESS,
      ipAddress,
      userAgent,
      metadata: { provider },
    });
  }

  /**
   * Log OAuth disconnection
   */
  async logOAuthDisconnect(
    userId: string,
    provider: string,
    calendarId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'OAUTH_DISCONNECT',
      resourceType: 'calendar_connection',
      resourceId: calendarId,
      status: AuditStatus.SUCCESS,
      ipAddress,
      userAgent,
      metadata: { provider },
    });
  }

  /**
   * Log token refresh
   */
  async logTokenRefresh(userId: string, provider: string, connectionId: string): Promise<void> {
    await this.log({
      userId,
      action: 'TOKEN_REFRESH',
      resourceType: 'calendar_connection',
      resourceId: connectionId,
      status: AuditStatus.SUCCESS,
      metadata: { provider },
    });
  }

  /**
   * Log failed token refresh
   */
  async logTokenRefreshFailure(
    userId: string,
    provider: string,
    connectionId: string,
    errorMessage: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'TOKEN_REFRESH',
      resourceType: 'calendar_connection',
      resourceId: connectionId,
      status: AuditStatus.FAILURE,
      errorMessage,
      metadata: { provider },
    });
  }

  /**
   * Log calendar sync
   */
  async logCalendarSync(userId: string, connectionId: string, eventCount: number): Promise<void> {
    await this.log({
      userId,
      action: 'CALENDAR_SYNC',
      resourceType: 'calendar_connection',
      resourceId: connectionId,
      status: AuditStatus.SUCCESS,
      metadata: { eventCount },
    });
  }

  /**
   * Log failed calendar sync
   */
  async logCalendarSyncFailure(
    userId: string,
    connectionId: string,
    errorMessage: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'CALENDAR_SYNC',
      resourceType: 'calendar_connection',
      resourceId: connectionId,
      status: AuditStatus.FAILURE,
      errorMessage,
    });
  }
}

export default new AuditService();
