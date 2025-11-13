# Personal AI Assistant

A production-ready SaaS task management system powered by Claude AI that helps you stay organized and productive.

## ⚠️ Important: Production-First Development

**This project uses a production-first testing approach.** We DO NOT use localhost for testing production features. All development and testing happens directly in the Railway production environment.

**Read this first:** [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md)

## Overview

This is a full-stack web application where users sign up, manage their tasks, and interact with Claude AI for intelligent task assistance. **The company provides the Claude API access** - users simply create an account and start using the service.

### Key Features

- **AI-Powered Task Management** - Claude AI helps prioritize, organize, and track your tasks
- **Smart Task Prioritization** - Automatically prioritizes based on deadlines, intensity, and dependencies
- **Interactive Chat Interface** - Natural conversation with Claude about your tasks
- **Secure Authentication** - JWT-based auth with refresh tokens and token revocation
- **Production-Ready** - Built for Railway deployment with PostgreSQL and Redis

## Architecture

### SaaS Model

```
┌─────────────────┐
│   Users         │
│   (Sign up)     │
│   (Pay for      │
│    service)     │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────────┐
│   Your Company Infrastructure│
│                             │
│  ┌──────────┐  ┌─────────┐ │
│  │ Backend  │  │Frontend │ │
│  │(FastAPI) │  │(React)  │ │
│  └────┬─────┘  └─────────┘ │
│       │                    │
│  ┌────┴──────┐  ┌────────┐│
│  │PostgreSQL │  │ Redis  ││
│  └───────────┘  └────────┘│
│                            │
│  Company's Anthropic API Key│
│  (You pay for Claude)      │
└─────────────────────────────┘
```

### Tech Stack

**Backend:**
- FastAPI (Python 3.11+)
- PostgreSQL (production) / SQLite (development)
- Redis (token blacklist & caching)
- Anthropic Claude API
- SQLAlchemy ORM
- JWT authentication

**Frontend:**
- React + Vite
- TailwindCSS
- Zustand (state management)
- React Query
- Axios

## Getting Started

### ⚠️ Production-First Development

**We DO NOT use localhost for testing production features.**

This project is designed to be developed and tested directly in the Railway production environment. Security features, CORS, HTTPS headers, and authentication work differently on localhost, so testing locally gives false confidence.

**Development Workflow:**
1. Make code changes locally
2. Commit and push to GitHub (never commit credentials!)
3. Railway auto-deploys (1-2 minutes)
4. Test in production: https://sam.alontechnologies.com
5. Check Railway logs for errors
6. Iterate

**See:** [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) for complete workflow

### Quick Deploy (Recommended Approach)

**Skip local setup. Deploy directly to Railway:**

1. **Fork/clone this repository**
   ```bash
   git clone <your-repo>
   cd personal\ AI
   ```

2. **Deploy to Railway**
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide
   - Railway provisions PostgreSQL and Redis automatically
   - Set environment variables in Railway dashboard (NEVER in code)

3. **Test in production**
   ```bash
   curl https://alon-assistant.up.railway.app/health
   ```

4. **Deploy frontend to Vercel**
   - Point `VITE_API_BASE_URL` to Railway backend
   - See [DEPLOYMENT.md](DEPLOYMENT.md)

**Production environment:**
- Backend: https://alon-assistant.up.railway.app
- Frontend: https://sam.alontechnologies.com
- Database: Railway PostgreSQL (managed)
- Cache: Railway Redis (managed)

## API Documentation

**Production API Docs:**
- **Interactive API Docs:** https://alon-assistant.up.railway.app/docs
- **OpenAPI Schema:** https://alon-assistant.up.railway.app/openapi.json

### Key Endpoints

**Authentication:**
- `POST /api/v1/auth/signup` - Create account (returns tokens)
- `POST /api/v1/auth/login` - Login (returns access + refresh tokens)
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Revoke access token
- `GET /api/v1/auth/me` - Get current user info

**Tasks:**
- `GET /api/v1/tasks` - List user's tasks
- `POST /api/v1/tasks` - Create new task
- `GET /api/v1/tasks/next` - Get next priority task
- `PATCH /api/v1/tasks/{id}` - Update task
- `POST /api/v1/tasks/{id}/complete` - Mark task complete
- `DELETE /api/v1/tasks/{id}` - Delete task

