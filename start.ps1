$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$logDir = Join-Path $root 'logs'
$port = $env:PORT
if (-not $port) { $port = '8787' }

$rootEnv = Join-Path $root '.env'
$backendEnv = Join-Path $backend '.env'

function Import-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $name = $matches[1]
      $value = $matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      if (-not [string]::IsNullOrEmpty($value) -and -not $env:$name) {
        Set-Item -Path "Env:$name" -Value $value
      }
    }
  }
}

Import-EnvFile $rootEnv
Import-EnvFile $backendEnv

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js 18+ is required.' -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
  Push-Location $backend
  npm install
  Pop-Location
}

if (-not (Test-Path $logDir)) {
  New-Item -ItemType Directory -Path $logDir | Out-Null
}

Start-Process -FilePath node -ArgumentList 'backend/server.js' -WorkingDirectory $root -WindowStyle Hidden

Write-Host "Hermes Agent is starting on http://127.0.0.1:$port/"
