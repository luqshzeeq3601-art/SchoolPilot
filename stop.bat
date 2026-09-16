@echo off
title SchoolPilot - Stop Services
color 0C
cls
echo =======================================================
echo               SchoolPilot - Stopping Services
echo =======================================================
echo.

cd /d "%~dp0"

echo [*] Closing SchoolPilot browser windows...
powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*SchoolPilot*' -or $_.MainWindowTitle -like '*SchoolOps Assist*' -or $_.MainWindowTitle -like '*localhost:5173*' } | ForEach-Object { $_.CloseMainWindow() }" >nul 2>&1

echo [*] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Docker is not running or already stopped.
    goto end
)

echo [*] Stopping and removing SchoolPilot containers...
docker compose down --remove-orphans

if %errorlevel% equ 0 (
    echo.
    echo [OK] All SchoolPilot containers have been stopped successfully.
) else (
    echo.
    echo [!] Notice: One or more services could not be stopped cleanly.
)

:end
echo.
echo Closing in 3 seconds...
timeout /t 3 /nobreak >nul
