# Railway Production Environment Variables Setup

**CRITICAL:** These environment variables must be set in the Railway dashboard for PRODUCTION deployment.

Railway uses dashboard environment variables, NOT .env files in the repository.

## How to Set Environment Variables in Railway

1. Go to your Railway project: https://railway.app
2. Select your backend service
3. Click on "Variables" tab
4. Add each variable below

---

## Required Environment Variables

### 1. SECRET_KEY (CRITICAL - Generate New!)

**Purpose:** JWT token signing and encryption

**Generate a strong key:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Set in Railway:**
```
SECRET_KEY=<paste_generated_key_here>
```

**⚠️ WARNING:** Never reuse keys between environments. Generate a unique key for production.

---

### 2. DATABASE_URL (Already Set)

**Purpose:** PostgreSQL connection string

**Current Value (from your Railway dashboard):**
```
DATABASE_URL=postgresql://postgres:gWQAnFlcSsawPQeFIYJLciNxOPRnLWDz@crossover.proxy.rlwy.net:48825/railway
```

**Note:** Railway automatically provides this. Do not change unless migrating databases.

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

### 4. CORS_ORIGINS (CRITICAL)

**Purpose:** Controls which domains can access your API

**⚠️ IMPORTANT:** Replace with your actual Vercel frontend domain!

**Set in Railway:**
```
CORS_ORIGINS=https://your-frontend-app.vercel.app
```

**How to find your Vercel domain:**
1. Go to https://vercel.com/dashboard
2. Find your frontend project
3. Copy the production domain (looks like: `your-app-name.vercel.app`)
4. Use the FULL https:// URL

**Example:**
```
CORS_ORIGINS=https://alon-ai.vercel.app
```

**Multiple domains (if needed):**
```
CORS_ORIGINS=https://alon-ai.vercel.app,https://custom-domain.com
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

### 7. ACCESS_TOKEN_EXPIRE_MINUTES (Optional)

**Purpose:** How long access tokens are valid

**Recommended for production:**
```
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Default if not set:** 60 minutes

---

### 8. REFRESH_TOKEN_EXPIRE_DAYS (Optional)

**Purpose:** How long refresh tokens are valid

**Recommended for production:**
```
REFRESH_TOKEN_EXPIRE_DAYS=7
```

**Default if not set:** 30 days

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
