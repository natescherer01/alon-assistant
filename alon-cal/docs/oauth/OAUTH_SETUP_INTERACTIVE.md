# 🔧 Interactive OAuth Setup - Let's Get Started!

## Current Status

✅ Database migrated successfully
✅ Security fixes applied
⏳ OAuth providers need configuration

---

## Step 1: Generate Secure Encryption Key (REQUIRED)

Your current encryption key is weak. Let's generate a strong one:

```bash
openssl rand -hex 16
```

**Copy the output** and update your `.env` file.

---

## Step 2: Set Up Google Calendar OAuth

### 2.1 Create Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: `alon-cal` (or your preferred name)
4. Click **"Create"**

### 2.2 Enable Google Calendar API

1. With your new project selected, go to: https://console.cloud.google.com/apis/library
2. Search for: **"Google Calendar API"**
3. Click on it → Click **"Enable"**

### 2.3 Configure OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select **"External"** user type → Click **"Create"**

**Fill in the form:**
- **App name**: `Alon Cal` (your app name)
- **User support email**: Your email address
- **Developer contact email**: Your email address
- **App domain** (optional for dev): Leave blank for now
- Click **"Save and Continue"**

### 2.4 Add Scopes

1. Click **"Add or Remove Scopes"**
2. Search and add these scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Click **"Update"** → **"Save and Continue"**

### 2.5 Add Test Users

1. Click **"Add Users"**
2. Add your email address (and any other test users)
3. Click **"Save and Continue"** → **"Back to Dashboard"**

### 2.6 Create OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. **Application type**: Select **"Web application"**
4. **Name**: `Alon Cal Web Client`

**Authorized JavaScript origins:**
```
http://localhost:5173
http://localhost:3001
```

**Authorized redirect URIs:**
```
http://localhost:3001/api/oauth/google/callback
```

5. Click **"Create"**

### 2.7 Copy Your Google Credentials

You'll see a modal with:
- **Client ID**: Something like `123456789-abc123def456.apps.googleusercontent.com`
- **Client Secret**: Something like `GOCSPX-abcdefghijklmnop`

**✏️ Update your `.env` file:**
```bash
GOOGLE_CLIENT_ID="your-client-id-here"
GOOGLE_CLIENT_SECRET="your-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/oauth/google/callback"
```

---

## Step 3: Set Up Microsoft Outlook OAuth

### 3.1 Register App in Azure Portal

1. Go to: https://portal.azure.com/
2. Search for **"App registrations"** or navigate to **Azure Active Directory** → **App registrations**
3. Click **"New registration"**

**Fill in the form:**
- **Name**: `Alon Cal`
- **Supported account types**: Select **"Accounts in any organizational directory and personal Microsoft accounts"** (Multitenant + Personal)
- **Redirect URI**:
  - Platform: **Web**
  - URI: `http://localhost:3001/api/oauth/microsoft/callback`
4. Click **"Register"**

### 3.2 Copy Application IDs

On the app **Overview** page, copy:
- **Application (client) ID**: Something like `12345678-1234-1234-1234-123456789abc`
- **Directory (tenant) ID**: Use `common` for multi-tenant

### 3.3 Create Client Secret

1. In your app, navigate to **"Certificates & secrets"**
2. Click **"New client secret"**
3. **Description**: `Alon Cal Dev Secret`
4. **Expires**: Select **"180 days (6 months)"** or longer
5. Click **"Add"**

