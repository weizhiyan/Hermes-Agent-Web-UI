@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Hermes Agent WebUI - Install

echo.
echo ========================================
echo   Hermes Agent WebUI - 一键安装
echo ========================================
echo.
echo 这个脚本会检查 Node.js / npm，安装 WebUI 依赖，然后可直接启动。
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Node.js。
  echo.
  echo 请先安装 Node.js 18+ LTS：
  echo https://nodejs.org/
  echo.
  echo 安装完成后，重新双击 install.bat。
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 npm。请重新安装 Node.js LTS，并确认安装 npm。
  pause
  exit /b 1
)

for /f "delims=" %%V in ('node --version 2^>nul') do set "NODE_VERSION=%%V"
for /f "delims=" %%V in ('npm --version 2^>nul') do set "NPM_VERSION=%%V"
echo [OK] Node.js: !NODE_VERSION!
echo [OK] npm: !NPM_VERSION!

where git >nul 2>nul
if errorlevel 1 (
  echo [WARN] 未检测到 Git。可以正常安装和启动，但以后不能通过 GitHub 一键更新。
) else (
  for /f "delims=" %%V in ('git --version 2^>nul') do set "GIT_VERSION=%%V"
  echo [OK] Git: !GIT_VERSION!
)

if not exist ".env" if exist ".env.example" (
  copy ".env.example" ".env" >nul
  echo [OK] 已从 .env.example 创建 .env
)

echo.
echo [Hermes] 正在安装依赖，请稍候...
call npm install --loglevel=warn
if errorlevel 1 (
  echo.
  echo [WARN] 默认 npm 源安装失败，正在尝试国内镜像...
  call npm install --loglevel=warn --registry=https://registry.npmmirror.com
)
if errorlevel 1 (
  echo.
  echo [ERROR] 依赖安装失败。
  echo 常见原因：
  echo   1. 公司网络拦截 npm registry
  echo   2. 代理或证书未配置
  echo   3. Node.js 版本过低或安装不完整
  echo.
  echo 可尝试在浏览器访问 https://registry.npmmirror.com/ 检查网络。
  pause
  exit /b 1
)

echo.
echo [OK] 安装完成。
echo.
set "START_NOW=Y"
set /p START_NOW=是否现在启动 WebUI？直接回车默认启动 [Y/n]:
if /i "!START_NOW!"=="n" (
  echo.
  echo 以后双击 start.bat 启动 WebUI。
  pause
  exit /b 0
)

echo.
echo [Hermes] 正在启动 WebUI...
call "%~dp0start.bat"
exit /b %ERRORLEVEL%
