# Railway Production Environment Variables Setup

⚠️ **CRITICAL SECURITY REQUIREMENT**

**NEVER commit credentials to git. Use Railway dashboard ONLY.**

This document describes how to configure environment variables in Railway for production deployment.

**See also:**
- [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) - Complete security guide
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment process

---

## ⚠️ Core Principle: Zero Trust

- **NO credentials in code** - Railway dashboard environment variables ONLY
- **NO `.env` files in git** - They are gitignored but still risky to create
- **NO localhost testing** - Test in Railway production environment
- **NO hardcoded secrets** - Always use `os.getenv()`

---

## How to Set Environment Variables in Railway

1. Go to https://railway.app and login
2. Select your project: **alon-assistant**
3. Click on your **backend service** (NOT the database)
4. Click **"Variables"** tab
5. Add each variable below (click "+ New Variable")

---

## Required Environment Variables

### 1. SECRET_KEY (CRITICAL - Generate New!)

**Purpose:** JWT token signing and encryption

**⚠️ SECURITY CRITICAL:**
- Generate locally, NEVER commit to git
- Must be 32+ characters
- Unique per environment (never reuse)
- Rotate every 90 days (best practice)

**Generate a strong key locally:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Set in Railway dashboard:**
1. Copy the generated key
2. Railway → Backend Service → Variables
3. Add variable: `SECRET_KEY=<paste_generated_key_here>`
4. NEVER commit this value anywhere

**⚠️ WARNING:** If you accidentally commit SECRET_KEY to git, rotate immediately!

---

### 2. DATABASE_URL (Auto-Configured - DO NOT SET MANUALLY)

**Purpose:** PostgreSQL connection string

**⚠️ CRITICAL:** Railway automatically provides this. DO NOT set manually!

**How it works:**
1. Railway automatically injects `DATABASE_URL` from PostgreSQL service
2. Your backend reads it via `os.getenv("DATABASE_URL")`
3. Connection string includes credentials, host, port, database name

**To view your DATABASE_URL (for debugging only):**
1. Railway dashboard → PostgreSQL service (NOT backend)
2. Variables tab → DATABASE_URL
3. **NEVER copy this to git or documentation**

**Credential rotation:**
- If DATABASE_URL is exposed, create new PostgreSQL service
- See [DATABASE_ROTATION_GUIDE.md](DATABASE_ROTATION_GUIDE.md)

**Format (for reference only):**
```
postgresql://postgres:PASSWORD@HOST:PORT/railway
```

**DO NOT hardcode this URL anywhere!** Railway manages it automatically.

---

### 3. ENVIRONMENT (REQUIRED)

**Purpose:** Enables production security features

**Set in Railway:**
```
ENVIRONMENT=production
```

**What this enables:**
- HSTS security headers
- Stricter CORS policies
- Production logging
- Security validations

---

### 4. CORS_ORIGINS (CRITICAL - Security Feature)

**Purpose:** Controls which domains can access your API (prevents unauthorized access)

**⚠️ SECURITY CRITICAL:**
- MUST be exact production domain
- NO wildcards (*) allowed
- NO localhost URLs
- NO trailing slashes
- NO spaces in comma-separated list

**Current Production Value:**
```
CORS_ORIGINS=https://sam.alontechnologies.com
```

**Set in Railway:**
```bash
# Single domain (current production)
CORS_ORIGINS=https://sam.alontechnologies.com

# Multiple domains (if needed)
CORS_ORIGINS=https://sam.alontechnologies.com,https://app.customdomain.com
```

**❌ NEVER use wildcards:**
```bash
# WRONG - Allows anyone to access your API!
CORS_ORIGINS=*
CORS_ORIGINS=https://*.vercel.app
```

**How to find your Vercel domain:**
1. Go to https://vercel.com/dashboard
2. Find your frontend project
3. Copy the production domain
4. Include `https://` protocol
5. NO trailing slash

**Testing CORS:**
```bash
curl -I -X OPTIONS https://alon-assistant.up.railway.app/api/v1/auth/login \
  -H "Origin: https://sam.alontechnologies.com" \
  -H "Access-Control-Request-Method: POST"

# Should return:
# Access-Control-Allow-Origin: https://sam.alontechnologies.com
# Access-Control-Allow-Credentials: true
```

---

### 5. ANTHROPIC_API_KEY (Already Set)

**Purpose:** Claude AI integration

**Note:** This should already be set. Verify it exists:
```
ANTHROPIC_API_KEY=sk-ant-...
```

---

### 6. REDIS_URL (Optional - for token blacklist)

**Purpose:** Token revocation and caching

**If using Railway Redis:**
```
REDIS_URL=redis://default:<password>@<host>:<port>
```

**If not using Redis:** The app will fall back to in-memory storage (less secure for distributed deployments)

---

### 7. ACCESS_TOKEN_EXPIRE_MINUTES (Recommended for Security)

**Purpose:** How long access tokens are valid before user must refresh

**Security principle:** Shorter = more secure (in case of token theft)

