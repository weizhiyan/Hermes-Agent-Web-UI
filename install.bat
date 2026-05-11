@echo off
REM Hermes Agent - 安装依赖
setlocal
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Node.js。请安装 Node.js 18+：https://nodejs.org/
  pause
  exit /b 1
)

echo [Hermes] 安装后端依赖...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install 失败。
  pause
  exit /b 1
)

echo.
echo [Hermes] 安装完成！运行 一键启动.bat 启动服务
pause
