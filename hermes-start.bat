@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PORT=3381"
set "URL=http://127.0.0.1:%PORT%/"

title Hermes WebUI - One Click Start

echo.
echo  ╔═══════════════════════════════════════╗
echo  ║      Hermes Agent  WebUI  ✨          ║
echo  ╚═══════════════════════════════════════╝
echo.

:: 1. Kill existing process on port
echo  [1/4] 关闭旧进程 (port %PORT%)...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>nul
)
if exist ".hermes-server.pid" (
    set /p OLD_PID=<.hermes-server.pid
    taskkill /PID !OLD_PID! /T /F >nul 2>nul
    del .hermes-server.pid >nul 2>nul
)
timeout /T 1 /NOBREAK >nul

:: 2. Check Node.js
echo  [2/4] 检查 Node.js...
where node >nul 2>nul || (
    echo  [ERROR] 未找到 Node.js，请安装后再试
    pause
    exit /b 1
)

:: 3. Install deps if needed
if not exist "backend\node_modules" (
    echo  [*] 首次运行，安装依赖...
    pushd backend
    call npm install --loglevel=error
    popd
)

:: 4. Start server
echo  [3/4] 启动后端服务 (Port %PORT%)...
if not exist "logs" mkdir logs
start "Hermes Server" /min cmd /d /c "set PORT=%PORT% && node backend\server.js >> logs\server.log 2>&1"

:: Wait for server to be ready
echo  [4/4] 等待服务就绪...
set "READY="
for /L %%I in (1,1,30) do (
    powershell -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%PORT%/api/health' -TimeoutSec 1;if($r.StatusCode -eq 200){exit 0}}catch{};exit 1" >nul 2>nul
    if not errorlevel 1 set READY=1 & goto ready
    timeout /T 1 /NOBREAK >nul
)

:ready
if defined READY (
    echo  ✅ 启动成功！正在打开浏览器...
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
        > ".hermes-server.pid" echo %%P
    )
    start "" "%URL%"
) else (
    echo  ⚠️  服务启动超时，日志可能包含原因
)

echo.
echo  地址: %URL%
echo  日志: logs\server.log
echo.
echo  按任意键关闭本窗口...
pause >nul 2>nul
exit /b 0