**Recommended for production:**
```
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Default if not set:** 60 minutes (less secure)

**Why 30 minutes?**
- Balance between security and user experience
- Compromised tokens expire quickly
- Refresh tokens allow seamless re-authentication
- NIST recommends short-lived access tokens

---

### 8. REFRESH_TOKEN_EXPIRE_DAYS (Recommended for Security)

**Purpose:** How long refresh tokens are valid before user must re-login

**Recommended for production:**
```
REFRESH_TOKEN_EXPIRE_DAYS=7
```

**Default if not set:** 30 days (less secure)

**Why 7 days?**
- Users re-authenticate weekly
- Reduces risk of stolen refresh tokens
- Good balance for active users
- Inactive users automatically logged out after 7 days

---

### 9. LOG_LEVEL (Optional)

**Purpose:** Controls logging verbosity

**Recommended for production:**
```
LOG_LEVEL=INFO
```

**Options:** DEBUG, INFO, WARNING, ERROR, CRITICAL

---

## Complete Production Configuration Checklist

Copy this checklist and set ALL variables in Railway dashboard:

```bash
# REQUIRED - Generate new!
SECRET_KEY=<run: python3 -c "import secrets; print(secrets.token_urlsafe(32))">

# REQUIRED - Set to production
ENVIRONMENT=production

# REQUIRED - Your Vercel frontend domain
CORS_ORIGINS=https://your-frontend-app.vercel.app

# Already set by Railway
DATABASE_URL=postgresql://postgres:...

# Already set (verify exists)
ANTHROPIC_API_KEY=sk-ant-...

# RECOMMENDED
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
LOG_LEVEL=INFO

# OPTIONAL (if using Redis)
# REDIS_URL=redis://default:...
```

---

## After Setting Environment Variables

### 1. Run Database Migration

The new security features require database schema changes. Run this in Railway:

```bash
alembic upgrade head
```

**How to run in Railway:**
1. Go to your Railway project
2. Click on your backend service
3. Go to "Settings" → "Deploy"
4. Click "Deploy" to redeploy with new environment variables

The migration will automatically run on deployment if configured in your startup script.

---

### 2. Verify Deployment

After deployment, test that everything works:

1. **Check health endpoint:**
   ```
   curl https://alon-assistant.up.railway.app/health
   ```

2. **Verify CORS headers:**
   ```
   curl -I -X OPTIONS https://alon-assistant.up.railway.app/api/v1/auth/login \
     -H "Origin: https://your-frontend-app.vercel.app" \
     -H "Access-Control-Request-Method: POST"
   ```

   Should return:
   ```
   Access-Control-Allow-Origin: https://your-frontend-app.vercel.app
   Access-Control-Allow-Credentials: true
   ```

3. **Test login:**
   Try logging in from your Vercel frontend

4. **Check Railway logs:**
   - Go to Railway dashboard
   - Click on your backend service
   - Click "Deployments" → "View Logs"
   - Look for security event logs (JSON format)

---

## Security Best Practices

### ✅ DO:
- Generate a new SECRET_KEY for production (never reuse)
- Set CORS_ORIGINS to your specific Vercel domain
- Set ENVIRONMENT=production
- Use HTTPS for all domains
- Monitor Railway logs for security events
- Rotate SECRET_KEY if ever compromised

### ❌ DON'T:
- Use wildcards (*) in CORS_ORIGINS
- Commit SECRET_KEY to git
- Use the same SECRET_KEY as development
- Set ENVIRONMENT=development in production
- Share DATABASE_URL publicly

---

## Troubleshooting

### Issue: "CORS error" in frontend

**Solution:** Check CORS_ORIGINS is set to your EXACT Vercel domain
```bash
# In Railway, verify:
CORS_ORIGINS=https://your-exact-domain.vercel.app

# NOT:
CORS_ORIGINS=* # Wrong!
CORS_ORIGINS=http://your-domain.vercel.app # Wrong! Must be https://
```

### Issue: "SECRET_KEY not configured" error

**Solution:** Generate and set SECRET_KEY in Railway dashboard
```bash
# Run locally:
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Copy output to Railway variable:
SECRET_KEY=<paste_here>
```

### Issue: Database migration fails

**Solution:** Check DATABASE_URL is correct and accessible
```bash
# In Railway logs, look for:
"Detected added column 'users.failed_login_attempts'"

# If migration fails, manually run:
alembic upgrade head
```

### Issue: Login returns 423 (Locked)

**Normal behavior:** Account locked after 5 failed attempts
**Wait:** 30 minutes for automatic unlock
**Or:** Manually reset in database:
```sql
UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE email = 'user@example.com';
```

---

## Next Steps: Vercel Frontend Configuration

Your frontend on Vercel also needs environment variables. Set this in Vercel dashboard:

```bash
# Vercel Environment Variable:
VITE_API_BASE_URL=https://alon-assistant.up.railway.app/api/v1
```

**How to set in Vercel:**
1. Go to https://vercel.com/dashboard
2. Select your frontend project
3. Go to "Settings" → "Environment Variables"
4. Add: VITE_API_BASE_URL = https://alon-assistant.up.railway.app/api/v1
5. Redeploy your frontend

---

## Questions?

If you encounter any issues:
1. Check Railway logs for error messages
2. Verify all environment variables are set correctly
3. Ensure database migration completed successfully
4. Test CORS configuration with curl commands above

---

**Last Updated:** 2025-01-12
**For Production Deployment Only**
