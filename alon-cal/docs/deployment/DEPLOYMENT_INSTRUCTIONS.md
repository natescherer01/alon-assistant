# Quick Deployment Instructions

Fast-track guide to deploy the Calendar Integration Application to production.

## Prerequisites

1. GitHub account with repository
2. Railway account (https://railway.app)
3. Vercel account (https://vercel.com)
4. Google Cloud Console account
5. Microsoft Azure account

## Step 1: Deploy Backend to Railway (10 minutes)

### A. Create Railway Project

1. Go to https://railway.app
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Select `backend` directory

### B. Add PostgreSQL Database

1. Click "New" → "Database" → "PostgreSQL"
2. Database will be provisioned automatically
3. `DATABASE_URL` is set automatically

### C. Set Environment Variables

In Railway project settings, add these variables:

```bash
NODE_ENV=production
PORT=3001
API_URL=https://your-project.railway.app
FRONTEND_URL=https://your-frontend.vercel.app

# Generate these securely:
JWT_SECRET=<run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
ENCRYPTION_KEY=<run: node -e "console.log(require('crypto').randomBytes(32).toString('hex').substring(0, 32))">

# Will be set in Step 3
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
MICROSOFT_CLIENT_ID=<from-azure-portal>
MICROSOFT_CLIENT_SECRET=<from-azure-portal>
MICROSOFT_TENANT_ID=common

CORS_ORIGIN=https://your-frontend.vercel.app
LOG_LEVEL=info
```

### D. Deploy

Railway automatically deploys when you push to GitHub:
```bash
git push origin main
```

### E. Verify Deployment

```bash
curl https://your-project.railway.app/api/health
```

Expected: Status 200 with health check data

## Step 2: Deploy Frontend to Vercel (5 minutes)

### A. Import Project

1. Go to https://vercel.com
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Set root directory: `frontend`
5. Framework: Vite (auto-detected)

### B. Set Environment Variable

In Vercel project settings → Environment Variables:

```bash
VITE_API_URL=https://your-project.railway.app
```

### C. Deploy

Click "Deploy"

Vercel builds and deploys automatically.

### D. Update Railway CORS

In Railway, update these variables with your Vercel URL:
```bash
FRONTEND_URL=https://your-project.vercel.app
CORS_ORIGIN=https://your-project.vercel.app
```

Click "Redeploy" in Railway.

## Step 3: Configure OAuth (15 minutes)

### Google Calendar OAuth

1. Go to https://console.cloud.google.com
2. Create project or select existing
3. Enable "Google Calendar API"
4. Create OAuth 2.0 credentials
5. Add redirect URI:
   ```
   https://your-project.railway.app/api/oauth/google/callback
   ```
6. Copy Client ID and Client Secret
7. Add to Railway variables:
   ```bash
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```

### Microsoft Calendar OAuth

1. Go to https://portal.azure.com
2. Navigate to "App registrations" → "New registration"
3. Add redirect URI:
   ```
   https://your-project.railway.app/api/oauth/microsoft/callback
   ```
4. Add API permissions:
   - Calendars.ReadWrite
   - offline_access
   - User.Read
5. Create client secret (Certificates & secrets)
6. Copy Application ID and Client Secret
7. Add to Railway variables:
   ```bash
   MICROSOFT_CLIENT_ID=...
   MICROSOFT_CLIENT_SECRET=...
   MICROSOFT_TENANT_ID=common
   ```

### Redeploy Backend

In Railway, click "Redeploy" to apply OAuth variables.

## Step 4: Verify Deployment (5 minutes)

### Health Check

```bash
curl https://your-project.railway.app/api/health
```

Should show:
- status: "healthy"
- database: "healthy"
- oauth: "healthy" with both Google and Microsoft configured

### Test Application

1. Visit your Vercel URL
2. Register a new account
3. Login
4. Try connecting Google Calendar
5. Try connecting Microsoft Calendar
6. Verify calendar data loads

## Step 5: Optional - Custom Domains

### Backend Domain (api.yourdomain.com)

**Railway:**
1. Project → Settings → Domains
2. Add custom domain: `api.yourdomain.com`
3. Add DNS CNAME record:
   ```
   Type: CNAME
   Name: api
   Value: your-project.railway.app
   ```

**Update Variables:**
```bash
API_URL=https://api.yourdomain.com
```

### Frontend Domain (app.yourdomain.com)

**Vercel:**
1. Project → Settings → Domains
2. Add domain: `app.yourdomain.com`
3. Add DNS CNAME record:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

**Update Backend Variables:**
```bash
FRONTEND_URL=https://app.yourdomain.com
CORS_ORIGIN=https://app.yourdomain.com
```

**Update OAuth Redirect URIs:**
- Google: `https://api.yourdomain.com/api/oauth/google/callback`
- Microsoft: `https://api.yourdomain.com/api/oauth/microsoft/callback`

## Step 6: Set Up Monitoring

### Health Check Monitoring

Use UptimeRobot (free):
1. Go to https://uptimerobot.com
2. Add new monitor
3. URL: `https://your-project.railway.app/api/health`
4. Interval: 5 minutes
5. Alert email: your email

## Troubleshooting

### Backend won't deploy
- Check Railway logs
- Verify all environment variables are set
- Ensure DATABASE_URL is present

### Frontend can't connect to backend
- Verify VITE_API_URL is correct
- Check CORS_ORIGIN on backend
- Test health endpoint directly

### OAuth not working
- Verify redirect URIs match exactly
- Check OAuth credentials are correct
- Ensure API permissions are granted
- Check health endpoint shows OAuth as "healthy"

### Database connection fails
- Check DATABASE_URL in Railway
- Verify PostgreSQL service is running
- Check Railway logs for errors

## Quick Reference

### Generate Secrets

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex').substring(0, 32))"
```

### Railway CLI Commands

```bash
railway login
railway link
railway variables
railway logs
railway open
```

### Vercel CLI Commands

```bash
vercel
vercel --prod
vercel env ls
vercel logs
```

## Next Steps

- [ ] Set up custom domains
- [ ] Configure monitoring alerts
- [ ] Review production checklist
- [ ] Test all features
- [ ] Document any customizations

## Complete Guides

For detailed instructions, see:
- `DEPLOYMENT.md` - Complete deployment guide
- `backend/RAILWAY_DEPLOYMENT.md` - Railway-specific guide
- `frontend/VERCEL_DEPLOYMENT.md` - Vercel-specific guide
- `PRODUCTION_CHECKLIST.md` - Pre/post deployment checklist

## Estimated Time

- Backend deployment: 10 minutes
- Frontend deployment: 5 minutes
- OAuth configuration: 15 minutes
- Verification: 5 minutes
- Custom domains: 15 minutes (optional)

**Total: 35 minutes (50 minutes with custom domains)**

## Support

If you need help:
1. Check `DEPLOYMENT.md` for detailed guides
2. Review `PRODUCTION_CHECKLIST.md`
3. See `INFRASTRUCTURE.md` for quick reference
4. Check Railway/Vercel documentation

