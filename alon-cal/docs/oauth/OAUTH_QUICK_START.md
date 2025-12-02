# 🚀 OAuth Quick Start Checklist

## ✅ Step 1: Encryption Key (DONE!)

Your secure encryption key has been generated and saved to `.env`:
```
ENCRYPTION_KEY="99f4014e648b29f2d0666e9b54e33510"
```

---

## 📋 Step 2: Choose Your Providers

You need to configure at least ONE provider to get started. I recommend starting with Google (easiest) or Microsoft.

**Which providers do you want to configure?**
- [ ] **Google Calendar** (Recommended - easiest setup, ~10 minutes)
- [ ] **Microsoft Outlook** (Moderate - requires Azure account, ~15 minutes)
- [ ] **Apple Calendar** (Advanced - requires Apple Developer Program $99/year, ~30 minutes)

---

## 🔵 Option A: Google Calendar (Recommended First)

**Time:** ~10 minutes

### Quick Steps:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/

2. **Create Project**:
   - Click "New Project"
   - Name: `alon-cal`
   - Click "Create"

3. **Enable Calendar API**:
   - Go to: https://console.cloud.google.com/apis/library
   - Search: "Google Calendar API"
   - Click "Enable"

4. **OAuth Consent Screen**:
   - Go to: https://console.cloud.google.com/apis/credentials/consent
   - User Type: "External"
   - App name: `Alon Cal`
   - User support email: Your email
   - Developer email: Your email
   - Click "Save and Continue"

5. **Add Scopes**:
   - Click "Add or Remove Scopes"
   - Add:
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
   - Click "Update" → "Save and Continue"

6. **Add Test Users**:
   - Add your email address
   - Click "Save and Continue"

7. **Create OAuth Client**:
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: `Alon Cal Web`
   - Authorized JavaScript origins:
     ```
     http://localhost:5173
     http://localhost:3001
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3001/api/oauth/google/callback
     ```
   - Click "Create"

8. **Copy Credentials**:
   - Copy the Client ID (looks like: `123456-abc.apps.googleusercontent.com`)
   - Copy the Client Secret (looks like: `GOCSPX-abc123`)

9. **Update .env**:
   ```bash
   cd /Users/natescherer/alon-cal/backend
   nano .env
   ```

   Replace:
   ```bash
   GOOGLE_CLIENT_ID="your-client-id-here"
   GOOGLE_CLIENT_SECRET="your-client-secret-here"
   ```

---

## 🔷 Option B: Microsoft Outlook

**Time:** ~15 minutes

### Quick Steps:

1. **Go to Azure Portal**: https://portal.azure.com/

2. **Register App**:
   - Search: "App registrations"
   - Click "New registration"
   - Name: `Alon Cal`
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"
   - Redirect URI (Web): `http://localhost:3001/api/oauth/microsoft/callback`
   - Click "Register"

3. **Copy Application IDs**:
   - Copy "Application (client) ID"
   - For "Directory (tenant) ID", use: `common`

4. **Create Client Secret**:
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - Description: `Alon Cal Dev`
   - Expires: "180 days"
   - Click "Add"
   - **Copy the VALUE immediately!** (you can't see it again)

5. **Add Permissions**:
   - Go to "API permissions"
   - Click "Add a permission" → "Microsoft Graph"
   - Select "Delegated permissions"
   - Add:
     - `Calendars.Read`
     - `User.Read`
     - `offline_access`
   - Click "Add permissions"

6. **Update .env**:
   ```bash
   cd /Users/natescherer/alon-cal/backend
   nano .env
   ```

   Replace:
   ```bash
   MICROSOFT_CLIENT_ID="your-application-id-here"
   MICROSOFT_CLIENT_SECRET="your-secret-value-here"
   MICROSOFT_TENANT_ID="common"
   ```

---

## 🍎 Option C: Apple Calendar (Optional - Advanced)

**Prerequisites:**
- Apple Developer Account
- Apple Developer Program enrollment ($99/year)

**Time:** ~30 minutes

This is more complex. If you want to set this up, follow the detailed guide in [OAUTH_SETUP_INTERACTIVE.md](OAUTH_SETUP_INTERACTIVE.md) Section 4.

**Or skip Apple for now** - you can always add it later!

---

## ✅ Step 3: Test Your Configuration

After configuring at least ONE provider:

### 3.1 Start Backend

```bash
cd /Users/natescherer/alon-cal/backend
npm run dev
```

You should see:
```
✓ Server running on http://localhost:3001
✓ Database connected
```

### 3.2 Start Frontend (new terminal)

```bash
cd /Users/natescherer/alon-cal/frontend
npm run dev
```

You should see:
```
➜  Local:   http://localhost:5173/
```

### 3.3 Test OAuth Flow

1. Open browser: **http://localhost:5173**
2. Click **"Connect Calendar"**
3. Select your configured provider (Google or Microsoft)
4. Complete OAuth authorization
5. Select calendars
6. Click **"Connect"**
7. ✅ **Success!** You should see your connected calendars

---

## 🎯 Current Status

- ✅ Encryption key generated and saved
- ⏳ Waiting for you to configure at least one OAuth provider

**What's next?**
1. Choose which provider(s) you want to configure (Google is easiest!)
2. Follow the quick steps above
3. Test the integration
4. Add more providers as needed

---

## 🐛 Common Issues

### "Redirect URI mismatch"
- Make sure the redirect URI in OAuth provider EXACTLY matches the one in `.env`
- No trailing slashes
- Check for http vs https

### "Invalid client"
- Double-check you copied the credentials correctly
- No extra spaces or quotes

### "Access denied" or "User not added"
- Add your email as a test user in OAuth consent screen (Google)
- Grant required permissions (Microsoft)

---

## 📚 Detailed Documentation

- **Full OAuth Setup Guide**: [OAUTH_SETUP_INTERACTIVE.md](OAUTH_SETUP_INTERACTIVE.md)
- **Troubleshooting**: [OAUTH_SETUP_INTERACTIVE.md](OAUTH_SETUP_INTERACTIVE.md) → Troubleshooting section

---

## 💬 Need Help?

Let me know:
1. Which provider you want to configure (Google, Microsoft, or both)
2. Where you're stuck (if any)
3. Any error messages you see

I can help guide you through each step!
