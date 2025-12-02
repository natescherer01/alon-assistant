/**
 * OAuth Setup Verification Script
 *
 * Verifies that OAuth integration is properly configured
 * Run with: npx tsx scripts/verify-oauth-setup.ts
 */

import dotenv from 'dotenv';
import { testEncryption, verifyEncryptionKey } from '../src/utils/encryption';

// Load environment variables
dotenv.config();

console.log('='.repeat(60));
console.log('OAuth Setup Verification');
console.log('='.repeat(60));
console.log();

let hasErrors = false;

// Check required environment variables
console.log('1. Checking Environment Variables...');
console.log('-'.repeat(60));

const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'ENCRYPTION_KEY',
  'API_URL',
  'FRONTEND_URL',
];

const optionalVars = ['MICROSOFT_TENANT_ID', 'NODE_ENV', 'PORT'];

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (!value) {
    console.log(`  ❌ ${varName}: MISSING (required)`);
    hasErrors = true;
  } else if (value.includes('your-') || value.includes('change-in-production')) {
    console.log(`  ⚠️  ${varName}: Set but needs updating (placeholder detected)`);
  } else {
    console.log(`  ✅ ${varName}: Set`);
  }
});

console.log();
console.log('Optional variables:');
optionalVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value}`);
  } else {
    console.log(`  ℹ️  ${varName}: Not set (will use default)`);
  }
});

console.log();

// Check encryption key
console.log('2. Checking Encryption Configuration...');
console.log('-'.repeat(60));

const encryptionKey = process.env.ENCRYPTION_KEY;
if (!encryptionKey) {
  console.log('  ❌ ENCRYPTION_KEY is not set');
  hasErrors = true;
} else if (encryptionKey.length !== 32) {
  console.log(`  ❌ ENCRYPTION_KEY must be exactly 32 characters (current: ${encryptionKey.length})`);
  console.log('     Generate a new key with:');
  console.log('     node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\').substring(0, 32))"');
  hasErrors = true;
} else {
  console.log('  ✅ ENCRYPTION_KEY: Correct length (32 characters)');

  // Test encryption
  if (verifyEncryptionKey()) {
    console.log('  ✅ Encryption key is valid');

    if (testEncryption()) {
      console.log('  ✅ Encryption/decryption test: PASSED');
    } else {
      console.log('  ❌ Encryption/decryption test: FAILED');
      hasErrors = true;
    }
  } else {
    console.log('  ❌ Encryption key validation failed');
    hasErrors = true;
  }
}

console.log();

// Check OAuth URLs
console.log('3. Checking OAuth Configuration...');
console.log('-'.repeat(60));

const apiUrl = process.env.API_URL || 'http://localhost:3001';
const googleRedirectUri = `${apiUrl}/api/oauth/google/callback`;
const microsoftRedirectUri = `${apiUrl}/api/oauth/microsoft/callback`;

console.log(`  Google Redirect URI: ${googleRedirectUri}`);
console.log('  ℹ️  Make sure this matches exactly in Google Cloud Console');
console.log();
console.log(`  Microsoft Redirect URI: ${microsoftRedirectUri}`);
console.log('  ℹ️  Make sure this matches exactly in Azure AD App Registration');
console.log();

// Check API URL format
if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
  console.log('  ⚠️  API_URL should start with http:// or https://');
}

if (apiUrl.endsWith('/')) {
  console.log('  ⚠️  API_URL should not end with a slash');
}

console.log();

// Check Frontend URL
console.log('4. Checking Frontend Configuration...');
console.log('-'.repeat(60));

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
console.log(`  Frontend URL: ${frontendUrl}`);
console.log('  ℹ️  CORS is configured to allow this origin');

if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
  console.log('  ⚠️  FRONTEND_URL should start with http:// or https://');
}

console.log();

// Check Database URL
console.log('5. Checking Database Configuration...');
console.log('-'.repeat(60));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log('  ❌ DATABASE_URL is not set');
  hasErrors = true;
} else if (!databaseUrl.startsWith('postgresql://')) {
  console.log('  ⚠️  DATABASE_URL should start with postgresql://');
} else {
  console.log('  ✅ DATABASE_URL: Set (PostgreSQL)');

  // Try to extract database info (without password)
  try {
    const url = new URL(databaseUrl);
    console.log(`  ℹ️  Host: ${url.hostname}`);
    console.log(`  ℹ️  Port: ${url.port || '5432'}`);
    console.log(`  ℹ️  Database: ${url.pathname.slice(1).split('?')[0]}`);
  } catch (error) {
    console.log('  ⚠️  Could not parse DATABASE_URL');
  }
}

console.log();

// OAuth Scopes
console.log('6. OAuth Scopes Configuration...');
console.log('-'.repeat(60));

console.log('  Google Scopes:');
console.log('    - https://www.googleapis.com/auth/calendar.readonly');
console.log('    - https://www.googleapis.com/auth/userinfo.email');
console.log('    - https://www.googleapis.com/auth/userinfo.profile');
console.log('  ℹ️  Make sure these are enabled in Google Cloud Console');
console.log();

console.log('  Microsoft Scopes:');
console.log('    - Calendars.Read');
console.log('    - User.Read');
console.log('    - offline_access');
console.log('  ℹ️  Make sure these are granted in Azure AD App Registration');

console.log();

// Summary
console.log('='.repeat(60));
console.log('Summary');
console.log('='.repeat(60));

if (hasErrors) {
  console.log('❌ Configuration has errors. Please fix the issues above.');
  console.log();
  console.log('Next steps:');
  console.log('  1. Review OAUTH_SETUP.md for detailed setup instructions');
  console.log('  2. Update .env file with correct values');
  console.log('  3. Run this script again to verify');
  process.exit(1);
} else {
  console.log('✅ Basic configuration looks good!');
  console.log();
  console.log('Next steps:');
  console.log('  1. Make sure database is running: npm run prisma:migrate');
  console.log('  2. Configure OAuth apps (see OAUTH_SETUP.md)');
  console.log('  3. Update redirect URIs in provider consoles');
  console.log('  4. Start the server: npm run dev');
  console.log('  5. Test OAuth flows');
  console.log();
  console.log('For detailed setup instructions, see:');
  console.log('  /Users/natescherer/alon-cal/backend/OAUTH_SETUP.md');
  process.exit(0);
}
