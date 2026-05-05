@echo off
REM Hermes Agent - one-click launcher
REM Starts the backend (which also serves the frontend) and opens the browser.
setlocal
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 18+ from https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [hermes] node_modules missing, running npm install...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed. Run install.bat manually.
    pause
    exit /b 1
  )
)

set PORT=8787
echo [hermes] Starting backend on http://127.0.0.1:%PORT% ...

REM Open browser after 2 seconds
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:%PORT%/"

node server.js

echo.
echo [hermes] Server stopped.
pause
