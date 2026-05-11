@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "PORT=8787"
set "URL=http://127.0.0.1:%PORT%/"
set "PID_FILE=%ROOT%.hermes-server.pid"
set "LOG_DIR=%ROOT%logs"
set "LOG_FILE=%LOG_DIR%\server.log"
title Hermes Agent Launcher

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
start "Hermes Server" /min cmd /d /c "node backend\server.js >> logs\server.log 2>&1"
popd

call :wait_for_health
if errorlevel 1 (
  echo [ERROR] Server did not become ready. See logs\server.log
  pause
  exit /b 1
)

call :write_pid
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
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    echo [Hermes] Stopping process on port %PORT%: %%P
    taskkill /PID %%P /T /F >nul 2>nul
  )
)
timeout /T 1 /NOBREAK >nul
exit /b 0

:wait_for_health
for /L %%I in (1,1,60) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri '%URL%api/health' -TimeoutSec 2;if($r.StatusCode -eq 200){exit 0}}catch{};exit 1" >nul 2>nul
  if not errorlevel 1 exit /b 0
  timeout /T 1 /NOBREAK >nul
)
exit /b 1

:write_pid
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  > "%PID_FILE%" echo %%P
  echo [Hermes] Server PID: %%P
  exit /b 0
)
exit /b 0
