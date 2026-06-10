param(
  [Parameter(Mandatory=$true)][string]$Root,
  [switch]$Cleanup,
  [int]$ServerPid = 0
)
$ErrorActionPreference = 'SilentlyContinue'
$rootPath = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
$pidFile = Join-Path $rootPath '.hermes-launcher.pid'
$currentParentPid = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
if (-not $currentParentPid) { $currentParentPid = $PID }

function Get-AncestorProcessIds([int]$StartPid) {
  $ids = New-Object 'System.Collections.Generic.HashSet[int]'
  $pidCursor = $StartPid
  for ($i = 0; $i -lt 10 -and $pidCursor; $i++) {
    if (-not $ids.Add([int]$pidCursor)) { break }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$pidCursor"
    if (-not $proc) { break }
    $pidCursor = [int]$proc.ParentProcessId
  }
  return $ids
}

function Stop-Tree([int]$TargetPid) {
  if ($TargetPid -le 0) { return }
  taskkill /PID $TargetPid /T /F | Out-Null
}

$protected = Get-AncestorProcessIds -StartPid ([int]$PID)
[void]$protected.Add([int]$currentParentPid)

function Test-IsWebuiTerminalProcess($Proc) {
  if (-not $Proc) { return $false }
  $name = ([string]$Proc.Name).ToLowerInvariant()
  $cmd = ([string]$Proc.CommandLine).ToLowerInvariant()
  return $name -in @('cmd.exe','powershell.exe','pwsh.exe','windowsterminal.exe','wt.exe') -or $cmd.Contains('launch.bat') -or $cmd.Contains('start.bat') -or $cmd.Contains('hermes-start.bat') -or $cmd.Contains('start.ps1')
}

function Stop-ParentConsoleForPid([int]$ChildPid) {
  if ($ChildPid -le 0) { return }
  $cursor = Get-CimInstance Win32_Process -Filter "ProcessId=$ChildPid"
  for ($i = 0; $i -lt 8 -and $cursor; $i++) {
    $parentPid = [int]$cursor.ParentProcessId
    if ($parentPid -le 0 -or $protected.Contains($parentPid)) { return }
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$parentPid"
    if (-not $parent) { return }
    if (Test-IsWebuiTerminalProcess $parent) {
      Stop-Tree $parentPid
      return
    }
    $cursor = $parent
  }
}

if ($ServerPid -gt 0) {
  Stop-ParentConsoleForPid $ServerPid
  exit 0
}

if ($Cleanup) {
  if (Test-Path $pidFile) {
    $saved = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($saved -eq "$currentParentPid" -or $saved -eq "$PID") {
      Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
  exit 0
}

if (Test-Path $pidFile) {
  $oldPid = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($oldPid -and $oldPid -match '^\d+$' -and -not $protected.Contains([int]$oldPid)) {
    Stop-Tree ([int]$oldPid)
    Start-Sleep -Milliseconds 500
  }
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

$rootLower = $rootPath.ToLowerInvariant()
$rootSlash = $rootLower.Replace('\','/')
$patterns = @('launch.bat','start.bat','hermes-start.bat','start.ps1','backend\supervisor.js','backend/supervisor.js')
$processes = Get-CimInstance Win32_Process
foreach ($proc in $processes) {
  $cmd = [string]$proc.CommandLine
  if (-not $cmd) { continue }
  $cmdLower = $cmd.ToLowerInvariant()
  $sameRoot = $cmdLower.Contains($rootLower) -or $cmdLower.Contains($rootSlash)
  if (-not $sameRoot) { continue }
  $isWebuiLaunch = $false
  foreach ($pattern in $patterns) {
    if ($cmdLower.Contains($pattern.ToLowerInvariant())) { $isWebuiLaunch = $true; break }
  }
  if (-not $isWebuiLaunch) { continue }
  $targetPid = [int]$proc.ProcessId
  if ($protected.Contains($targetPid)) { continue }
  Stop-Tree $targetPid
  Start-Sleep -Milliseconds 200
}

Set-Content -Path $pidFile -Value $currentParentPid -Encoding ascii
