# OAuth Provider Setup Guide

This guide walks you through setting up OAuth applications for Google Calendar, Microsoft Outlook, and Apple Calendar integration.

---

## Prerequisites

Before you begin, make sure you have:
- [ ] Access to Google Cloud Console
- [ ] Access to Microsoft Azure Portal
- [ ] Access to Apple Developer Portal (for Apple Calendar)
- [ ] Your application's frontend URL (e.g., `http://localhost:5173` for dev, `https://your-domain.com` for production)
- [ ] Your application's backend URL (e.g., `http://localhost:3000` for dev, `https://api.your-domain.com` for production)

---

## 1. Google Calendar OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `alon-cal` (or your preferred name)
4. Click "Create"

### Step 2: Enable Google Calendar API

1. In your project, navigate to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and click **Enable**

### Step 3: Create OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **External** (or Internal if using Google Workspace)
3. Click **Create**

**Fill in the form:**
- **App name**: `Alon Cal` (or your app name)
- **User support email**: Your email
- **App logo**: Upload your logo (optional)
- **App domain**:
  - Application home page: `https://your-domain.com`
  - Privacy policy: `https://your-domain.com/privacy`
  - Terms of service: `https://your-domain.com/terms`
- **Authorized domains**:
  - Add `your-domain.com` (production)
  - For development, you don't need to add localhost
- **Developer contact email**: Your email

4. Click **Save and Continue**

### Step 4: Add Scopes

1. Click **Add or Remove Scopes**
2. Add these scopes:
   - `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events
   - `https://www.googleapis.com/auth/userinfo.email` - User email
   - `https://www.googleapis.com/auth/userinfo.profile` - User profile

3. Click **Update** → **Save and Continue**

### Step 5: Add Test Users (if using External)

1. Click **Add Users**
2. Add your email address and any test user emails
3. Click **Save and Continue**

### Step 6: Create OAuth Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: **Web application**
4. **Name**: `Alon Cal Web Client`

**Authorized JavaScript origins:**
- Development: `http://localhost:5173`
- Production: `https://your-domain.com`

**Authorized redirect URIs:**
- Development: `http://localhost:3000/api/oauth/google/callback`
- Production: `https://api.your-domain.com/api/oauth/google/callback`

5. Click **Create**

### Step 7: Copy Credentials

You'll see a modal with your credentials:
- **Client ID**: `xxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxx`

**Save these for your `.env` file!**

---

## 2. Microsoft Outlook OAuth Setup

### Step 1: Register App in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Azure Active Directory** (or search for "App registrations")
3. Click **App registrations** → **New registration**

**Fill in the form:**
- **Name**: `Alon Cal`
- **Supported account types**: Select **Accounts in any organizational directory and personal Microsoft accounts**
- **Redirect URI**:
  - Platform: **Web**
  - URI: `http://localhost:3000/api/oauth/microsoft/callback` (for development)

4. Click **Register**

### Step 2: Add Production Redirect URI

1. In your app, navigate to **Authentication**
2. Under **Web** → **Redirect URIs**, click **Add URI**
3. Add production URI: `https://api.your-domain.com/api/oauth/microsoft/callback`
4. Click **Save**

### Step 3: Create Client Secret

1. Navigate to **Certificates & secrets**
2. Click **New client secret**
3. **Description**: `Alon Cal Production Secret`
4. **Expires**: Choose expiration (e.g., 24 months)
5. Click **Add**

