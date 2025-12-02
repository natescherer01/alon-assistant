/**
 * Jest Test Setup
 *
 * Global setup for all tests:
 * - Mock Prisma client
 * - Mock logger
 * - Set environment variables
 * - Global teardown
 */

import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/calendar_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!';
process.env.FRONTEND_URL = 'http://localhost:3000';

// Google OAuth test credentials
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/oauth/google/callback';

// Microsoft OAuth test credentials
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:3001/api/oauth/microsoft/callback';
process.env.MICROSOFT_TENANT_ID = 'common';

// Apple OAuth test credentials
process.env.APPLE_CLIENT_ID = 'test-apple-client-id';
process.env.APPLE_TEAM_ID = 'test-apple-team-id';
process.env.APPLE_KEY_ID = 'test-apple-key-id';
process.env.APPLE_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgTest1234567890Test
1234567890Test1234567890oAoGCCqGSM49AwEHoUQDQgAETest1234567890Test1234
567890Test1234567890Test1234567890Test1234567890Test1234567890==
-----END PRIVATE KEY-----`;
process.env.APPLE_REDIRECT_URI = 'http://localhost:3001/api/oauth/apple/callback';

// Global test teardown
afterAll(async () => {
  // Close any open handles
  await new Promise((resolve) => setTimeout(resolve, 100));
});
