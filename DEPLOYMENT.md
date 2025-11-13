# Deployment Guide - Railway

This guide covers deploying the Personal AI Assistant to production using Railway for hosting.

## Overview

This SaaS application uses:
- **Railway** - Backend hosting, PostgreSQL, and Redis
- **Vercel or Netlify** - Frontend hosting (recommended)
- **Company-provided Anthropic API key** - No user API key management

Total estimated cost: **$15-20/month** (Railway only)

---

## Prerequisites

1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **Vercel or Netlify Account** - For frontend hosting
3. **Anthropic API Key** - Your company key from [console.anthropic.com](https://console.anthropic.com)
4. **Domain** (optional) - For custom URLs

---

## Part 1: Deploy Backend to Railway

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and login
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select this repository
5. Railway will auto-detect the Python project

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically provision PostgreSQL
3. Railway auto-injects `DATABASE_URL` environment variable into your backend service

### Step 3: Add Redis

1. Click "New" → "Database" → "Add Redis"
2. Railway will provision Redis
3. Railway auto-injects `REDIS_URL` environment variable into your backend service

### Step 4: Configure Backend Environment Variables

In your Railway backend service, add these environment variables:

⚠️ **CRITICAL: NEVER commit credentials to git. Set in Railway dashboard ONLY.**

In Railway dashboard → Backend Service → Variables tab:

**REQUIRED:**
```bash
# Generate a secure secret key (NEVER reuse between environments)
SECRET_KEY=<generate-with-command-below>

# Your company's Anthropic API key
ANTHROPIC_API_KEY=sk-ant-your-company-key-here

# MUST be "production" for security features to work
ENVIRONMENT=production

# Exact production domain (NO wildcards, NO trailing slash)
CORS_ORIGINS=https://sam.alontechnologies.com
```

Generate `SECRET_KEY` **locally** (never commit):
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy output to Railway dashboard
```

**RECOMMENDED (security hardened):**
```bash
# Shorter token lifetime = more secure
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Production logging
LOG_LEVEL=INFO
```

**Auto-configured by Railway (NEVER set manually):**
- `DATABASE_URL` - PostgreSQL connection (Railway provides)
- `REDIS_URL` - Redis connection (Railway provides)

**See:** [RAILWAY_ENVIRONMENT_SETUP.md](RAILWAY_ENVIRONMENT_SETUP.md) for detailed variable documentation

### Step 5: Set Root Directory (Important!)

Railway needs to know where your backend code is:

1. In Railway project settings → "Service Settings"
2. Set **Root Directory** to: `backend`
3. Set **Start Command** to: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Step 6: Deploy

Railway will automatically deploy when you:
- Push to your GitHub repository (if connected)
- Or click "Deploy" in Railway dashboard

Monitor deployment logs in Railway dashboard.

### Step 7: Get Backend URL

Once deployed, Railway provides a public URL like:
```
https://your-project-name.railway.app
```

Your API will be at: `https://your-project-name.railway.app/api/v1`

Test it:
```bash
curl https://your-project-name.railway.app/health
```

---

## Part 2: Deploy Frontend

### Option A: Deploy to Vercel (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and login
2. Click "New Project"
3. Import your GitHub repository
4. **Configure project:**
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **Add environment variable:**
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app/api/v1
   ```

6. Click "Deploy"

### Option B: Deploy to Netlify

1. **Go to [netlify.com](https://netlify.com)** and login
2. Click "Add new site" → "Import an existing project"
3. Connect your GitHub repository
4. **Configure build settings:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

5. **Add environment variable:**
   ```
   VITE_API_BASE_URL=https://your-backend.railway.app/api/v1
   ```

6. Click "Deploy site"

---

## Part 3: Update Backend CORS

After deploying frontend, update your backend CORS settings:

1. Go to Railway → Your backend service → Variables
2. Update `CORS_ORIGINS` to include your frontend URL:
   ```
   CORS_ORIGINS=https://your-app.vercel.app,https://www.your-domain.com
   ```
3. Railway will automatically redeploy

---

## Part 4: Run Database Migrations

Railway should auto-run migrations, but if needed:

1. In Railway, open your backend service shell
2. Run:
   ```bash
   alembic upgrade head
   ```

Or use Railway's "One-off command" feature.

---

## Part 5: Testing & Verification

### 1. Test Backend Health

```bash
curl https://your-backend.railway.app/
```

Should return: `{"status":"ok","app":"Personal AI Assistant",...}`

### 2. Test Signup

```bash
curl -X POST https://your-backend.railway.app/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "full_name": "Test User"
  }'
```

Should return tokens:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### 3. Test Frontend

Visit your frontend URL (e.g., `https://your-app.vercel.app`)
1. Click "Sign up"
2. Create account
3. Login
4. Verify dashboard loads
5. Try creating a task
6. Try chatting with Claude

### 4. Check Logs

**Railway:**
- Click on your backend service → "Logs"
- Look for errors or warnings

**Vercel/Netlify:**
- Check deployment logs in dashboard

---

## Monitoring & Maintenance

### Railway Logs

View real-time logs:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs
```

Or use Railway web dashboard.

### Database Backups

Railway provides automatic daily backups for PostgreSQL.

Manual backup:
```bash
# Get DATABASE_URL from Railway variables
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

### Environment Variable Updates

