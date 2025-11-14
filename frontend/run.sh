#!/bin/bash
# Frontend build and run script for Unix/Linux/WSL

cd "$(dirname "$0")"

usage() {
    cat << EOF
GraphAnalyse React Frontend

Usage: ./run.sh [command]
  install - Install dependencies (npm install)
  build   - Build production bundle (npm run build)
  start   - Run production build locally
  dev     - Run development server with hot reload
  clean   - Remove node_modules and build artifacts

Default: dev
EOF
}

case "${1:-dev}" in
    install)
        echo "Installing dependencies..."
        npm install
        ;;
    build)
        echo "Building production bundle..."
        if [ ! -d "node_modules" ]; then
            echo "node_modules not found. Running npm install..."
            npm install
        fi
        npm run build
        echo "Build complete. Static files in: build/"
        ;;
    start)
        echo "Starting production server..."
        if [ ! -d "build" ]; then
            echo "build/ directory not found. Running production build first..."
            $0 build
        fi
        if command -v serve &> /dev/null; then
            serve -s build -l 3000
        else
            echo "serve package not installed globally. To run the production build locally, install serve:"
            echo "  npm install -g serve"
            echo "Then run: serve -s build -l 3000"
        fi
        ;;
    dev)
        echo "Starting development server..."
        if [ ! -d "node_modules" ]; then
            echo "node_modules not found. Running npm install..."
            npm install
        fi
        export CHOKIDAR_USEPOLLING=true
        export BROWSER=none
        npm start
        ;;
    clean)
        echo "Cleaning..."
        rm -rf node_modules build
        rm -f package-lock.json
        echo "Clean complete. Run './run.sh install' to reinstall dependencies."
        ;;
    help)
        usage
        ;;
    *)
        echo "Unknown command: $1"
        usage
        exit 1
        ;;
esac
