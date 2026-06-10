@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Hermes Agent WebUI - Update

echo.
echo ========================================
echo   Hermes Agent WebUI - 一键更新
echo ========================================
echo.
echo 建议先关闭正在运行的 WebUI，再执行更新。
echo 本脚本只做安全快进更新，不会清理或覆盖你的本地改动。
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Git，无法从 GitHub 更新。
  echo 请安装 Git for Windows：https://git-scm.com/download/win
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Node.js。
  echo 请安装 Node.js 18+ LTS：https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 npm。请重新安装 Node.js LTS，并确认安装 npm。
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] 当前目录不是 Git 克隆项目，不能使用一键更新。
  echo 如果你使用的是压缩包版本，请下载新版压缩包替换，或用 Git 重新 clone。
  pause
  exit /b 1
)

for /f "delims=" %%V in ('git --version 2^>nul') do set "GIT_VERSION=%%V"
for /f "delims=" %%V in ('node --version 2^>nul') do set "NODE_VERSION=%%V"
for /f "delims=" %%V in ('npm --version 2^>nul') do set "NPM_VERSION=%%V"
echo [OK] !GIT_VERSION!
echo [OK] Node.js: !NODE_VERSION!
echo [OK] npm: !NPM_VERSION!
echo.

for /f %%C in ('git status --porcelain 2^>nul ^| find /c /v ""') do set "DIRTY_COUNT=%%C"
if not "!DIRTY_COUNT!"=="0" (
  echo [ERROR] 检测到 !DIRTY_COUNT! 个本地改动，已停止自动更新，避免覆盖你的内容。
  echo.
  git status --short
  echo.
  echo 处理方式：
  echo   1. 如果是你自己的代码改动，请先提交或备份。
  echo   2. 如果只是临时文件，请手动处理后再运行 update.bat。
  pause
  exit /b 1
)

git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 当前分支没有绑定远端 upstream，无法判断从哪里更新。
  echo 可在命令行设置 upstream，或重新 clone 项目。
  pause
  exit /b 1
)

echo [Hermes] 正在检查远端更新...
git fetch --tags --prune
if errorlevel 1 (
  echo.
  echo [ERROR] 远端检查失败。
  echo 常见原因：
  echo   1. 公司网络、代理或证书拦截 GitHub
  echo   2. GitHub 需要登录或权限不足
  echo   3. 当前 remote 地址不可访问
  echo.
  echo 你可以先检查：git remote -v
  pause
  exit /b 1
)

set "AHEAD=0"
set "BEHIND=0"
for /f "tokens=1,2" %%A in ('git rev-list --left-right --count HEAD..."@{u}" 2^>nul') do (
  set "AHEAD=%%A"
  set "BEHIND=%%B"
)

if not "!AHEAD!"=="0" (
  echo [ERROR] 本地提交领先远端 !AHEAD! 个，不能安全自动更新。
  echo 请手动处理 Git 分支后再运行 update.bat。
  pause
  exit /b 1
)

if "!BEHIND!"=="0" (
  echo [OK] 当前代码已经是最新状态。
) else (
  echo [Hermes] 发现 !BEHIND! 个远端提交，正在安全更新代码...
  git pull --ff-only
  if errorlevel 1 (
    echo.
    echo [ERROR] git pull 失败。
    echo 常见原因是网络中断、本地分支分叉，或远端策略变化。
    pause
    exit /b 1
  )
)

echo.
echo [Hermes] 正在安装/修复依赖...
call npm install --loglevel=warn
if errorlevel 1 (
  echo.
  echo [WARN] 默认 npm 源安装失败，正在尝试国内镜像...
  call npm install --loglevel=warn --registry=https://registry.npmmirror.com
)
if errorlevel 1 (
  echo.
  echo [ERROR] npm install 失败。
  echo 常见原因是公司网络拦截 npm registry，或代理/证书未配置。
  pause
  exit /b 1
)

echo.
echo [OK] 更新完成。建议重启 WebUI。
echo.
set "START_NOW=N"
set /p START_NOW=是否现在启动 WebUI？直接回车默认不启动 [y/N]:
if /i "!START_NOW!"=="y" (
  call "%~dp0start.bat"
  exit /b %ERRORLEVEL%
)

pause
exit /b 0
