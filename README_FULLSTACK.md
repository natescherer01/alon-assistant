# Personal AI Assistant - Full Stack Web Application

A smart, multi-user task management system with Claude AI integration. Manage your tasks through a beautiful web interface or chat naturally with Claude to stay organized and productive.

![Architecture](https://img.shields.io/badge/Stack-FastAPI%20%2B%20React-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

### 🎯 Smart Task Management
- **Intelligent Prioritization**: Automatically ranks tasks by deadline, intensity, and status
- **Auto-Detection**: Detects task intensity and "waiting on" status from descriptions
- **Next Task Suggestion**: Always know what to work on next
- **Deadline Tracking**: Visual indicators for overdue and upcoming tasks
- **Flexible Filtering**: View all, waiting, or upcoming tasks

### 💬 Claude AI Integration
- **Conversational Interface**: Chat naturally to manage your tasks
- **Context-Aware**: Claude knows your current tasks and priorities
- **Smart Actions**: Add, update, or complete tasks through conversation
- **Proactive Suggestions**: Get reminders and follow-up prompts

### 👥 Multi-User Support
- **Secure Authentication**: JWT-based login with bcrypt password hashing
- **Isolated Data**: Each user has their own tasks and chat history
- **User Profiles**: Track multiple users on your domain

### 🎨 Modern UI
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Instant task updates across all views
- **Dual Interface**: Toggle between task list and chat interface
- **Clean Dashboard**: Overview with stats and priority indicators

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- Anthropic API key

### 1. Clone and Setup Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

python main.py
```

### 2. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### 3. Open Application

Visit http://localhost:5173 and create your account!

📖 **Full setup instructions**: See [SETUP_GUIDE.md](SETUP_GUIDE.md)

## 📁 Project Structure

```
personal AI/
├── backend/                    # FastAPI backend
│   ├── main.py                # App entry point
│   ├── config.py              # Configuration
│   ├── database.py            # Database setup
│   ├── models.py              # SQLAlchemy models
│   ├── schemas.py             # Pydantic schemas
│   ├── auth/                  # Authentication
│   │   ├── router.py
│   │   ├── utils.py
│   │   └── dependencies.py
│   ├── tasks/                 # Task management
│   │   ├── router.py
│   │   └── service.py
│   └── chat/                  # Claude integration
│       ├── router.py
│       └── service.py
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   ├── pages/            # Route pages
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   └── Dashboard.jsx
│   │   ├── components/       # Reusable components
│   │   │   ├── TaskItem.jsx
│   │   │   ├── AddTaskForm.jsx
│   │   │   └── ChatInterface.jsx
│   │   ├── api/              # API client
│   │   │   └── client.js
│   │   └── utils/            # Auth store
│   │       └── authStore.js
│   └── package.json
└── personal_assistant/         # Original CLI version (reference)
```

## 🔧 Technology Stack

### Backend
- **FastAPI**: Modern Python web framework
- **SQLAlchemy**: SQL toolkit and ORM
- **SQLite/PostgreSQL**: Database
- **JWT**: Secure authentication
- **Anthropic SDK**: Claude AI integration
- **Pydantic**: Data validation

### Frontend
- **React 18**: UI library
- **Vite**: Build tool
- **React Router**: Navigation
- **TanStack Query**: API state management
- **Zustand**: Global state
- **Axios**: HTTP client

## 🎯 Use Cases

Perfect for:
- **Personal Productivity**: Manage your daily tasks with AI assistance
- **Team Management**: Deploy for your team on your domain
- **Project Tracking**: Keep complex projects organized
- **Client Work**: Track tasks waiting on client responses
- **Academic Work**: Manage assignments and deadlines

## 🌐 Deployment

### Option 1: Cloud Platforms

**Backend**: Railway, Heroku, DigitalOcean, AWS
**Frontend**: Vercel, Netlify, Cloudflare Pages
**Database**: Railway, Heroku Postgres, Supabase

### Option 2: Docker

```bash
docker-compose up
```

### Option 3: VPS

Deploy both backend and frontend on a single VPS with Nginx reverse proxy.

📖 **Full deployment guide**: See [SETUP_GUIDE.md](SETUP_GUIDE.md#deployment)

## 🔒 Security Features

- ✅ JWT authentication with secure tokens
- ✅ Bcrypt password hashing
- ✅ CORS protection
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ Input validation (Pydantic)
- ✅ Environment-based configuration
- ✅ User data isolation

## 📊 API Documentation

Once the backend is running, visit:
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Key Endpoints

```
POST   /api/v1/auth/signup          Create account
POST   /api/v1/auth/login           Login
GET    /api/v1/tasks                List tasks
POST   /api/v1/tasks                Create task
GET    /api/v1/tasks/next           Get next priority task
POST   /api/v1/tasks/{id}/complete  Complete task
POST   /api/v1/chat                 Chat with Claude
```

## 💡 Example Chat Interactions

```
You: "What's next?"
Claude: "Your next task is: Prepare quarterly report (Due in 2 days, Heavy intensity).
Would you like to start working on this?"

You: "Add task: Call John about the proposal, deadline tomorrow"
Claude: "I've added a new task:
- Title: Call John about the proposal
- Deadline: 2025-11-11
- Intensity: 2 (Light) - auto-detected from 'call'
- Status: Not started
Would you like me to set a reminder?"

You: "I completed the technical brief and sent it to Luke"
Claude: "Great! I've marked the technical brief as completed.
I've also created a follow-up task to check with Luke since you're waiting on his response.
What would you like to work on next?"
```

## 🎨 Screenshots

### Dashboard
- Task list with priority indicators
- Stats overview
- Add task form

### Chat Interface
- Conversational task management
- Quick action prompts
- Chat history

### Task Details
- Intensity levels
- Status tracking
- Deadline indicators

## 🔄 Migrating from CLI Version

If you're using the original CLI version:

1. Your task data is in `personal_assistant/data/tasks.json`
2. To migrate, create a user account in the web app
3. Import tasks via the API or manually recreate them
4. The logic is the same, just with a web interface!

## 🤝 Contributing

This is a personal project, but feel free to fork and customize for your needs!

## 📝 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Powered by [Anthropic Claude](https://www.anthropic.com/)
- UI inspired by modern task management apps

## 📧 Support

For issues or questions:
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Review API docs at `/docs`
3. Open an issue on GitHub

---

**Ready to get started?** See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions!

Built with ❤️ and Claude AI
