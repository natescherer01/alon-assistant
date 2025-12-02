# Infrastructure Quick Reference

Quick reference guide for deployment infrastructure and common operations.

## Architecture

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │
         ├─────────────────┐
         │                 │
         v                 v
┌────────────────┐  ┌──────────────┐
│  Vercel CDN    │  │   Railway    │
│   (Frontend)   │  │  (Backend)   │
└────────────────┘  └──────┬───────┘
                           │
                           v
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │  (Railway)   │
                    └──────────────┘
```

## Deployment Targets

| Component | Platform | URL Pattern | Port |
|-----------|----------|-------------|------|
| Frontend | Vercel | `https://app.yourdomain.com` | 443 |
| Backend API | Railway | `https://api.yourdomain.com` | 3001 |
| Database | Railway PostgreSQL | Internal | 5432 |

## Key Files Reference

### Backend Configuration
- `backend/Dockerfile` - Production Docker image
- `backend/railway.json` - Railway deployment config
- `backend/nixpacks.toml` - Build configuration
- `backend/.env.example` - Environment variable template
- `backend/src/routes/health.ts` - Health check endpoint

### Frontend Configuration
- `frontend/vercel.json` - Vercel deployment config
- `frontend/.env.example` - Environment variable template

### CI/CD Pipelines
- `.github/workflows/backend-ci.yml` - Backend testing
- `.github/workflows/frontend-ci.yml` - Frontend testing
- `.github/workflows/deploy-staging.yml` - Staging deployment

### Documentation
- `DEPLOYMENT.md` - Full deployment guide
- `backend/RAILWAY_DEPLOYMENT.md` - Railway-specific guide
- `frontend/VERCEL_DEPLOYMENT.md` - Vercel-specific guide
- `PRODUCTION_CHECKLIST.md` - Deployment checklist
- `DEPLOYMENT_SUMMARY.md` - Infrastructure overview

## Common Commands

### Local Development

```bash
# Start database only
docker-compose up postgres -d

# Start database with pgAdmin
docker-compose --profile tools up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f postgres
```

### Backend Operations

```bash
# Install dependencies
cd backend
npm install

# Run migrations
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint
```

### Frontend Operations

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Database Operations

```bash
# Backup database
export DATABASE_URL="postgresql://..."
./backend/scripts/backup-db.sh ./backups

# Restore database
./backend/scripts/restore-db.sh backups/backup_20240101.sql.gz

# Open Prisma Studio
cd backend
npm run prisma:studio

# Reset database (CAUTION: destroys data)
npm run prisma:migrate reset
```

### Railway CLI

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View variables
railway variables

# Set variable
railway variables set KEY=value

# Deploy
railway up

# View logs
railway logs

# SSH into container
railway run

# Open dashboard
railway open
```

### Vercel CLI

```bash
# Install CLI
npm install -g vercel

# Deploy
cd frontend
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls

# View logs
vercel logs <url>

# List environment variables
vercel env ls

# Add environment variable
vercel env add
```

## Environment Variables

### Backend (Required)

```bash
DATABASE_URL=postgresql://...           # Auto-provided by Railway
NODE_ENV=production
PORT=3001
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
JWT_SECRET=<64-char-random>
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=<32-char-random>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common
CORS_ORIGIN=https://app.yourdomain.com
LOG_LEVEL=info
```

### Frontend (Required)

```bash
VITE_API_URL=https://api.yourdomain.com
```

### Generate Secrets

```bash
# JWT_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex').substring(0, 32))"
```

## Health Checks

### Backend Health

```bash
# Main health check
curl https://api.yourdomain.com/api/health

# Readiness probe
curl https://api.yourdomain.com/api/health/ready

# Liveness probe
curl https://api.yourdomain.com/api/health/live
```

### Expected Response

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

## Deployment Steps

### Initial Setup

1. **Backend (Railway)**
   ```bash
   # Create project and add PostgreSQL
   railway init
   railway add postgresql

   # Set environment variables
   railway variables set JWT_SECRET="..."
   railway variables set ENCRYPTION_KEY="..."
   # ... (see backend/.env.example)

   # Deploy
   git push origin main
   ```

2. **Frontend (Vercel)**
   ```bash
   # Deploy
   cd frontend
   vercel --prod

   # Set environment variable
   vercel env add VITE_API_URL production
   ```

3. **Configure OAuth**
   - Google: Add redirect URI in Google Console
   - Microsoft: Add redirect URI in Azure Portal

### Updates

```bash
# Backend update
cd backend
# Make changes
git add .
git commit -m "Update backend"
git push origin main  # Auto-deploys via Railway