**Chat:**
- `POST /api/v1/chat` - Send message to Claude AI
- `GET /api/v1/chat/history` - Get chat history
- `DELETE /api/v1/chat/history` - Clear chat history

## Security Features

✅ **Production-Ready Security (OWASP & NIST Compliant):**
- **Authentication:** JWT with 30-min access tokens, 7-day refresh tokens
- **Password Security:** NIST SP 800-63B validation, Have I Been Pwned breach checking
- **Account Protection:** Lockout after 5 failed attempts (30-min automatic unlock)
- **Token Management:** Redis-based blacklist for immediate revocation
- **Password Hashing:** Bcrypt (12 rounds)
- **Rate Limiting:** 100 requests/minute per IP
- **CORS:** Restricted to production domain only
- **Security Headers:** HSTS (1 year), CSP, X-Frame-Options, X-Content-Type-Options
- **Input Validation:** Pydantic schemas with strict validation
- **Database Security:** PostgreSQL encryption at rest (Railway), parameterized queries
- **Logging:** JSON-formatted security events (failed logins, lockouts, suspicious activity)
- **Request Limits:** 10MB max request size

✅ **Zero Trust Architecture:**
- **NO credentials in code** - Railway dashboard environment variables ONLY
- **NO localhost testing** - Production-first development and testing
- **NO .env files in git** - Gitignored and never committed
- **NO wildcards in CORS** - Explicit domain whitelist only
- **NO weak passwords** - 12+ chars with complexity requirements

**Read:** [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) for complete security documentation

## Deployment

