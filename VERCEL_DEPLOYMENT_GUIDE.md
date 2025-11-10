# Vercel Deployment Guide - Personal AI Assistant

## 🎯 Overview

This guide will help you deploy your Personal AI Assistant to production with:
- **Frontend** (React) → Vercel
- **Backend** (FastAPI) → Railway (recommended) or Render
- **Database** → PostgreSQL (included with Railway/Render)

**Note**: Vercel is excellent for frontend but **cannot host Python FastAPI backends**. You'll deploy:
1. Frontend to Vercel (this guide)
2. Backend to Railway/Render (separate service)

---

## 📋 Prerequisites

Before starting, have ready:
- ✅ Vercel account (free tier works)
- ✅ Railway account (free tier) OR Render account
- ✅ Anthropic API key (from console.anthropic.com)
- ✅ Git repository (GitHub/GitLab)
- ✅ This project pushed to your repo

---

## 🚀 Part 1: Deploy Backend to Railway (Recommended)

### Why Railway?
- Free tier includes PostgreSQL database
- Easy FastAPI deployment
- Simple environment variable management
- Automatic HTTPS

### Step 1.1: Prepare Backend for Railway

**Create `railway.json` in backend directory:**

```bash
cd backend
```

Create file: `backend/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Create `Procfile` in backend directory:**

Create file: `backend/Procfile`
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Step 1.2: Update Backend Configuration for Production

**Update `backend/config.py` to handle production CORS:**

Find the `cors_origins` section and update it:

```python
# CORS - Update to handle production
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
cors_origins: list = [origin.strip() for origin in cors_origins_str.split(",")]
```

This allows you to set CORS_ORIGINS as an environment variable in Railway.

### Step 1.3: Deploy to Railway

1. **Go to Railway.app** and sign up/login
2. **Click "New Project"**
3. **Select "Deploy from GitHub repo"**
4. **Authorize Railway** to access your GitHub
5. **Select your repository**
6. **Configure the deployment**:
   - Root Directory: `backend`
   - OR if Railway auto-detects: leave as-is

7. **Add PostgreSQL Database**:
   - In your Railway project dashboard
   - Click "+ New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically create `DATABASE_URL` variable

8. **Set Environment Variables** in Railway dashboard:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-your-actual-key-here
SECRET_KEY=your-generated-secret-key-here  # Generate: openssl rand -hex 32

# Production settings
ENVIRONMENT=production
DATABASE_URL=${{Postgres.DATABASE_URL}}  # Railway auto-fills this

# CORS - Add your Vercel domain
CORS_ORIGINS=https://your-app-name.vercel.app,https://your-custom-domain.com
```

9. **Deploy**: Railway will automatically deploy
10. **Get your backend URL**: e.g., `https://your-app.railway.app`

### Step 1.4: Test Backend

Visit: `https://your-app.railway.app/health`

Should return:
```json
{
  "status": "healthy",
  "environment": "production"
}
```

---

## 🎨 Part 2: Deploy Frontend to Vercel

### Step 2.1: Prepare Frontend

**Create `frontend/.env.production`:**

```bash
cd frontend
```

Create file: `frontend/.env.production`
```env
VITE_API_BASE_URL=https://your-backend-url.railway.app/api/v1
```

**Replace** `your-backend-url.railway.app` with your actual Railway URL.

**Update `frontend/vite.config.js` for production:**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
})
```

### Step 2.2: Create Vercel Configuration

**Create `vercel.json` in frontend directory:**

Create file: `frontend/vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

This ensures React Router works properly on Vercel.

### Step 2.3: Deploy to Vercel

**Option A: Deploy via Vercel CLI**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from frontend directory
cd frontend
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: your-project-name
# - Which directory? ./
# - Auto-detected Vite, continue? Yes
# - Override build command? No
# - Override output directory? No
```

**Option B: Deploy via Vercel Dashboard (Recommended)**

1. **Go to vercel.com** and sign up/login
2. **Click "Add New Project"**
3. **Import your Git repository**
4. **Configure the project**:
   - Framework Preset: **Vite**
   - Root Directory: **frontend**
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)

5. **Add Environment Variables**:
   - Key: `VITE_API_BASE_URL`
   - Value: `https://your-backend-url.railway.app/api/v1`

6. **Click "Deploy"**

### Step 2.4: Update Backend CORS

**CRITICAL**: After deploying frontend, update Railway environment variables:

In Railway dashboard, update:
```bash
CORS_ORIGINS=https://your-app-name.vercel.app,https://www.your-custom-domain.com
```

**Trigger Railway redeploy** for CORS changes to take effect.

### Step 2.5: Test Production App

