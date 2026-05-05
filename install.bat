@echo off
REM Hermes Agent - first-time setup
setlocal
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/
  pause
  exit /b 1
)

echo [hermes] Installing backend dependencies...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [hermes] Done. Now run start.bat to launch.
pause