**Production Environment:**
- Backend: Railway (https://alon-assistant.up.railway.app)
- Frontend: Vercel (https://sam.alontechnologies.com)
- Database: Railway PostgreSQL (managed)
- Cache: Railway Redis (managed)

**Complete guides:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment instructions
- [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md) - Security workflow
- [DATABASE_ROTATION_GUIDE.md](DATABASE_ROTATION_GUIDE.md) - Credential rotation

### Critical: Environment Variables

**NEVER commit credentials to git. Use Railway dashboard ONLY.**

Required in Railway:
```bash
SECRET_KEY=<generate-with-secrets.token_urlsafe(32)>
ANTHROPIC_API_KEY=sk-ant-...
ENVIRONMENT=production
CORS_ORIGINS=https://sam.alontechnologies.com

# Auto-configured by Railway (don't set manually):
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

**See:** [RAILWAY_ENVIRONMENT_SETUP.md](RAILWAY_ENVIRONMENT_SETUP.md)

## Development Workflow

### Production-First Development

```bash
# 1. Make changes locally
git checkout -b feature/my-feature
# Edit code...

# 2. Commit (verify no secrets!)
git log -p | grep -i "password\|secret\|api"  # Should show nothing
git add .
git commit -m "Add feature: description"

# 3. Push to GitHub
git push origin feature/my-feature

# 4. Railway auto-deploys from main
# Wait 1-2 minutes

# 5. Test in production
curl https://alon-assistant.up.railway.app/health
# Visit https://sam.alontechnologies.com

# 6. Check Railway logs
# Railway Dashboard → Backend Service → Logs

# 7. Merge when verified
git checkout main
git merge feature/my-feature
git push origin main
```

### Database Migrations

```bash
# 1. Create migration locally
cd backend
alembic revision --autogenerate -m "description"

# 2. Commit migration file
git add alembic/versions/*.py
git commit -m "Add migration: description"

# 3. Push to GitHub
git push origin main

# 4. Railway auto-runs migration on deployment
# Check logs: "Running alembic upgrade head"
```

### Testing

**Test in production environment (Railway):**
- Deploy to Railway
- Test at https://sam.alontechnologies.com
- Check Railway logs for errors
- Verify security features work (CORS, auth, rate limiting)

**Why not localhost?** Security features work differently locally.

## Project Structure

```
personal AI/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── auth/                 # Authentication module
│   │   ├── dependencies.py   # Auth dependencies
│   │   ├── router.py         # Auth endpoints
│   │   ├── token_blacklist.py # Redis token revocation
│   │   └── utils.py          # JWT utils
│   ├── chat/                 # Claude AI chat module
│   │   ├── router.py         # Chat endpoints
│   │   └── service.py        # Claude API integration
│   ├── tasks/                # Task management module
│   │   ├── router.py         # Task endpoints
│   │   └── service.py        # Task business logic
│   ├── config.py             # Application settings
│   ├── database.py           # Database connection
│   ├── logger.py             # Logging configuration
│   ├── main.py               # FastAPI app entry point
│   ├── models.py             # SQLAlchemy models
│   ├── rate_limit.py         # Rate limiting setup
│   ├── schemas.py            # Pydantic schemas
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Environment template
├── frontend/
│   ├── src/
│   │   ├── api/              # API client
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── utils/            # Utilities (authStore, etc.)
│   │   ├── App.jsx           # Main app component
│   │   └── main.jsx          # React entry point
│   ├── package.json          # Node dependencies
│   └── vite.config.js        # Vite configuration
├── DESIGN_PROTOCOL.md        # Design system & patterns
├── DEPLOYMENT.md             # Deployment guide
└── README.md                 # This file
```

## Environment Variables Reference

### ⚠️ Critical: NEVER Commit Credentials to Git

**Store ALL credentials in Railway/Vercel dashboards ONLY.**

### Backend (Railway Dashboard → Variables)

| Variable | Required | Production Value | Description |
|----------|----------|------------------|-------------|
| `SECRET_KEY` | ✅ | Generate new: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` | JWT signing key (32+ chars) |
| `ANTHROPIC_API_KEY` | ✅ | `sk-ant-...` | Company's Claude API key |
| `ENVIRONMENT` | ✅ | `production` | **Must be "production"** |
| `CORS_ORIGINS` | ✅ | `https://sam.alontechnologies.com` | Frontend domain (exact match, no wildcards) |
| `DATABASE_URL` | Auto | Auto-configured by Railway | PostgreSQL connection (Railway provides) |
| `REDIS_URL` | Auto | Auto-configured by Railway | Redis connection (Railway provides) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Access token expiration (minutes) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token expiration (days) |
| `LOG_LEVEL` | No | `INFO` | Logging level |

### Frontend (Vercel Dashboard → Environment Variables)

| Variable | Required | Production Value | Description |
|----------|----------|------------------|-------------|
| `VITE_API_BASE_URL` | ✅ | `https://alon-assistant.up.railway.app/api/v1` | Backend API URL |

**See:** [RAILWAY_ENVIRONMENT_SETUP.md](RAILWAY_ENVIRONMENT_SETUP.md) for detailed setup

## Troubleshooting

### Production Issues

**Deployment failed:**
- Check Railway logs: Railway Dashboard → Backend Service → Logs
- Verify all required environment variables set
- Check for syntax errors in code
- Verify migrations ran successfully

**Frontend can't connect to backend:**
- Check `VITE_API_BASE_URL` in Vercel environment variables
- Verify it points to `https://alon-assistant.up.railway.app/api/v1`
- Check backend is running: `curl https://alon-assistant.up.railway.app/health`
- Check CORS_ORIGINS in Railway includes frontend domain

**CORS errors:**
- Verify CORS_ORIGINS in Railway exactly matches frontend domain
- Must include `https://` protocol
- No wildcards (*)
- No spaces in comma-separated list

**Database connection errors:**
- Check Railway PostgreSQL service is running
- Verify DATABASE_URL auto-configured by Railway
- Check connection pool settings
- Review Railway logs for detailed error

**Authentication errors:**
- Verify SECRET_KEY is set in Railway
- Check token expiration settings
- Verify Redis is running (for token blacklist)
- Check Railway logs for auth errors

**Claude API errors:**
- Verify ANTHROPIC_API_KEY is set in Railway
- Check API key is valid at https://console.anthropic.com/
- Check available credits
- Review rate limits

**Security headers missing:**
- Verify `ENVIRONMENT=production` in Railway
- Check SecurityHeadersMiddleware is applied
- Test with: `curl -I https://alon-assistant.up.railway.app/health`

### Getting Help

1. **Check Railway logs first:** Railway Dashboard → Service → Logs
2. **Review documentation:**
   - [SECURITY_AND_BEST_PRACTICES.md](SECURITY_AND_BEST_PRACTICES.md)
   - [DEPLOYMENT.md](DEPLOYMENT.md)
   - [RAILWAY_ENVIRONMENT_SETUP.md](RAILWAY_ENVIRONMENT_SETUP.md)
3. **Check API docs:** https://alon-assistant.up.railway.app/docs

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is proprietary and confidential.

## Support

For issues or questions:
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment issues
- Review API docs at `/docs` endpoint
- Check Railway logs for production issues

---

**Built with FastAPI, React, and Claude AI**