1. **Visit your Vercel URL**: `https://your-app-name.vercel.app`
2. **Sign up** for a new account
3. **Test features**:
   - Create tasks
   - Update tasks
   - Use Claude chat (if ANTHROPIC_API_KEY is set)
   - Test authentication

---

## 🔧 Part 3: Configuration Checklist

### Backend (Railway) Configuration

```bash
# Environment Variables (Railway Dashboard)
✅ ANTHROPIC_API_KEY=sk-ant-...
✅ SECRET_KEY=<generated-with-openssl-rand>
✅ ENVIRONMENT=production
✅ DATABASE_URL=${{Postgres.DATABASE_URL}}
✅ CORS_ORIGINS=https://your-app.vercel.app
✅ ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

### Frontend (Vercel) Configuration

```bash
# Environment Variables (Vercel Dashboard)
✅ VITE_API_BASE_URL=https://your-backend.railway.app/api/v1
```

### Files to Create/Update

**Backend:**
- ✅ `backend/railway.json` (new)
- ✅ `backend/Procfile` (new)
- ✅ `backend/config.py` (update CORS handling)

**Frontend:**
- ✅ `frontend/.env.production` (new)
- ✅ `frontend/vercel.json` (new)
- ✅ `frontend/vite.config.js` (update if needed)

---

## 🛠️ Alternative: Deploy Backend to Render

If you prefer Render over Railway:

### Render Setup

1. **Go to render.com** and sign up
2. **Create New Web Service**
3. **Connect GitHub repository**
4. **Configure**:
   - Name: your-backend-name
   - Region: Choose closest to you
   - Branch: main
   - Root Directory: `backend`
   - Runtime: **Python 3**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

5. **Add PostgreSQL Database**:
   - In Render dashboard
   - Create new PostgreSQL database
   - Copy internal database URL

6. **Environment Variables**:
```bash
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=<your-secret-key>
ENVIRONMENT=production
DATABASE_URL=<render-postgres-url>
CORS_ORIGINS=https://your-app.vercel.app
```

7. **Deploy** and get your URL: `https://your-backend.onrender.com`

Then follow frontend deployment steps with Render URL.

---

## 📊 Monitoring & Maintenance

### Check Backend Health

```bash
curl https://your-backend.railway.app/health
```

Should return:
```json
{
  "status": "healthy",
  "environment": "production"
}
```

### Check API Documentation

Visit: `https://your-backend.railway.app/docs`

### Monitor Logs

**Railway**: Dashboard → Your Service → Deployments → View Logs
**Vercel**: Dashboard → Your Project → Deployments → Function Logs

### Database Access

**Railway**:
- Dashboard → PostgreSQL → Connect
- Use provided connection string with tools like pgAdmin or psql

**Render**:
- Dashboard → Database → Info
- External connection URL available

---

## 🔐 Security Checklist

Before going live:

### Backend Security
- ✅ Strong SECRET_KEY (32+ character random string)
- ✅ ANTHROPIC_API_KEY not committed to git
- ✅ CORS only allows your frontend domain
- ✅ ENVIRONMENT=production
- ✅ Debug mode disabled in production
- ✅ HTTPS enforced (automatic with Railway/Render)

### Frontend Security
- ✅ No API keys in frontend code
- ✅ Using environment variables only
- ✅ HTTPS enabled (automatic with Vercel)
- ✅ Security headers configured (in vercel.json)

### Database Security
- ✅ Using PostgreSQL (not SQLite) in production
- ✅ Connection URL in environment variable only
- ✅ Regular backups enabled (Railway/Render provide this)

---

## 🚨 Troubleshooting

### Frontend can't connect to backend

**Problem**: CORS errors in browser console

**Solutions**:
1. Check CORS_ORIGINS in Railway includes your Vercel URL
2. Ensure no trailing slash in URLs
3. Redeploy Railway after CORS changes
4. Check browser console for exact error

**Verify CORS**:
```bash
curl -H "Origin: https://your-app.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -I https://your-backend.railway.app/health
```

Should include: `Access-Control-Allow-Origin: https://your-app.vercel.app`

### Backend not starting

**Problem**: Railway/Render deployment fails

**Check**:
1. Build logs for errors
2. Ensure requirements.txt has all dependencies
3. Check start command is correct
4. Verify Python version compatibility

### Database connection errors

**Problem**: Can't connect to PostgreSQL

**Solutions**:
1. Check DATABASE_URL is set in Railway/Render
2. Verify format: `postgresql://user:pass@host:port/dbname`
3. Check database is running (Railway/Render dashboard)
4. Look for migration errors in logs

### Authentication not working

**Problem**: Can't login/signup

**Check**:
1. SECRET_KEY is set and consistent
2. Frontend VITE_API_BASE_URL points to correct backend
3. Check Network tab in browser DevTools
4. Verify /api/v1/auth/login endpoint responds

