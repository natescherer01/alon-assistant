#!/bin/bash

# Personal AI Assistant - Development Startup Script
# This script starts both the backend and frontend in development mode

echo "🚀 Starting Personal AI Assistant..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env files exist
if [ ! -f backend/.env ]; then
    echo -e "${RED}⚠️  Backend .env file not found!${NC}"
    echo "Creating from .env.example..."
    cp backend/.env.example backend/.env
    echo -e "${RED}⚠️  Please edit backend/.env and add your ANTHROPIC_API_KEY${NC}"
    exit 1
fi

if [ ! -f frontend/.env ]; then
    echo "Creating frontend/.env from .env.example..."
    cp frontend/.env.example frontend/.env
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}📡 Starting backend (FastAPI)...${NC}"
cd backend
source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
pip install -q -r requirements.txt
python main.py &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start frontend
echo -e "${BLUE}💻 Starting frontend (React + Vite)...${NC}"
cd frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Services started!${NC}"
echo ""
echo "📡 Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "💻 Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for processes
wait