**Copy the secret VALUE immediately** (you won't be able to see it again!)
- **Value**: `xxxxx~xxxxx`

### Step 4: Configure API Permissions

1. Navigate to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Add these permissions:
   - `Calendars.Read` - Read user calendars
   - `User.Read` - Read user profile
   - `offline_access` - Maintain access to data

6. Click **Add permissions**
7. (Optional) Click **Grant admin consent** if you have admin access

### Step 5: Copy Application IDs

1. Navigate to **Overview**
2. Copy these values:
   - **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (or use `common` for multi-tenant)

**Save these for your `.env` file!**

---

## 3. Apple Calendar OAuth Setup

Apple Calendar integration uses **Sign in with Apple**. This is more complex than Google/Microsoft.

### Option A: Sign in with Apple (Recommended)

### Step 1: Apple Developer Account

1. Ensure you have an [Apple Developer Account](https://developer.apple.com/account/)
2. Enroll in the Apple Developer Program ($99/year) if not already enrolled

### Step 2: Create App ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (to create new)
4. Select **App IDs** → Click **Continue**
5. Select **App** → Click **Continue**

**Fill in the form:**
- **Description**: `Alon Cal`
- **Bundle ID**: `com.yourcompany.aloncal` (use reverse domain notation)
- **Capabilities**: Check **Sign in with Apple**

6. Click **Continue** → **Register**

### Step 3: Create Services ID

1. Navigate to **Identifiers** → **+** (to create new)
2. Select **Services IDs** → Click **Continue**

**Fill in the form:**
- **Description**: `Alon Cal Web`
- **Identifier**: `com.yourcompany.aloncal.web`

3. Check **Sign in with Apple**
4. Click **Configure**

**Configure Sign in with Apple:**
- **Primary App ID**: Select the App ID you created in Step 2
- **Web Domain**: `your-domain.com` (without https://)
- **Return URLs**:
  - Development: `http://localhost:3000/api/oauth/apple/callback`
  - Production: `https://api.your-domain.com/api/oauth/apple/callback`

5. Click **Save** → **Continue** → **Register**

### Step 4: Create Private Key

1. Navigate to **Keys** → **+** (to create new)
2. **Key Name**: `Alon Cal Sign in with Apple Key`
3. Check **Sign in with Apple**
4. Click **Configure**
5. Select your **Primary App ID**
6. Click **Save** → **Continue** → **Register**
7. **Download the key file** (.p8 file) - you can only download it once!
8. Note the **Key ID** (10 characters)

### Step 5: Get Team ID

1. Navigate to **Membership** in Apple Developer Portal
2. Copy your **Team ID** (10 characters)

### Step 6: Prepare Private Key for .env

The `.p8` file you downloaded needs to be converted to a format that works in `.env`:

```bash
# View the key
cat AuthKey_XXXXXXXXXX.p8

# It will look like:
# -----BEGIN PRIVATE KEY-----
# MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
# -----END PRIVATE KEY-----
```

For `.env` file, you need to:
1. Keep the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
2. Replace newlines with `\n`

**Save these for your `.env` file:**
- **Client ID**: Your Services ID (e.g., `com.yourcompany.aloncal.web`)
- **Team ID**: From Membership page
- **Key ID**: From the key you created
- **Private Key**: Content of the .p8 file

---

### Option B: CalDAV (Alternative - Simpler but Less Secure)

If Sign in with Apple is too complex, you can use CalDAV protocol:

1. Users provide their iCloud email and **app-specific password**
2. Your app connects via CalDAV protocol to `https://caldav.icloud.com`

**Note:** This requires users to generate app-specific passwords from iCloud settings and is less secure than OAuth.

---

## 4. Environment Variable Configuration

Create or update `/Users/natescherer/alon-cal/backend/.env`:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/aloncal?schema=public"

# Security
ENCRYPTION_KEY=your-32-character-encryption-key-here
JWT_SECRET=your-jwt-secret-here

# Google Calendar OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback

# Microsoft Outlook OAuth
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxx~xxxxx
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/oauth/microsoft/callback

# Apple Calendar OAuth (Sign in with Apple)
APPLE_CLIENT_ID=com.yourcompany.aloncal.web
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMG...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI=http://localhost:3000/api/oauth/apple/callback

# Optional: Redis (for production session storage)
# REDIS_URL=redis://localhost:6379
```

### Generate Encryption Key

```bash
# Generate a secure 32-character encryption key
openssl rand -hex 16
# Output: e.g., 4f3d2e1c0b9a8d7f6e5c4b3a2d1e0f9a

# Or for JWT secret (64 characters recommended)
openssl rand -base64 64
```

---

## 5. Production Environment Variables

For production, update these values:

```bash
NODE_ENV=production
API_URL=https://api.your-domain.com
FRONTEND_URL=https://your-domain.com

# Use production redirect URIs
GOOGLE_REDIRECT_URI=https://api.your-domain.com/api/oauth/google/callback
MICROSOFT_REDIRECT_URI=https://api.your-domain.com/api/oauth/microsoft/callback
APPLE_REDIRECT_URI=https://api.your-domain.com/api/oauth/apple/callback

# Use Redis for session storage in production
REDIS_URL=redis://your-redis-host:6379
```

---

## 6. Verification Checklist

After configuration, verify:

### Google Calendar
- [ ] Google Cloud project created
- [ ] Google Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] Scopes added: `calendar.readonly`, `userinfo.email`, `userinfo.profile`
- [ ] OAuth client ID created with correct redirect URIs
- [ ] Client ID and Secret saved in `.env`
- [ ] Test users added (if using External consent screen)

### Microsoft Outlook
- [ ] Azure app registration created
- [ ] Redirect URIs configured (dev + production)
- [ ] Client secret generated and saved
- [ ] API permissions added: `Calendars.Read`, `User.Read`, `offline_access`
- [ ] Application ID and Tenant ID saved in `.env`
- [ ] (Optional) Admin consent granted

### Apple Calendar
- [ ] Apple Developer account active
- [ ] App ID created with Sign in with Apple capability
- [ ] Services ID created and configured
- [ ] Web domain and return URLs configured
- [ ] Private key (.p8) generated and downloaded
- [ ] Key ID and Team ID noted
- [ ] All credentials saved in `.env`

### Environment
- [ ] `.env` file created in `/Users/natescherer/alon-cal/backend/`
- [ ] All required variables set
- [ ] Encryption key is exactly 32 characters
- [ ] Private keys properly formatted
- [ ] `.env` added to `.gitignore` (DO NOT commit!)

---

## 7. Testing OAuth Flows

### Test Google Calendar

```bash
# Start backend
cd /Users/natescherer/alon-cal/backend
npm start

# In browser, navigate to:
http://localhost:3000/api/oauth/google/login

# You should be redirected to Google OAuth consent screen
```

### Test Microsoft Outlook

```bash
# In browser, navigate to:
http://localhost:3000/api/oauth/microsoft/login

# You should be redirected to Microsoft login
```

### Test Apple Calendar

```bash
# In browser, navigate to:
http://localhost:3000/api/oauth/apple/login

# You should be redirected to Sign in with Apple
```

---

## 8. Common Issues & Solutions

### Google Calendar

**Issue**: "Redirect URI mismatch"
- **Solution**: Ensure the redirect URI in Google Cloud Console exactly matches `GOOGLE_REDIRECT_URI` in `.env`

**Issue**: "Access denied" error
- **Solution**: Add your email to test users in OAuth consent screen

**Issue**: "API not enabled"
- **Solution**: Enable Google Calendar API in APIs & Services → Library

### Microsoft Outlook

**Issue**: "AADSTS50011: The redirect URI does not match"
- **Solution**: Ensure redirect URI in Azure matches `MICROSOFT_REDIRECT_URI` in `.env`

**Issue**: "AADSTS65001: User consent required"
- **Solution**: Add required permissions and grant admin consent

**Issue**: "Client secret expired"
- **Solution**: Generate new client secret in Azure → Certificates & secrets

### Apple Calendar

**Issue**: "Invalid client"
- **Solution**: Verify Services ID matches `APPLE_CLIENT_ID` in `.env`

**Issue**: "Invalid key"
- **Solution**: Ensure private key is properly formatted with `\n` for newlines

**Issue**: "Invalid redirect URI"
- **Solution**: Ensure return URL in Services ID configuration matches `APPLE_REDIRECT_URI`

### General

**Issue**: "Encryption error"
- **Solution**: Ensure `ENCRYPTION_KEY` is exactly 32 characters

**Issue**: "Session not found"
- **Solution**: Session expired (10 minute TTL). Restart OAuth flow.

---

## 9. Security Best Practices

- ✅ **Never commit `.env` file** - Add to `.gitignore`
- ✅ **Use HTTPS in production** - Required for OAuth
- ✅ **Rotate secrets regularly** - Every 6-12 months
- ✅ **Use separate credentials** - Different keys for dev/staging/prod
- ✅ **Monitor OAuth activity** - Check audit logs
- ✅ **Limit scopes** - Request only necessary permissions
- ✅ **Use environment-specific redirect URIs** - Don't mix dev/prod

---

## 10. Next Steps

After configuration:

1. Run database migrations
2. Start backend server
3. Start frontend server
4. Test OAuth flows for all 3 providers
5. Deploy to production with production credentials

---

## Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Microsoft Graph OAuth Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [Apple Sign in Documentation](https://developer.apple.com/sign-in-with-apple/get-started/)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

**Configuration complete!** You're now ready to integrate Google Calendar, Microsoft Outlook, and Apple Calendar into Alon Cal.
