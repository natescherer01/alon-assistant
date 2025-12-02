/**
 * Test Setup
 *
 * Global setup for all tests, including environment variables and mocks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars!';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/oauth/callback/google';
process.env.MICROSOFT_CLIENT_ID = 'test-microsoft-client-id';
process.env.MICROSOFT_CLIENT_SECRET = 'test-microsoft-client-secret';
process.env.MICROSOFT_REDIRECT_URI = 'http://localhost:3000/oauth/callback/microsoft';

// ICS settings
process.env.ICS_ALLOW_HTTP = 'true'; // Allow HTTP in tests
process.env.ICS_FETCH_TIMEOUT_MS = '10000';
process.env.ICS_MAX_FILE_SIZE_MB = '10';
process.env.ICS_SYNC_INTERVAL_MINUTES = '15';
