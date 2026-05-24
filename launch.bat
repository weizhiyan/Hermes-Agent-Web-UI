@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PORT=3381"
set "URL=http://127.0.0.1:%PORT%/"

:: Close old process
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
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
start "Hermes Server" /min cmd /d /c "set PORT=%PORT% && node backend\server.js >> logs\server.log 2>&1"

:: Wait and open browser
for /L %%I in (1,1,30) do (
    powershell -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/api/health' -TimeoutSec 1;if($r.StatusCode -eq 200){exit 0}}catch{};exit 1" >nul 2>nul
    if not errorlevel 1 goto ready
    timeout /T 1 /NOBREAK >nul
)

:ready
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    > ".hermes-server.pid" echo %%P
)
start "" "%URL%"
exit /b 0

