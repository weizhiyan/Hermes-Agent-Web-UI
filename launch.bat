@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "WEBUI_PORT=3381"
set "PORT="
set "URL=http://127.0.0.1:%WEBUI_PORT%/"
set "LAUNCHER_PID_FILE=.hermes-launcher.pid"
title Hermes Agent WebUI

rem Single-instance startup: a new launch replaces the old terminal/backend tree.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\webui-single-instance.ps1" -Root "%~dp0"
echo.
echo ========================================
echo   Hermes Agent WebUI
echo ========================================
echo.
echo Closing this terminal window will stop the WebUI backend.
echo The browser will open automatically after startup: %URL%
echo.

where node >nul 2>nul || (
    echo [ERROR] Node.js was not found. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%WEBUI_PORT% .*LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>nul
)
if exist ".hermes-server.pid" (
    set /p OLD_PID=<.hermes-server.pid
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\webui-single-instance.ps1" -Root "%~dp0" -ServerPid !OLD_PID! >nul 2>nul
    taskkill /PID !OLD_PID! /T /F >nul 2>nul
    del .hermes-server.pid >nul 2>nul
)
timeout /T 1 /NOBREAK >nul

if not exist "backend\node_modules" (
    echo [Hermes] Installing backend dependencies...
    pushd backend
    call npm install --loglevel=error
    if errorlevel 1 (
        popd
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    popd
)

if not exist "logs" mkdir logs

echo [Hermes] Starting WebUI: %URL%
echo [Hermes] To stop it, close this terminal window.
echo.
node backend\supervisor.js

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backend\scripts\webui-single-instance.ps1" -Root "%~dp0" -Cleanup >nul 2>nul

echo.
echo [Hermes] WebUI stopped.
pause
exit /b 0
