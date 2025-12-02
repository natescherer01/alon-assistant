/**
 * OAuth Configuration
 *
 * Centralized configuration for Google Calendar, Microsoft Outlook, and Apple Calendar OAuth 2.0
 * Contains client credentials, redirect URIs, and required scopes
 */

export const googleOAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/oauth/google/callback`,
  scopes: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

export const microsoftOAuthConfig = {
  clientId: process.env.MICROSOFT_CLIENT_ID!,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
  redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/oauth/microsoft/callback`,
  scopes: ['Calendars.Read', 'User.Read', 'offline_access'],
  tenant: process.env.MICROSOFT_TENANT_ID || 'common',
  authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
};

/**
 * Validate OAuth configuration on startup
 * Throws error if required environment variables are missing
 */
export function validateOAuthConfig(): void {
  const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'ENCRYPTION_KEY',
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.warn(
      `Warning: Missing OAuth environment variables: ${missing.join(', ')}`
    );
    console.warn('OAuth functionality may not work correctly.');
  }
}