# Frontend update
cd frontend
# Make changes
git add .
git commit -m "Update frontend"
git push origin main  # Auto-deploys via Vercel
```

## Rollback Procedures

### Backend Rollback

**Via Railway Dashboard:**
1. Go to Railway project
2. Click Deployments
3. Find previous deployment
4. Click "..." → "Redeploy"

**Via Git:**
```bash
git revert <commit-hash>
git push origin main
```

### Frontend Rollback

**Via Vercel Dashboard:**
1. Go to Vercel project
2. Click Deployments
3. Find previous deployment
4. Click "..." → "Promote to Production"

### Database Rollback

```bash
# Restore from backup
export DATABASE_URL="..."
./backend/scripts/restore-db.sh backups/backup_before_migration.sql.gz
```

## Monitoring

### Health Check Monitoring

Set up external monitoring with:
- UptimeRobot (free)
- Pingdom
- Better Stack

Monitor endpoint: `https://api.yourdomain.com/api/health`

### View Logs

**Railway:**
```bash
railway logs --follow
railway logs --filter "error"
```

**Vercel:**
```bash
vercel logs <deployment-url>
```

### Performance Metrics

Available at health check endpoint:
- Response times
- Memory usage
- Error rates
- Database connection status

## Security Checklist

- [ ] JWT_SECRET is 64+ characters
- [ ] ENCRYPTION_KEY is exactly 32 characters
- [ ] OAuth redirect URIs are exact matches
- [ ] CORS_ORIGIN is specific (not wildcard)
- [ ] HTTPS enforced everywhere
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Database uses SSL
- [ ] Secrets not in git
- [ ] Non-root Docker user

## Troubleshooting

### Backend Issues

```bash
# Check logs
railway logs --filter "error"

# Check health
curl https://api.yourdomain.com/api/health

# Verify environment variables
railway variables

# SSH into container
railway run
```

### Frontend Issues

```bash
# Check build logs
vercel logs <url>

# Verify environment variables
vercel env ls

# Test API connection
curl https://api.yourdomain.com/api/health
```

### Database Issues

```bash
# Check connection
railway run npx prisma db push

# View migrations
railway run npx prisma migrate status

# Open Prisma Studio
railway run npx prisma studio
```

## Support Resources

- **Railway**: https://railway.app/help
- **Vercel**: https://vercel.com/support
- **Prisma**: https://www.prisma.io/docs
- **Docker**: https://docs.docker.com
- **PostgreSQL**: https://www.postgresql.org/docs

## Cost Breakdown

### Railway (Hobby - $5/mo)
- $5 credit + usage
- PostgreSQL included
- 100GB bandwidth

### Vercel (Free Tier)
- 100GB bandwidth/month
- Automatic HTTPS
- Global CDN

**Estimated Total: $5-10/month**

## Useful Links

- Railway Dashboard: https://railway.app/dashboard
- Vercel Dashboard: https://vercel.com/dashboard
- Google Cloud Console: https://console.cloud.google.com
- Azure Portal: https://portal.azure.com

## Quick Deploy Checklist

- [ ] Set all backend environment variables
- [ ] Set frontend environment variable (VITE_API_URL)
- [ ] Configure Google OAuth redirect URI
- [ ] Configure Microsoft OAuth redirect URI
- [ ] Push code to GitHub (triggers deployment)
- [ ] Verify health check returns 200
- [ ] Test OAuth flows
- [ ] Set up monitoring
- [ ] Configure custom domains (optional)
- [ ] Enable database backups

## File Locations

```
Project Root: /Users/natescherer/alon-cal/

Key Files:
  Backend:
    - /Users/natescherer/alon-cal/backend/Dockerfile
    - /Users/natescherer/alon-cal/backend/railway.json
    - /Users/natescherer/alon-cal/backend/.env.example

  Frontend:
    - /Users/natescherer/alon-cal/frontend/vercel.json
    - /Users/natescherer/alon-cal/frontend/.env.example

  Documentation:
    - /Users/natescherer/alon-cal/DEPLOYMENT.md
    - /Users/natescherer/alon-cal/PRODUCTION_CHECKLIST.md
    - /Users/natescherer/alon-cal/DEPLOYMENT_SUMMARY.md
```

---

For detailed guides, see:
- Full deployment: `DEPLOYMENT.md`
- Railway: `backend/RAILWAY_DEPLOYMENT.md`
- Vercel: `frontend/VERCEL_DEPLOYMENT.md`
- Checklist: `PRODUCTION_CHECKLIST.md`