To update environment variables:
1. Go to Railway → Service → Variables
2. Update the variable
3. Railway auto-redeploys

**Note:** Never commit `.env` files to git!

---

## Security Checklist

Before going live (CRITICAL):

### Environment Variables
- [ ] `SECRET_KEY` generated with `secrets.token_urlsafe(32)` (32+ chars)
- [ ] `ANTHROPIC_API_KEY` is set (company key from console.anthropic.com)
- [ ] `ENVIRONMENT=production` (MUST be set for security features)
- [ ] `CORS_ORIGINS=https://sam.alontechnologies.com` (exact domain, no wildcards)
- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES=30` (recommended)
- [ ] `REFRESH_TOKEN_EXPIRE_DAYS=7` (recommended)
- [ ] PostgreSQL auto-configured by Railway (check Variables tab)
- [ ] Redis auto-configured by Railway (check Variables tab)
- [ ] Frontend `VITE_API_BASE_URL=https://alon-assistant.up.railway.app/api/v1`

### Git Security
- [ ] NO `.env` files committed: `git log -p | grep -i "password\|secret\|api"`
- [ ] NO credentials in code: `git log -p | grep -i "DATABASE_URL"`
- [ ] NO hardcoded passwords anywhere in repository
- [ ] `.gitignore` includes `.env` and `.env.*`

### Deployment Verification
- [ ] HTTPS is enabled (Railway does automatically)
- [ ] Database migrations ran successfully (check Railway logs)
- [ ] Health check returns 200: `curl https://alon-assistant.up.railway.app/health`
- [ ] Security headers present: `curl -I https://alon-assistant.up.railway.app/health`
  - [ ] `Strict-Transport-Security` header present
  - [ ] `X-Content-Type-Options: nosniff` present
  - [ ] `X-Frame-Options: DENY` present
  - [ ] `Content-Security-Policy` present

### Functional Testing
- [ ] Test signup: Create new account at https://sam.alontechnologies.com
- [ ] Test login: Login works, JWT tokens returned
- [ ] Test tasks: Create, edit, complete, delete tasks
- [ ] Test chat: AI chat responds correctly
- [ ] Test logout: Token revoked, can't access API after logout
- [ ] Test account lockout: 5 failed logins locks account for 30 minutes
- [ ] Test rate limiting: 100+ requests in 1 minute returns 429
- [ ] Check Railway logs for errors (Backend Service → Logs)

### Security Features
- [ ] CORS only allows `https://sam.alontechnologies.com`
- [ ] Password requirements enforced (12+ chars, complexity, NIST)
- [ ] Failed login attempts logged (JSON format in Railway logs)
- [ ] Account lockout working (5 failed attempts)
- [ ] Token blacklist working (Redis connected)
- [ ] Rate limiting working (100 req/min per IP)

**See:** [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) for complete security verification

---

## Troubleshooting

### Issue: "Failed to load secrets from GCP"

This is expected - you're using Railway environment variables, not GCP Secret Manager.

**Solution:** Ignore this error. Ensure `SECRET_KEY` and `ANTHROPIC_API_KEY` are set in Railway.

### Issue: "CORS policy" errors in browser

**Solution:**
1. Check `CORS_ORIGINS` in Railway includes your frontend URL
2. No spaces in comma-separated list
3. Include `https://` protocol
4. Railway auto-redeploys when you change variables

### Issue: "Database connection error"

**Solution:**
1. Verify PostgreSQL addon is added in Railway
2. Check Railway logs for detailed error
3. Ensure migrations ran: `alembic upgrade head`

### Issue: "Redis connection failed"

**Solution:**
1. Verify Redis addon is added in Railway
2. Redis is optional - app works without it (but no token revocation)
3. Check Railway logs for details

### Issue: Frontend can't reach backend

**Solution:**
1. Check `VITE_API_BASE_URL` in Vercel/Netlify environment variables
2. Ensure it includes `/api/v1` at the end
3. Verify backend is running (visit the URL in browser)
4. Check Railway backend logs

### Issue: "Authentication failed" / "Invalid API key"

**Solution:**
1. Check `ANTHROPIC_API_KEY` is set correctly in Railway
2. Verify key is valid at https://console.anthropic.com/
3. Check you have available credits
4. Check Railway logs for detailed error

---

## Cost Breakdown

### Railway
- Hobby Plan: $5/month
- PostgreSQL: $5-10/month
- Redis: $5/month
- **Total: ~$15-20/month**

### Vercel/Netlify
- Free tier: $0/month (for small projects)
- Pro: $20/month (if you need more)

### Anthropic
- Pay per use based on token consumption
- Claude API: ~$3-15 per million tokens (depends on model)

**Total estimated cost: $15-40/month** depending on usage.

---

## Scaling

As your user base grows:

1. **Upgrade Railway plan** - More resources for backend
2. **Add more PostgreSQL capacity** - Railway offers larger databases
3. **Enable PostgreSQL replicas** - For read performance
4. **Add Redis caching** - Cache frequent queries
5. **Monitor costs** - Railway and Anthropic dashboards

---

## Support

If you encounter issues:

1. **Check Railway logs:** Railway Dashboard → Service → Logs
2. **Check Vercel/Netlify logs:** Deployment logs in dashboard
3. **Review API docs:** `https://your-backend.railway.app/docs`
4. **Check this guide:** Troubleshooting section above

---

**Your app is now production-ready and live! 🎉**
