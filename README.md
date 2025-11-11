# Personal AI Assistant

A production-ready SaaS task management system powered by Claude AI that helps you stay organized and productive.

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

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (production) or SQLite (development)
- Redis (optional but recommended)
- Anthropic API key

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create `.env` file:
   ```bash
   # REQUIRED
   SECRET_KEY=your-secure-secret-key-here-32-chars-min
   ANTHROPIC_API_KEY=sk-ant-your-company-api-key

   # OPTIONAL (defaults shown)
   DATABASE_URL=sqlite:///./personal_assistant.db
   REDIS_URL=redis://localhost:6379/0
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   REFRESH_TOKEN_EXPIRE_DAYS=30
   ENVIRONMENT=development
   LOG_LEVEL=INFO
   ```

   Generate SECRET_KEY:
   ```bash
   python -c 'import secrets; print(secrets.token_urlsafe(32))'
   ```

5. **Run database migrations:**
   ```bash
   alembic upgrade head
   ```

6. **Start the server:**
   ```bash
   uvicorn main:app --reload
   ```

   API will be available at: http://localhost:8000

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create `.env` file:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

   App will be available at: http://localhost:5173

## API Documentation

Once the backend is running, visit:
- **Interactive API Docs:** http://localhost:8000/docs
- **OpenAPI Schema:** http://localhost:8000/openapi.json

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

✅ **Production-Ready Security:**
- JWT authentication with 1-hour access tokens
- 30-day refresh tokens for seamless re-authentication
- Redis-based token blacklist for immediate revocation
- Bcrypt password hashing
- Strong password requirements (12+ chars, uppercase, lowercase, number, symbol)
- Rate limiting on all endpoints
- CORS protection
- Security headers (HSTS, CSP, X-Frame-Options)
- Input validation with Pydantic
- PostgreSQL encryption at rest (production)

✅ **SaaS Model:**
- Company-provided API access (no user API key management)
- Secure Railway environment variables
- No encryption keys in code or .env files (in production)

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide to Railway.

### Quick Deploy to Railway

1. Create Railway account
2. Add PostgreSQL and Redis databases
3. Set environment variables:
   ```
   SECRET_KEY=<generated-key>
   ANTHROPIC_API_KEY=sk-ant-<your-company-key>
   ENVIRONMENT=production
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```
4. Deploy backend to Railway
5. Deploy frontend to Vercel/Netlify with `VITE_API_BASE_URL=https://your-backend.railway.app/api/v1`

Railway auto-configures `DATABASE_URL` and `REDIS_URL`.

## Development

### Database Migrations

Create new migration:
```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Running Tests

```bash
cd backend
pytest
```

### Code Quality

```bash
# Format code
black .

# Lint
flake8 .
```

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

### Backend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | ✅ | - | JWT signing key (32+ chars) |
| `ANTHROPIC_API_KEY` | ✅ | - | Company's Claude API key |
| `DATABASE_URL` | No | `sqlite:///./personal_assistant.db` | Database connection string |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection string |
| `CORS_ORIGINS` | No | `http://localhost:5173,...` | Allowed frontend origins (comma-separated) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Access token expiration (minutes) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `30` | Refresh token expiration (days) |
| `ENVIRONMENT` | No | `development` | Environment (development\|production) |
| `LOG_LEVEL` | No | `INFO` | Logging level |

### Frontend (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | No | `http://localhost:8000/api/v1` | Backend API URL |

## Troubleshooting

### Common Issues

**Backend won't start:**
- Check Python version (3.11+ required)
- Verify all dependencies installed: `pip install -r requirements.txt`
- Check SECRET_KEY and ANTHROPIC_API_KEY are set in `.env`
- Run migrations: `alembic upgrade head`

**Frontend can't connect to backend:**
- Verify backend is running on http://localhost:8000
- Check `VITE_API_BASE_URL` in frontend `.env`
- Check CORS_ORIGINS includes frontend URL in backend `.env`

**Database errors:**
- For SQLite: Check file permissions
- For PostgreSQL: Verify DATABASE_URL format and database exists
- Run migrations: `alembic upgrade head`

**Redis connection errors:**
- Verify Redis is running: `redis-cli ping` (should return "PONG")
- Check REDIS_URL in `.env`
- Redis is optional - app will work without it (but no token revocation)

**Claude API errors:**
- Verify ANTHROPIC_API_KEY is valid
- Check API key has available credits at https://console.anthropic.com/
- Check rate limits haven't been exceeded

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
