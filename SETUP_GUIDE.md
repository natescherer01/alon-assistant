# Personal AI Assistant - Setup Guide

Complete guide to set up and deploy your multi-user Personal AI Assistant with React frontend and FastAPI backend.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│   React Frontend (Vite)                 │
│   - User authentication                 │
│   - Task management UI                  │
│   - Claude chat interface               │
└───────────────┬─────────────────────────┘
                │ REST API
                ▼
┌─────────────────────────────────────────┐
│   FastAPI Backend                       │
│   - JWT authentication                  │
│   - Task CRUD operations                │
│   - Claude API integration              │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│   SQLite/PostgreSQL Database            │
│   - users, tasks, chat_history          │
└─────────────────────────────────────────┘
```

## Prerequisites

- Python 3.9+
- Node.js 18+
- npm or yarn
- Anthropic API key ([Get one here](https://console.anthropic.com/))

## Quick Start (Development)

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env and add your API key
nano .env  # or use your preferred editor
# Set: ANTHROPIC_API_KEY=your-key-here
# Set: SECRET_KEY=your-secret-key-here (generate with: openssl rand -hex 32)

# Run the server
python main.py
```

Backend will be available at: http://localhost:8000
API docs: http://localhost:8000/docs

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run development server
npm run dev
```

Frontend will be available at: http://localhost:5173

### 3. Create Your Account

1. Open http://localhost:5173 in your browser
2. Click "Sign up"
3. Create an account with your email and password
4. You'll be automatically logged in!

## Environment Variables

### Backend (.env)

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...           # Your Claude API key
SECRET_KEY=your-secret-key             # Generate with: openssl rand -hex 32

# Optional
DATABASE_URL=sqlite:///./personal_assistant.db  # Or PostgreSQL URL
ENVIRONMENT=development
ACCESS_TOKEN_EXPIRE_MINUTES=10080      # 7 days
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Database Setup

### SQLite (Default - Development)

No setup needed! Database file is created automatically.

### PostgreSQL (Production)

```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql

# Create database
createdb personal_assistant

# Update .env
DATABASE_URL=postgresql://user:password@localhost/personal_assistant

# Install psycopg2
pip install psycopg2-binary
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Create account
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Tasks
- `GET /api/v1/tasks` - List tasks (filter: all, waiting, upcoming)
- `POST /api/v1/tasks` - Create task
- `GET /api/v1/tasks/next` - Get next priority task
- `GET /api/v1/tasks/{id}` - Get task by ID
- `PATCH /api/v1/tasks/{id}` - Update task
- `POST /api/v1/tasks/{id}/complete` - Complete task
- `DELETE /api/v1/tasks/{id}` - Delete task

### Chat
- `POST /api/v1/chat` - Send message to Claude
- `GET /api/v1/chat/history` - Get chat history
- `DELETE /api/v1/chat/history` - Clear history

## Features

### Backend Features
- ✅ JWT authentication with secure password hashing
- ✅ Multi-user task management
- ✅ Intelligent task prioritization
- ✅ Auto-detect task intensity and waiting status
- ✅ Claude AI integration for conversational interface
- ✅ RESTful API with automatic documentation
- ✅ Database migrations support

### Frontend Features
- ✅ Modern React UI with Vite
- ✅ User authentication (login/signup)
- ✅ Task dashboard with filters
- ✅ Real-time priority task display
- ✅ Claude chat interface
- ✅ Task CRUD operations
- ✅ Responsive design

## Deployment

### Backend Deployment (Railway/Heroku/DigitalOcean)

1. **Set environment variables:**
   ```env
   ANTHROPIC_API_KEY=your-key
   SECRET_KEY=your-secret
   DATABASE_URL=postgresql://...
   ENVIRONMENT=production
   ```

2. **Install production dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install gunicorn
   ```

3. **Run with Gunicorn:**
   ```bash
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

4. **Create Procfile (for Heroku):**
   ```
   web: gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
   ```

### Frontend Deployment (Vercel/Netlify)

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Set environment variables:**
   ```env
   VITE_API_BASE_URL=https://your-backend-domain.com/api/v1
   ```

3. **Deploy:**
   - Vercel: `vercel deploy`
   - Netlify: `netlify deploy --prod`

### Docker Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/personal_assistant
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_BASE_URL=http://localhost:8000/api/v1

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=personal_assistant
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Run: `docker-compose up`

## Development Tips

### Backend Development

```bash
# Run with auto-reload
uvicorn main:app --reload

# Create database migration
alembic revision --autogenerate -m "description"
alembic upgrade head

# Run tests
pytest

# Check API docs
open http://localhost:8000/docs
```

### Frontend Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Format code
npm run format
```

## Troubleshooting

### Backend Issues

**Database connection errors:**
- Check DATABASE_URL format
- Ensure PostgreSQL is running
- Verify database exists

**Claude API errors:**
- Verify ANTHROPIC_API_KEY is correct
- Check API key has credits
- Review rate limits

### Frontend Issues

**API connection errors:**
- Check VITE_API_BASE_URL points to correct backend
- Verify backend is running
- Check CORS configuration in backend

**Authentication issues:**
- Clear localStorage: `localStorage.clear()`
- Check JWT token expiration
- Verify SECRET_KEY is consistent

## Security Notes

1. **Always use HTTPS in production**
2. **Keep SECRET_KEY and API keys secure**
3. **Use environment variables, never commit secrets**
4. **Enable CORS only for trusted domains**
5. **Use strong passwords (8+ characters)**
6. **Regular database backups**

## Support & Documentation

- FastAPI Docs: http://localhost:8000/docs
- React Router: https://reactrouter.com
- Anthropic API: https://docs.anthropic.com
- SQLAlchemy: https://docs.sqlalchemy.org

## License

MIT License - Feel free to use this for your own projects!

---

Built with FastAPI, React, Claude AI, and ❤️
