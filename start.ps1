$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$port = $env:WEBUI_PORT
if (-not $port) { $port = $env:HERMES_WEBUI_PORT }
if (-not $port) { $port = '3381' }
$env:WEBUI_PORT = $port
Remove-Item Env:PORT -ErrorAction SilentlyContinue

$singleInstanceScript = Join-Path $root 'backend\scripts\webui-single-instance.ps1'
& powershell -NoProfile -ExecutionPolicy Bypass -File $singleInstanceScript -Root $root

Write-Host ''
Write-Host '========================================'
Write-Host '  Hermes Agent WebUI'
Write-Host '========================================'
Write-Host ''
Write-Host 'Closing this PowerShell window will stop the WebUI backend.'
Write-Host "The browser will open automatically after startup: http://127.0.0.1:$port/"
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js 18+ is required.' -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

$backendModules = Join-Path $root 'backend\node_modules'
if (-not (Test-Path $backendModules)) {
  Push-Location (Join-Path $root 'backend')
  npm install --loglevel=error
  Pop-Location
}

try {
  node backend\supervisor.js
} finally {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $singleInstanceScript -Root $root -Cleanup | Out-Null
}
Write-Host ''
Write-Host '[Hermes] WebUI stopped.'
Read-Host 'Press Enter to exit'