### Claude chat not working

**Problem**: Chat sends messages but no response

**Check**:
1. ANTHROPIC_API_KEY is set correctly in Railway
2. Check API key is valid at console.anthropic.com
3. Look at Railway logs for API errors
4. Verify API key has sufficient credits

---

## 💰 Cost Breakdown

### Free Tier Limits

**Vercel (Frontend)**:
- Bandwidth: 100 GB/month
- Build time: 6000 minutes/month
- Deployments: Unlimited
- **Cost**: Free

**Railway (Backend + DB)**:
- $5 free trial credit
- After trial: ~$5-20/month depending on usage
- PostgreSQL included

**Render (Alternative)**:
- Free tier: 750 hours/month
- PostgreSQL: $7/month
- **Cost**: Free for backend, $7/month for DB

**Anthropic Claude API**:
- Pay per use
- ~$0.003 per API call
- ~$15/month for moderate usage (5000 calls)

**Total Estimated Cost**: $5-25/month

---

## 🎉 Post-Deployment Steps

### 1. Test All Features

Create a test checklist:
```
✅ Sign up new user
✅ Login with credentials
✅ Create task
✅ Update task status
✅ Complete task
✅ Delete task
✅ Use Claude chat
✅ Filter tasks
✅ Test on mobile
```

### 2. Set Up Custom Domain (Optional)

**Vercel**:
1. Dashboard → Project → Settings → Domains
2. Add your custom domain
3. Configure DNS records (Vercel provides instructions)

**Railway**:
1. Dashboard → Project → Settings → Domains
2. Add custom domain
3. Configure CNAME record

**Update CORS**: Add custom domain to CORS_ORIGINS

### 3. Enable Monitoring

**Sentry** (Error Tracking):
```bash
npm install @sentry/react
```

**LogRocket** (Session Replay):
```bash
npm install logrocket
```

**Plausible** (Privacy-friendly Analytics):
Add script to index.html

### 4. Set Up Backups

**Railway/Render**:
- Enable automatic database backups
- Download manual backup weekly

**Code**:
- Keep GitHub repository up to date
- Tag releases: `git tag v1.0.0`

### 5. Documentation

Create or update:
- ✅ README with production URLs
- ✅ User guide
- ✅ API documentation
- ✅ Troubleshooting guide

---

## 🔄 Continuous Deployment

### Auto-Deploy on Git Push

**Vercel**: Automatic (already configured)
- Push to `main` branch → auto-deploys

**Railway**: Automatic (already configured)
- Push to `main` branch → auto-deploys

**Render**: Automatic (configure in dashboard)
- Auto-deploy on push: Enable in settings

### Preview Deployments

**Vercel**: Automatic preview for pull requests
**Railway**: Configure preview environments
**Render**: Available on paid plans

---

## 📚 Additional Resources

### Documentation
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Render Docs](https://render.com/docs)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)

### Community
- [Vercel Discord](https://vercel.com/discord)
- [Railway Discord](https://discord.gg/railway)
- [FastAPI Discord](https://discord.gg/fastapi)

### Support
- Vercel: support@vercel.com
- Railway: support@railway.app
- Render: support@render.com

---

## ✅ Final Checklist

Before announcing your app is live:

### Technical
- ✅ Backend deployed and healthy
- ✅ Frontend deployed and accessible
- ✅ Database connected and migrations run
- ✅ CORS configured correctly
- ✅ All environment variables set
- ✅ HTTPS working on both frontend and backend
- ✅ API documentation accessible

### Features
- ✅ User signup working
- ✅ Login working
- ✅ Task CRUD working
- ✅ Claude chat working (if enabled)
- ✅ Mobile responsive
- ✅ Error handling working

### Security
- ✅ No secrets in code
- ✅ Strong SECRET_KEY
- ✅ CORS properly restricted
- ✅ Rate limiting enabled
- ✅ Input validation working

### Monitoring
- ✅ Error tracking configured
- ✅ Logging configured
- ✅ Uptime monitoring (optional)
- ✅ Backup strategy in place

---

## 🎊 You're Live!

Your Personal AI Assistant is now running in production!

**Share your app**:
- Frontend URL: `https://your-app.vercel.app`
- Custom domain: `https://your-domain.com`

**Monitor**:
- Backend: Railway/Render dashboard
- Frontend: Vercel dashboard
- Errors: Check application logs

**Maintain**:
- Update dependencies monthly
- Monitor API usage costs
- Review security logs
- Backup database weekly

---

**Need help?** Check the logs first:
- **Backend logs**: Railway/Render dashboard
- **Frontend logs**: Vercel dashboard → Functions
- **Browser console**: F12 → Console tab

**Happy deploying!** 🚀
