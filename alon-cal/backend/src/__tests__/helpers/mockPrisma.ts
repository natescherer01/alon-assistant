/**
 * Mock Prisma Client
 *
 * Provides mock implementations of Prisma Client for testing
 */

import { User, Session, CalendarConnection, AuditLog, CalendarProvider } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create mock Prisma Client
export const prismaMock = mockDeep<PrismaClient>();

// Reset mock before each test
export const resetPrismaMock = () => {
  mockReset(prismaMock);
};

// Helper function to create mock user
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// Helper function to create mock session
export const createMockSession = (overrides?: Partial<Session>): Session => ({
  id: 'test-session-id',
  userId: 'test-user-id',
  tokenHash: 'test-token-hash',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0 Test Browser',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper function to create mock calendar connection
export const createMockCalendarConnection = (
  overrides?: Partial<CalendarConnection>
): CalendarConnection => ({
  id: 'test-connection-id',
  userId: 'test-user-id',
  provider: CalendarProvider.GOOGLE,
  calendarId: 'test-calendar-id',
  calendarName: 'Test Calendar',
  accessToken: 'encrypted-access-token',
  refreshToken: 'encrypted-refresh-token',
  tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  calendarColor: '#4285f4',
  isPrimary: true,
  isConnected: true,
  lastSyncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// Helper function to create mock audit log
export const createMockAuditLog = (overrides?: Partial<AuditLog>): AuditLog => ({
  id: 'test-audit-log-id',
  userId: 'test-user-id',
  action: 'LOGIN_SUCCESS',
  resourceType: 'auth',
  resourceId: null,
  status: 'SUCCESS',
  errorMessage: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0 Test Browser',
  metadata: null,
  createdAt: new Date(),
  ...overrides,
});

export default prismaMock;
