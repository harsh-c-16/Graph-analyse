@echo off
REM Frontend build and run script for Windows
REM Prerequisites: Node.js and npm installed

setlocal enabledelayedexpansion

cd /d "%~dp0"

if "%1"=="build" goto :build
if "%1"=="start" goto :start
if "%1"=="dev" goto :dev
if "%1"=="clean" goto :clean
if "%1"=="" goto :help

:help
echo.
echo GraphAnalyse React Frontend
echo.
echo Usage: run.bat [command]
echo   install - Install dependencies (npm install^)
echo   build   - Build production bundle (npm run build^)
echo   start   - Run production build locally
echo   dev     - Run development server with hot reload
echo   clean   - Remove node_modules and build artifacts
echo.
goto :end

:install
echo Installing dependencies...
npm install
if errorlevel 1 (
    echo npm install failed
    exit /b 1
)
echo Install complete.
goto :end

:build
echo Building production bundle...
if not exist "node_modules" (
    echo node_modules not found. Running npm install...
    npm install
    if errorlevel 1 exit /b 1
)
npm run build
if errorlevel 1 (
    echo Build failed
    exit /b 1
)
echo Build complete. Static files in: build/
goto :end

:start
echo Starting production server...
if not exist "build" (
    echo build/ directory not found. Running production build first...
    call :build
)
if exist "node_modules\.bin\serve.cmd" (
    call node_modules\.bin\serve -s build -l 3000
) else (
    echo "serve" package not found. To run the production build locally, install serve:
    echo   npm install -g serve
    echo Then run: serve -s build -l 3000
)
goto :end

:dev
echo Starting development server...
if not exist "node_modules" (
    echo node_modules not found. Running npm install...
    npm install
    if errorlevel 1 exit /b 1
)
set CHOKIDAR_USEPOLLING=true
set BROWSER=none
npm start
goto :end

:clean
echo Cleaning...
if exist "node_modules" rmdir /s /q node_modules
if exist "build" rmdir /s /q build
del /q package-lock.json 2>nul
echo Clean complete. Run "run.bat install" to reinstall dependencies.
goto :end

:end
echo.
