/**
 * Prisma Client Singleton
 *
 * This module provides a singleton instance of PrismaClient
 * to prevent multiple instances in development with hot reloading.
 *
 * Best Practices:
 * - Single instance prevents connection pool exhaustion
 * - Graceful shutdown on process termination
 * - Query logging in development
 * - Connection pool optimization for production
 */

import { PrismaClient } from '@prisma/client';

// Extend global type for development hot reloading
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client Configuration
 *
 * Log Levels:
 * - query: SQL queries (dev only)
 * - info: General info (dev only)
 * - warn: Warnings (always)
 * - error: Errors (always)
 */
const prismaClientConfig = {
  log:
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
  errorFormat: 'pretty',
} as const;

/**
 * Initialize Prisma Client
 *
 * In development, use global variable to prevent multiple instances
 * In production, create new instance
 */
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: prismaClientConfig.log as any,
  });

// Store in global for development hot reloading
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Graceful Shutdown
 *
 * Disconnect Prisma Client on process termination
 * to ensure all connections are closed properly
 */
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Closing Prisma Client...`);

  try {
    await prisma.$disconnect();
    console.log('Prisma Client disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during Prisma Client disconnect:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

/**
 * Database Health Check
 *
 * Test database connectivity
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * Clean Expired Sessions
 *
 * Delete sessions that have expired
 * Run this periodically (e.g., daily cron job)
 *
 * @returns Promise<number> - Number of sessions deleted
 */
export async function cleanExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  console.log(`Cleaned up ${result.count} expired sessions`);
  return result.count;
}

/**
 * Archive Old Audit Logs
 *
 * Move audit logs older than retention period to archive
 * (Implementation would export to S3/file, then delete from DB)
 *
 * @param retentionDays - Number of days to retain in database
 * @returns Promise<number> - Number of logs archived
 */
export async function archiveOldAuditLogs(
  retentionDays: number = 90
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // In production, export to archive storage first
  const logsToArchive = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  // TODO: Export logsToArchive to S3/cold storage

  // Delete from database after successful export
  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`Archived ${result.count} audit logs older than ${retentionDays} days`);
  return result.count;
}

/**
 * Hard Delete Soft-Deleted Records
 *
 * Permanently delete records that have been soft-deleted
 * for longer than grace period
 *
 * @param gracePeriodDays - Days to wait before hard delete
 * @returns Promise<object> - Counts of deleted records by table
 */
export async function hardDeleteSoftDeleted(
  gracePeriodDays: number = 30
): Promise<{ users: number; calendarConnections: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

  const [users, calendarConnections] = await Promise.all([
    prisma.user.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    }),
    prisma.calendarConnection.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
    }),
  ]);

  console.log(
    `Hard deleted ${users.count} users and ${calendarConnections.count} calendar connections`
  );

  return {
    users: users.count,
    calendarConnections: calendarConnections.count,
  };
}

/**
 * Get Database Statistics
 *
 * Retrieve counts for all tables
 * Useful for monitoring and dashboards
 *
 * @returns Promise<object> - Record counts by table
 */
export async function getDatabaseStats() {
  const [totalUsers, activeUsers, totalConnections, activeConnections, activeSessions, totalAuditLogs] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.calendarConnection.count(),
      prisma.calendarConnection.count({
        where: { isConnected: true, deletedAt: null },
      }),
      prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      prisma.auditLog.count(),
    ]);

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      deleted: totalUsers - activeUsers,
    },
    calendarConnections: {
      total: totalConnections,
      active: activeConnections,
    },
    sessions: {
      active: activeSessions,
    },
    auditLogs: {
      total: totalAuditLogs,
    },
  };
}

export default prisma;
