#!/bin/bash

# Configuration
PROJECT_ROOT="/home/user/videotranslator"
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
sleep 3
echo "✅ Services are running."
echo "🔗 Frontend: http://localhost:$FRONTEND_PORT"
echo "🔗 Backend:  http://localhost:$BACKEND_PORT"
echo "💡 Press Ctrl+C to stop all services."

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
