@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo ========================================
echo   Hermes Agent WebUI - Update
echo ========================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git not found. Please install Git first.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js 18+ first.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] This folder is not a Git checkout. Download the latest release or clone from GitHub.
  pause
  exit /b 1
)

echo [Hermes] Updating source code...
git pull --ff-only
if errorlevel 1 (
  echo [ERROR] git pull failed. Please check local changes or network.
  pause
  exit /b 1
)

echo.
echo [Hermes] Updating dependencies...
call npm install --loglevel=warn
if errorlevel 1 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [Hermes] Update complete. Run start.bat to launch WebUI.
pause
