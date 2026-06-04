@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "WEBUI_PORT=3381"
set "PORT="
set "URL=http://127.0.0.1:%WEBUI_PORT%/"
set "PID_FILE=%ROOT%.hermes-server.pid"
set "LOG_DIR=%ROOT%logs"
set "LOG_FILE=%LOG_DIR%\server.log"
title Hermes Agent Launcher

if exist "%ROOT%.env" call :load_env "%ROOT%.env"
if exist "%BACKEND%.env" call :load_env "%BACKEND%.env"
set "URL=http://127.0.0.1:%WEBUI_PORT%/"

echo.
echo ========================================
echo   Hermes Agent WebUI - Launcher
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 18+
  pause
  exit /b 1
)

if not exist "%BACKEND%\server.js" (
  echo [ERROR] Cannot find backend\server.js
  pause
  exit /b 1
)

if not exist "%BACKEND%\node_modules" (
  echo [Hermes] Installing backend dependencies...
  pushd "%BACKEND%"
  call npm install --loglevel=warn
  if errorlevel 1 (
    popd
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
  popd
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul

call :stop_old_instance

echo [Hermes] Starting server at %URL%
pushd "%ROOT%"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Process -FilePath node -ArgumentList 'backend/supervisor.js' -WorkingDirectory '%ROOT%' -WindowStyle Hidden -RedirectStandardOutput 'logs/supervisor.out.log' -RedirectStandardError 'logs/supervisor.err.log'"
popd

call :wait_for_health
if errorlevel 1 (
  echo [ERROR] Server did not become ready. See logs\server.log
  pause
  exit /b 1
)

echo [Hermes] Server is ready.
start "" "%URL%"
echo [Hermes] Browser opened. You can close this window.
pause
exit /b 0

:stop_old_instance
set "OLD_PID="
if exist "%PID_FILE%" (
  set /p OLD_PID=<"%PID_FILE%"
  if defined OLD_PID (
    echo [Hermes] Stopping previous PID !OLD_PID!
    taskkill /PID !OLD_PID! /T /F >nul 2>nul
  )
  del /f /q "%PID_FILE%" >nul 2>nul
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%WEBUI_PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    echo [Hermes] Stopping process on port %WEBUI_PORT%: %%P
    taskkill /PID %%P /T /F >nul 2>nul
  )
)
timeout /T 1 /NOBREAK >nul
exit /b 0

:wait_for_health
for /L %%I in (1,1,60) do (
  node -e "const http=require('http');const req=http.get('%URL%api/health',r=>process.exit(r.statusCode===200?0:1));req.on('error',()=>process.exit(1));req.setTimeout(1500,()=>{req.destroy();process.exit(1);});" >nul 2>nul
  if not errorlevel 1 exit /b 0
  timeout /T 1 /NOBREAK >nul
)
exit /b 1

:load_env
set "ENV_FILE=%~1"
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
  if not "%%A"=="" (
    if not "%%A:~0,1%"=="#" (
      if /i "%%A"=="WEBUI_PORT" set "WEBUI_PORT=%%B"
      if /i "%%A"=="NODE_ENV" set "NODE_ENV=%%B"
    )
  )
)
exit /b 0


