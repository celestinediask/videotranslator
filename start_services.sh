#!/bin/bash

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_PORT=8000
FRONTEND_PORT=5173

echo "🚀 Starting Multilingual Video Converter Services..."

# Function to clean up processes on exit
cleanup() {
    echo -e "\n🛑 Stopping services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

# Trap Ctrl+C (SIGINT) and call cleanup
trap cleanup SIGINT

# 0. Environment Checks
echo "🔍 Checking environment..."

# Detect project root if hardcoded one fails
if [ ! -d "$PROJECT_ROOT" ]; then
    PROJECT_ROOT=$(pwd)
    BACKEND_DIR="$PROJECT_ROOT/backend"
    FRONTEND_DIR="$PROJECT_ROOT/frontend"
fi

if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo "❌ Error: Backend virtual environment not found at $BACKEND_DIR/venv"
    echo "💡 Run 'cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt' first."
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "⚠️  Warning: $BACKEND_DIR/.env file not found."
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "❌ Error: Frontend node_modules not found at $FRONTEND_DIR/node_modules"
    echo "💡 Run 'cd frontend && npm install' first."
    exit 1
fi

# 1. Kill any existing processes on these ports
echo "🧹 Cleaning up existing processes on ports $BACKEND_PORT and $FRONTEND_PORT..."
fuser -k $BACKEND_PORT/tcp > /dev/null 2>&1
fuser -k $FRONTEND_PORT/tcp > /dev/null 2>&1

# 2. Start Backend
echo "🐍 Starting Backend (FastAPI) on port $BACKEND_PORT..."
cd "$BACKEND_DIR"
# Use python3 -m uvicorn to avoid shebang issues in the venv
./venv/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT > backend.log 2>&1 &
BACKEND_PID=$!

# 3. Start Frontend
echo "⚛️ Starting Frontend (Vite/React) on port $FRONTEND_PORT..."
cd "$FRONTEND_DIR"
npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT > frontend.log 2>&1 &
FRONTEND_PID=$!


# 4. Verification & Waiting
sleep 4

BACKEND_UP=$(ps -p $BACKEND_PID > /dev/null && echo "UP" || echo "DOWN")
FRONTEND_UP=$(ps -p $FRONTEND_PID > /dev/null && echo "UP" || echo "DOWN")

if [ "$BACKEND_UP" == "UP" ] && [ "$FRONTEND_UP" == "UP" ]; then
    echo "✅ Services are running."
    echo "🔗 Frontend: http://localhost:$FRONTEND_PORT"
    echo "🔗 Backend:  http://localhost:$BACKEND_PORT"
    echo "💡 Press Ctrl+C to stop all services."
else
    echo "❌ Some services failed to start!"
    if [ "$BACKEND_UP" == "DOWN" ]; then
        echo "🚨 Backend (FastAPI) crashed! Last few lines of backend/backend.log:"
        tail -n 10 "$BACKEND_DIR/backend.log"
    fi
    if [ "$FRONTEND_UP" == "DOWN" ]; then
        echo "🚨 Frontend (Vite) crashed! Last few lines of frontend/frontend.log:"
        tail -n 10 "$FRONTEND_DIR/frontend.log"
    fi
    cleanup
fi

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
