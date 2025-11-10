# Personal AI Assistant - Quick Start

## What We Built

You now have a **full-stack, multi-user web application** for task management with Claude AI integration!

### Architecture

```
React Frontend (Browser)
    ↓ REST API calls
FastAPI Backend
    ↓ Uses
Claude API + SQLite Database
```

### Key Features

✅ **Multi-user authentication** - Secure login/signup with JWT
✅ **Task management** - Create, update, complete, delete tasks
✅ **Smart prioritization** - Auto-ranks tasks by deadline & intensity
✅ **Claude AI chat** - Conversational task management
✅ **Beautiful UI** - Modern, responsive React interface
✅ **RESTful API** - Fully documented at `/docs`

## Getting Started

### Option 1: Using the Startup Script (Recommended)

```bash
# Make sure you have Python 3.9+ and Node.js 18+ installed
./start-dev.sh
```

This will:
1. Check for .env files
2. Install all dependencies
3. Start backend on port 8000
4. Start frontend on port 5173

### Option 2: Manual Setup

**Terminal 1 - Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and edit .env file
cp .env.example .env
nano .env  # Add your ANTHROPIC_API_KEY

python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## First Steps

1. **Open http://localhost:5173** in your browser

2. **Create an account:**
   - Click "Sign up"
   - Enter email and password
   - You'll be automatically logged in

3. **Try the chat interface:**
   - Click "💬 Show Chat"
   - Try: "What's next?"
   - Try: "Add task: Write documentation, due tomorrow"

4. **Use the task dashboard:**
   - Click "📋 Show Tasks"
   - Add tasks with the form
   - See your next priority task
   - Complete or update tasks

## Environment Setup

### Backend .env

You MUST set these:

```env
ANTHROPIC_API_KEY=sk-ant-...     # Get from https://console.anthropic.com/
SECRET_KEY=your-secret-key-here  # Generate: openssl rand -hex 32
```

Optional (defaults provided):

```env
DATABASE_URL=sqlite:///./personal_assistant.db
ENVIRONMENT=development
```

### Frontend .env

Default works for local development:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Testing the API

Visit http://localhost:8000/docs for interactive API documentation.

Try these endpoints:

1. **Create Account:** POST /api/v1/auth/signup
2. **Login:** POST /api/v1/auth/login (get JWT token)
3. **Create Task:** POST /api/v1/tasks (add Bearer token)
4. **Chat:** POST /api/v1/chat (add Bearer token)

## File Structure

```
personal AI/
├── backend/               # FastAPI server
│   ├── main.py           # Entry point
│   ├── auth/             # Authentication
│   ├── tasks/            # Task management
│   └── chat/             # Claude integration
├── frontend/             # React app
│   └── src/
│       ├── pages/        # Login, Signup, Dashboard
│       ├── components/   # TaskItem, ChatInterface
│       └── api/          # API client
└── start-dev.sh          # Startup script
```

## Common Issues

### Backend won't start

**Problem:** Missing dependencies
**Solution:** `cd backend && pip install -r requirements.txt`

**Problem:** Database error
**Solution:** Delete `personal_assistant.db` and restart

**Problem:** Claude API errors
**Solution:** Check ANTHROPIC_API_KEY in backend/.env

### Frontend won't start

**Problem:** Can't connect to backend
**Solution:** Make sure backend is running on port 8000

**Problem:** Build errors
**Solution:** `cd frontend && rm -rf node_modules && npm install`

### Authentication issues

**Problem:** Can't login after signup
**Solution:** Check browser console, clear localStorage

**Problem:** Token expired
**Solution:** Login again (tokens expire after 7 days)

## Next Steps

### For Development

- **Add features:** Modify React components in `frontend/src/`
- **Add API endpoints:** Create new routers in `backend/`
- **Customize Claude:** Edit prompts in `backend/chat/service.py`
- **Style changes:** Update inline styles in components

### For Production

1. **Deploy backend** to Railway/Heroku/DigitalOcean
2. **Deploy frontend** to Vercel/Netlify
3. **Use PostgreSQL** instead of SQLite
4. **Set up custom domain** on your hosting
5. **Enable HTTPS** (required for production)

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed deployment instructions.

## Resources

- **Full Setup Guide:** [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **README:** [README_FULLSTACK.md](README_FULLSTACK.md)
- **API Docs:** http://localhost:8000/docs (when running)
- **Anthropic Docs:** https://docs.anthropic.com
- **FastAPI Docs:** https://fastapi.tiangolo.com
- **React Docs:** https://react.dev

## Get Help

1. Check error messages in terminal/browser console
2. Review API documentation at /docs
3. Check backend logs for detailed errors
4. Verify .env files are configured correctly

---

**You're all set!** Run `./start-dev.sh` and open http://localhost:5173 to begin.

Happy task managing! 🎯