**⚠️ IMPORTANT:** Copy the **Value** immediately (you won't be able to see it again!)
- Something like: `abc123~DEF456-GHI789_JKL012`

### 3.4 Add API Permissions

1. Navigate to **"API permissions"**
2. Click **"Add a permission"** → **"Microsoft Graph"**
3. Select **"Delegated permissions"**
4. Search and add:
   - `Calendars.Read`
   - `User.Read`
   - `offline_access`
5. Click **"Add permissions"**

**(Optional)** If you have admin access:
- Click **"Grant admin consent for [your organization]"**

### 3.5 Update Your .env File

**✏️ Update your `.env` file:**
```bash
MICROSOFT_CLIENT_ID="your-application-id-here"
MICROSOFT_CLIENT_SECRET="your-client-secret-value-here"
MICROSOFT_TENANT_ID="common"
MICROSOFT_REDIRECT_URI="http://localhost:3001/api/oauth/microsoft/callback"
```

---

## Step 4: Set Up Apple Calendar OAuth (Optional but Recommended)

Apple OAuth is more complex but more secure. If you skip this, you can enable it later.

### 4.1 Apple Developer Account

**Prerequisites:**
- Apple Developer Account (required)
- Apple Developer Program enrollment ($99/year) - required for Sign in with Apple

If you don't have an Apple Developer account yet, you can skip Apple for now and set it up later.

### 4.2 Create App ID

1. Go to: https://developer.apple.com/account/
2. Navigate to **"Certificates, Identifiers & Profiles"**
3. Click **"Identifiers"** → **"+"** (to create new)
4. Select **"App IDs"** → Click **"Continue"**
5. Select **"App"** → Click **"Continue"**

**Fill in the form:**
- **Description**: `Alon Cal`
- **Bundle ID**: `com.yourcompany.aloncal` (use your domain in reverse)
- **Capabilities**: Check **"Sign in with Apple"**
6. Click **"Continue"** → **"Register"**

### 4.3 Create Services ID

1. Navigate to **"Identifiers"** → **"+"** (to create new)
2. Select **"Services IDs"** → Click **"Continue"**

**Fill in the form:**
- **Description**: `Alon Cal Web`
- **Identifier**: `com.yourcompany.aloncal.web`
3. Check **"Sign in with Apple"**
4. Click **"Configure"**

**Configure Sign in with Apple:**
- **Primary App ID**: Select the App ID you created in Step 4.2
- **Web Domain**: `localhost` (for development)
- **Return URLs**: `http://localhost:3001/api/oauth/apple/callback`
5. Click **"Save"** → **"Continue"** → **"Register"**

### 4.4 Create Private Key

1. Navigate to **"Keys"** → **"+"** (to create new)
2. **Key Name**: `Alon Cal Sign in with Apple Key`
3. Check **"Sign in with Apple"**
4. Click **"Configure"**
5. Select your **Primary App ID** (from Step 4.2)
6. Click **"Save"** → **"Continue"** → **"Register"**
7. **Download the key file** (.p8 file) - ⚠️ **You can only download it once!**
8. Note the **Key ID** (10 characters, e.g., `ABC123DEFG`)

### 4.5 Get Team ID

1. Navigate to **"Membership"** in Apple Developer Portal
2. Copy your **Team ID** (10 characters, e.g., `XYZ789ABCD`)

### 4.6 Prepare Private Key for .env

Open the `.p8` file you downloaded:

```bash
cat ~/Downloads/AuthKey_*.p8
```

It will look like:
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
(multiple lines)
...abc123
-----END PRIVATE KEY-----
```

You need to convert this to a single line with `\n` for newlines.

**✏️ Update your `.env` file:**
```bash
APPLE_CLIENT_ID="com.yourcompany.aloncal.web"
APPLE_TEAM_ID="XYZ789ABCD"
APPLE_KEY_ID="ABC123DEFG"
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMG...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI="http://localhost:3001/api/oauth/apple/callback"
```

**Note:** If Apple setup is too complex, you can skip it for now and just configure Google and Microsoft.

---

## Step 5: Update API and Frontend URLs

Make sure these match your local setup:

```bash
API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:5173"
```

---

## Step 6: Verify Your .env File

Your complete `.env` should look like this:

```bash
# Server Configuration
NODE_ENV=development
PORT=3001
API_URL="http://localhost:3001"
FRONTEND_URL="http://localhost:5173"

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/alon_cal_dev?schema=public"

# Security - REPLACE WITH STRONG KEY!
ENCRYPTION_KEY="your-32-char-hex-key-from-openssl"
JWT_SECRET="your-jwt-secret-here"

# Google Calendar OAuth - REPLACE WITH YOUR CREDENTIALS
GOOGLE_CLIENT_ID="123456789-abc123.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-your-secret"
GOOGLE_REDIRECT_URI="http://localhost:3001/api/oauth/google/callback"

# Microsoft Outlook OAuth - REPLACE WITH YOUR CREDENTIALS
MICROSOFT_CLIENT_ID="12345678-1234-1234-1234-123456789abc"
MICROSOFT_CLIENT_SECRET="abc123~DEF456"
MICROSOFT_TENANT_ID="common"
MICROSOFT_REDIRECT_URI="http://localhost:3001/api/oauth/microsoft/callback"

# Apple Calendar OAuth (Optional) - REPLACE WITH YOUR CREDENTIALS
APPLE_CLIENT_ID="com.yourcompany.aloncal.web"
APPLE_TEAM_ID="XYZ789ABCD"
APPLE_KEY_ID="ABC123DEFG"
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIG...\n-----END PRIVATE KEY-----"
APPLE_REDIRECT_URI="http://localhost:3001/api/oauth/apple/callback"
```

---

## Step 7: Test Your Configuration

### 7.1 Generate Encryption Key (if not done)

```bash
openssl rand -hex 16
```

Copy the output and update `ENCRYPTION_KEY` in `.env`.

### 7.2 Start Backend

```bash
cd /Users/natescherer/alon-cal/backend
npm run dev
```

You should see:
```
Server running on port 3001
Database connected
```

### 7.3 Start Frontend (in another terminal)

```bash
cd /Users/natescherer/alon-cal/frontend
npm run dev
```

You should see:
```
Local:   http://localhost:5173/
```

### 7.4 Test Google OAuth

1. Open browser: http://localhost:5173
2. Click **"Connect Calendar"**
3. Select **"Google Calendar"**
4. You should be redirected to Google OAuth consent screen
5. Sign in and grant permissions
6. You should see your Google calendars
7. Select calendars and click **"Connect"**
8. ✅ Success! You should see connected calendars

### 7.5 Test Microsoft OAuth

1. Click **"Connect Calendar"** again
2. Select **"Microsoft Outlook"**
3. You should be redirected to Microsoft login
4. Sign in and grant permissions
5. Select calendars and click **"Connect"**
6. ✅ Success!

### 7.6 Test Apple OAuth (if configured)

1. Click **"Connect Calendar"** again
2. Select **"Apple Calendar"**
3. You should be redirected to Sign in with Apple
4. Sign in and grant permissions
5. Select calendars and click **"Connect"**
6. ✅ Success!

---

## 🎉 You're Done!

Your calendar integration is now fully configured and working!

**Next Steps:**
- Test event syncing: Click "Sync" on a connected calendar
- View unified calendar: Navigate to Calendar page
- Test with different accounts
- Configure for production when ready

---

## 🐛 Troubleshooting

### Google OAuth Issues

**Error: "Redirect URI mismatch"**
- Ensure redirect URI in Google Cloud Console exactly matches: `http://localhost:3001/api/oauth/google/callback`
- Check no trailing slashes

**Error: "Access blocked: This app's request is invalid"**
- Make sure you added your email as a test user in OAuth consent screen
- Verify scopes are added correctly

**Error: "Invalid client"**
- Double-check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Make sure no extra spaces or quotes

### Microsoft OAuth Issues

**Error: "AADSTS50011: The redirect URI does not match"**
- Ensure redirect URI in Azure exactly matches: `http://localhost:3001/api/oauth/microsoft/callback`

**Error: "AADSTS65001: User or administrator has not consented"**
- Add required permissions in Azure → API permissions
- Grant admin consent if you have access

**Error: "Invalid client secret"**
- Generate new client secret in Azure → Certificates & secrets
- Copy the VALUE (not the Secret ID)

### Apple OAuth Issues

**Error: "Invalid client"**
- Verify `APPLE_CLIENT_ID` matches your Services ID
- Check Services ID is configured correctly

**Error: "Invalid private key"**
- Ensure private key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Convert newlines to `\n` in the .env file

### General Issues

**Error: "Encryption key invalid"**
```bash
# Generate new key
openssl rand -hex 16
# Update ENCRYPTION_KEY in .env
```

**Error: "Database connection failed"**
- Check PostgreSQL is running on port 5433
- Verify `DATABASE_URL` in .env

**Error: "Session not found"**
- Session expired (10 minute TTL)
- Restart OAuth flow from the beginning

---

## 📞 Need Help?

If you're stuck on any step, let me know which provider you're configuring (Google, Microsoft, or Apple) and what error you're seeing!
