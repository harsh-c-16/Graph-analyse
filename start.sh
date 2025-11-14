#!/usr/bin/env bash
# Unified startup script for DSA-Project (Unix/Linux/Mac/WSL)

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          DSA-Project GraphAnalyse Full Stack Demo            ║"
echo "║                                                              ║"
echo "║  Frontend: http://localhost:3000 (React + Tailwind)        ║"
echo "║  Backend:  http://localhost:8080 (C++ Graph Engine)        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        echo "   Download from: https://nodejs.org/"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Node.js $(node --version) found"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} npm $(npm --version) found"
    
    # Check for C++ compiler (optional - can be installed later)
    if command -v g++ &> /dev/null; then
        echo -e "${GREEN}✓${NC} g++ $(g++ --version | head -1) found"
    elif command -v clang++ &> /dev/null; then
        echo -e "${GREEN}✓${NC} clang++ $(clang++ --version | head -1) found"
    else
        echo -e "${YELLOW}⚠${NC}  No C++ compiler detected (g++ or clang)"
        echo "   Backend compile will be skipped"
        echo "   Install via: apt-get install build-essential (Linux)"
        echo "                 brew install gcc (Mac)"
        SKIP_BACKEND=1
    fi
    
    echo ""
}

# Build backend
build_backend() {
    if [ "$SKIP_BACKEND" = "1" ]; then
        echo -e "${YELLOW}⏭ Skipping backend build (compiler not found)${NC}"
        echo "   To enable backend, install a C++17 compiler"
        return
    fi
    
    echo -e "${BLUE}Building Backend (C++)...${NC}"
    cd backend
    
    if [ -f "build.sh" ]; then
        chmod +x build.sh
        ./build.sh cmake
    else
        mkdir -p build
        cd build
        cmake .. -DCMAKE_BUILD_TYPE=Release
        cmake --build . --config Release
        cd ..
    fi
    
    cd ..
    echo -e "${GREEN}✓ Backend built successfully${NC}"
    echo ""
}

# Start backend
start_backend() {
    if [ "$SKIP_BACKEND" = "1" ]; then
        echo -e "${YELLOW}⏭ Skipping backend start${NC}"
        return
    fi
    
    echo -e "${BLUE}Starting Backend (C++)...${NC}"
    if [ -f "backend/build/graph_engine" ]; then
        BACKEND_BIN="backend/build/graph_engine"
    elif [ -f "backend/graph_engine" ]; then
        BACKEND_BIN="backend/graph_engine"
    else
        echo -e "${RED}❌ Backend executable not found${NC}"
        echo "   Please build backend first: cd backend && ./build.sh cmake"
        return
    fi
    
    $BACKEND_BIN &
    BACKEND_PID=$!
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
    echo "  Listening on: http://localhost:8080"
    sleep 2
    echo ""
}

# Build frontend
build_frontend() {
    echo -e "${BLUE}Building Frontend (React)...${NC}"
    cd frontend
    
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    cd ..
    echo -e "${GREEN}✓ Frontend dependencies ready${NC}"
    echo ""
}

# Start frontend
start_frontend() {
    echo -e "${BLUE}Starting Frontend (React)...${NC}"
    echo -e "${GREEN}✓ Starting dev server...${NC}"
    echo "  Opening http://localhost:3000 in browser..."
    echo ""
    echo -e "${YELLOW}Tip: Dev server will auto-reload when you edit files${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the frontend (backend will keep running)${NC}"
    echo ""
    
    cd frontend
    export CHOKIDAR_USEPOLLING=true
    export BROWSER=none
    npm start
}

# Main execution
main() {
    check_prerequisites
    
    build_backend
    start_backend
    
    build_frontend
    start_frontend
    
    # Cleanup on exit
    trap "kill $BACKEND_PID 2>/dev/null || true; exit" EXIT
}

main
