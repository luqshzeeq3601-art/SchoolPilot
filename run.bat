@echo off
setlocal enabledelayedexpansion
title SchoolPilot - Launcher
color 0B
cls
echo =======================================================
echo               SchoolPilot - Starting System
echo =======================================================
echo.

:: 1. Navigate to project root
cd /d "%~dp0"

:: 2. Check Docker
echo [*] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [*] Docker Desktop is not running. Attempting to start Docker Desktop...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%ProgramFiles%\Docker\Docker\Docker Desktop.exe" (
        start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
    ) else if exist "%LocalAppData%\Docker\Docker Desktop.exe" (
        start "" "%LocalAppData%\Docker\Docker Desktop.exe"
    ) else (
        echo [!] Docker Desktop executable not found in default paths.
    )

    echo [*] Waiting for Docker daemon to initialize (up to 90s)...
    set /a DOCKER_RETRY=0

    :wait_docker
    set /a DOCKER_RETRY+=1
    if !DOCKER_RETRY! gtr 30 (
        echo.
        echo [X] Timed out waiting for Docker Desktop daemon.
        echo [*] Please ensure Docker Desktop is installed and running, then try again.
        pause
        exit /b 1
    )
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        echo     ...waiting for Docker engine [!DOCKER_RETRY!/30]...
        goto wait_docker
    )
    echo [OK] Docker engine is ready!
) else (
    echo [OK] Docker is running.
)

echo.
:: 3. Check Ollama
echo [*] Checking Ollama AI models...
ollama list >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Ollama is active.
) else (
    echo [*] Starting Ollama service...
    start /b ollama serve >nul 2>&1
    timeout /t 3 /nobreak >nul
    ollama list >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Ollama service started successfully.
    ) else (
        echo [!] Notice: Please ensure Ollama is running ('ollama serve') for local RAG and chat inference.
    )
)

echo.
:: 4. Launch Containers
echo [*] Starting containers (PostgreSQL pgvector, n8n, FastAPI backend, React frontend)...
docker compose up -d --remove-orphans

if %errorlevel% neq 0 (
    echo.
    echo [X] Failed to start containers via Docker Compose.
    pause
    exit /b %errorlevel%
)

echo.
echo [OK] Containers started!
echo [*] Syncing latest workflows and applying changes...
docker exec schoolpilot_backend python scripts/sync_workflow_json.py >nul 2>&1
timeout /t 2 /nobreak >nul

:: 5. Open Web App in Browser
echo [*] Launching SchoolPilot in your browser...
start http://localhost:5173

echo.
echo =======================================================
echo                   SchoolPilot is LIVE!
echo =======================================================
echo   - Staff & Admin Portal:   http://localhost:5173
echo   - Backend API Docs:       http://localhost:8005/docs
echo   - n8n Automation Engine:  http://localhost:5678
echo.
echo   Demo Login Accounts (Password: Password123!):
echo   - Admin:   admin@cempaka.edu.my
echo   - HoD:     hod.science@cempaka.edu.my
echo   - Teacher: teacher.azman@cempaka.edu.my
echo =======================================================
echo.
echo Press any key to close this launcher window (services will stay running).
echo To stop services later, run stop.bat.
pause >nul
