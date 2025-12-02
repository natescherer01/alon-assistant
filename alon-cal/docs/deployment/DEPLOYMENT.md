# Deployment Guide

Complete guide for deploying the Calendar Integration Application to production.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Railway Backend Deployment](#railway-backend-deployment)
- [Vercel Frontend Deployment](#vercel-frontend-deployment)
- [OAuth Configuration](#oauth-configuration)
- [Environment Variables](#environment-variables)
- [Database Migrations](#database-migrations)
- [Custom Domains](#custom-domains)
- [Monitoring and Logging](#monitoring-and-logging)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Overview

**Deployment Architecture:**
- **Frontend**: Vite + React + TypeScript → Vercel
- **Backend**: Express + TypeScript + Prisma → Railway
- **Database**: PostgreSQL → Railway

**Deployment Flow:**
1. Backend deployed to Railway with PostgreSQL
2. Frontend deployed to Vercel
3. OAuth apps configured with production URLs
4. Environment variables configured
5. Database migrations applied
6. Health checks verified

## Prerequisites

Before deploying, ensure you have:

- [ ] GitHub account (for CI/CD)
- [ ] Railway account (for backend and database)
- [ ] Vercel account (for frontend)
- [ ] Google Cloud account (for Google Calendar OAuth)
- [ ] Microsoft Azure account (for Microsoft Calendar OAuth)
- [ ] Custom domain (optional but recommended)

## Railway Backend Deployment

### Step 1: Create Railway Project

1. Go to [Railway](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Select the `backend` directory as the root

### Step 2: Provision PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically provision the database
4. The `DATABASE_URL` environment variable will be automatically set

### Step 3: Configure Environment Variables

In Railway project settings, add the following environment variables:

```bash
# Automatically provided by Railway
DATABASE_URL=postgresql://...  # Auto-generated

# Application Configuration
NODE_ENV=production
PORT=3001
API_URL=https://your-backend.railway.app
FRONTEND_URL=https://your-frontend.vercel.app

# JWT Configuration (IMPORTANT: Generate secure values!)
JWT_SECRET=<generate-with-openssl-rand-base64-64>
JWT_EXPIRES_IN=7d

# Encryption Key (IMPORTANT: Must be exactly 32 characters)
ENCRYPTION_KEY=<generate-32-char-string>

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Microsoft OAuth
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_TENANT_ID=common

# CORS
CORS_ORIGIN=https://your-frontend.vercel.app

# Logging
LOG_LEVEL=info
```

**Generate Secure Secrets:**

```bash
# Generate JWT_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate ENCRYPTION_KEY (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex').substring(0, 32))"
```

### Step 4: Deploy Backend

Railway will automatically:
1. Install dependencies
2. Generate Prisma Client
3. Run database migrations
4. Build TypeScript
5. Start the application

**Verify Deployment:**
```bash
curl https://your-backend.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 123.45,
  "environment": "production",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 15
    },
    "oauth": {
      "status": "healthy",
      "configured": {
        "google": true,
        "microsoft": true
      }
    },
    "memory": {
      "usage": 45,
      "usagePercent": 25.5,
      "total": 176,
      "free": 131
    }
  }
}
```

### Step 5: Configure Custom Domain (Optional)

1. In Railway project → Settings → Domains
2. Click "Generate Domain" for free Railway domain
3. Or add custom domain:
   - Click "Custom Domain"
   - Enter your domain (e.g., `api.yourdomain.com`)
   - Add DNS records as shown by Railway
   - Wait for DNS propagation (5-60 minutes)

## Vercel Frontend Deployment

### Step 1: Import Project

1. Go to [Vercel](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Import your GitHub repository
5. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 2: Configure Environment Variables

In Vercel project settings → Environment Variables:

```bash
VITE_API_URL=https://your-backend.railway.app
```

**Important**: Environment variables starting with `VITE_` are exposed to the browser.

### Step 3: Deploy Frontend

1. Click "Deploy"
2. Vercel will automatically:
   - Install dependencies
   - Build the application
   - Deploy to CDN

**Verify Deployment:**

Visit your Vercel URL and verify the application loads correctly.

### Step 4: Configure Custom Domain (Optional)

1. In Vercel project → Settings → Domains
2. Click "Add"
3. Enter your domain (e.g., `app.yourdomain.com`)
4. Add DNS records as shown by Vercel:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```
5. Wait for DNS propagation

**Update Environment Variables:**

After adding custom domain, update backend environment variables:
```bash
FRONTEND_URL=https://app.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com
```

## OAuth Configuration

### Google Calendar OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project or create new one
3. Enable Google Calendar API:
   - APIs & Services → Library
   - Search "Google Calendar API"
   - Click "Enable"
4. Create OAuth credentials:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: Web application
   - Name: "Calendar Integration App"
5. Add authorized redirect URIs:
   ```
   https://your-backend.railway.app/api/oauth/google/callback
   ```
6. Copy Client ID and Client Secret to Railway environment variables

### Microsoft Calendar OAuth

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "App registrations"
3. Click "New registration"
4. Configure:
   - Name: "Calendar Integration App"
   - Supported account types: Multitenant
   - Redirect URI: Web → `https://your-backend.railway.app/api/oauth/microsoft/callback`
5. Click "Register"
6. Add API permissions:
   - Microsoft Graph → Delegated permissions
   - Add: `Calendars.ReadWrite`, `offline_access`, `User.Read`
   - Click "Grant admin consent" (if applicable)
7. Create client secret:
   - Certificates & secrets → New client secret
   - Description: "Production Secret"
   - Expires: 24 months
   - Copy the secret value (shown once!)
8. Copy Application (client) ID and Client Secret to Railway

## Environment Variables

### Complete Backend Environment Variables

```bash
# Database (auto-provided by Railway)
DATABASE_URL=postgresql://...

# Application
NODE_ENV=production
PORT=3001
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com

# Security
JWT_SECRET=<64-char-random-string>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-char-random-string>

# Google OAuth
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# Microsoft OAuth
MICROSOFT_CLIENT_ID=xxxxx-xxxxx-xxxxx-xxxxx-xxxxx
MICROSOFT_CLIENT_SECRET=xxxxx~xxxxx
MICROSOFT_TENANT_ID=common

# CORS
CORS_ORIGIN=https://app.yourdomain.com

# Logging
LOG_LEVEL=info
```

### Complete Frontend Environment Variables

```bash
VITE_API_URL=https://api.yourdomain.com
```

## Database Migrations

### Automatic Migrations (Railway)

Railway automatically runs migrations on deployment via `nixpacks.toml`:

```toml
[start]
cmd = "npx prisma migrate deploy && node dist/index.js"
```

### Manual Migrations

If needed, run migrations manually:

```bash
# SSH into Railway container
railway run

# Run migrations
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### Rollback Migrations

To rollback migrations:

1. Restore database from backup (see Backup/Restore section)
2. Deploy previous version of code
3. Verify application works

## Custom Domains

### Backend (Railway)

**DNS Configuration:**

```
Type: CNAME
Name: api
Value: <your-project>.railway.app
TTL: 3600
```

**SSL Certificate:**

Railway automatically provisions SSL certificates via Let's Encrypt.

### Frontend (Vercel)

**DNS Configuration:**

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 3600
```

**SSL Certificate:**

Vercel automatically provisions SSL certificates.

### Apex Domain

For apex domain (e.g., `yourdomain.com`):

```
Type: ALIAS or ANAME
Name: @
Value: cname.vercel-dns.com
TTL: 3600
```

## Monitoring and Logging

### Railway Logs

1. Go to Railway project → Deployments
2. Click on active deployment
3. View real-time logs in "Logs" tab

**Filter logs:**
```bash
railway logs --filter "error"
```

### Vercel Logs

1. Go to Vercel project → Deployments
2. Click on deployment
3. View "Build Logs" and "Function Logs"

### Health Check Monitoring

**Monitor backend health:**

```bash
# Check health endpoint
curl https://api.yourdomain.com/api/health

# Check readiness
curl https://api.yourdomain.com/api/health/ready

# Check liveness
curl https://api.yourdomain.com/api/health/live
```

**Setup external monitoring:**

Use services like:
- UptimeRobot
- Pingdom
- Better Stack

Configure to monitor:
- Health endpoint: `https://api.yourdomain.com/api/health`
- Interval: 5 minutes
- Alert on: Status code != 200

### Error Tracking (Optional)

Add Sentry for error tracking:

```bash
npm install @sentry/node
```

Backend configuration:
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## Rollback Procedures

### Backend Rollback

**Option 1: Redeploy Previous Version (Railway)**

1. Go to Railway project → Deployments
2. Find previous successful deployment
3. Click "..." → "Redeploy"

**Option 2: Git Revert**

```bash
# Find commit to revert to
git log --oneline

# Revert to specific commit
git revert <commit-hash>

# Push to trigger new deployment
git push origin main
```

### Frontend Rollback (Vercel)

1. Go to Vercel project → Deployments
2. Find previous deployment
3. Click "..." → "Promote to Production"

### Database Rollback

**Restore from backup:**

```bash
# Download backup from Railway
railway run pg_dump -Fc > backup.dump

# Or use backup script
./backend/scripts/restore-db.sh backups/backup_20240101.sql.gz
```

## Troubleshooting

### Backend Issues

**502 Bad Gateway**

- Check Railway logs for errors
- Verify health endpoint returns 200
- Check database connection
- Verify environment variables set correctly

**Database Connection Errors**

```bash
# Verify DATABASE_URL
railway variables

# Test database connection
railway run npx prisma db push --force-reset
```

**OAuth Errors**

- Verify redirect URIs match production URLs
- Check OAuth credentials are correct
- Verify API permissions granted
- Check CORS_ORIGIN matches frontend URL

### Frontend Issues

**Blank Page**

- Check browser console for errors
- Verify VITE_API_URL environment variable
- Check API is accessible from browser
- Verify CORS configured correctly

**API Calls Failing**

- Check VITE_API_URL is correct
- Verify backend health endpoint accessible
- Check browser network tab for errors
- Verify CORS headers present in response

### Database Issues

**Migrations Failing**

```bash
# Check migration status
railway run npx prisma migrate status

# Force reset (CAUTION: destroys data)
railway run npx prisma migrate reset --force

# Apply specific migration
railway run npx prisma migrate resolve --applied <migration-name>
```

**Connection Pool Exhausted**

Add connection pooling:

```bash
# In Railway environment variables
DATABASE_URL=postgresql://...?pgbouncer=true&connection_limit=10
```

### Common Issues

**Issue**: Environment variable not updating

**Solution**: Redeploy after changing environment variables

```bash
railway redeploy
```

**Issue**: OAuth redirect URI mismatch

**Solution**: Ensure redirect URIs in OAuth apps match exactly:
- Google: `https://api.yourdomain.com/api/oauth/google/callback`
- Microsoft: `https://api.yourdomain.com/api/oauth/microsoft/callback`

**Issue**: CORS errors

**Solution**: Update CORS_ORIGIN to match frontend URL:
```bash
CORS_ORIGIN=https://app.yourdomain.com
```

## Support

For additional help:
- Railway: https://railway.app/help
- Vercel: https://vercel.com/support
- Prisma: https://www.prisma.io/docs
- Google OAuth: https://developers.google.com/identity
- Microsoft OAuth: https://learn.microsoft.com/en-us/azure/active-directory/develop/

## Security Checklist

Before going live:

- [ ] JWT_SECRET is secure random string (64+ chars)
- [ ] ENCRYPTION_KEY is secure 32-char string
- [ ] OAuth secrets are production values (not test/dev)
- [ ] DATABASE_URL uses SSL (contains `?ssl=true` or `?sslmode=require`)
- [ ] CORS_ORIGIN set to production frontend URL only
- [ ] NODE_ENV=production
- [ ] Rate limiting enabled
- [ ] Health checks working
- [ ] Error monitoring configured
- [ ] Database backups enabled
- [ ] Custom domains using HTTPS
- [ ] OAuth apps configured with production redirect URIs
- [ ] Secrets rotated from defaults
- [ ] Environment variables not committed to git
