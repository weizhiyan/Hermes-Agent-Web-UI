@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "WEBUI_PORT=3381"
set "PORT="
set "URL=http://127.0.0.1:%WEBUI_PORT%/"

:: Close old process
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%WEBUI_PORT% .*LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>nul
)
if exist ".hermes-server.pid" (
    set /p OLD_PID=<.hermes-server.pid
    taskkill /PID !OLD_PID! /T /F >nul 2>nul
    del .hermes-server.pid >nul 2>nul
)
timeout /T 1 /NOBREAK >nul

:: Install deps if needed
if not exist "backend\node_modules" (
    pushd backend
    call npm install --loglevel=error
    popd
)

:: Start server
if not exist "logs" mkdir logs
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList 'backend/supervisor.js' -WorkingDirectory '%CD%' -WindowStyle Hidden -RedirectStandardOutput 'logs/supervisor.out.log' -RedirectStandardError 'logs/supervisor.err.log'"

:: Wait and open browser
for /L %%I in (1,1,30) do (
    node -e "const http=require('http');const req=http.get('http://127.0.0.1:%WEBUI_PORT%/api/health',r=>process.exit(r.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(1000,()=>{req.destroy();process.exit(1);});" >nul 2>nul
    if not errorlevel 1 goto ready
    timeout /T 1 /NOBREAK >nul
)

:ready
start "" "%URL%"
exit /b 0




