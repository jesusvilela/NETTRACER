[CmdletBinding()]
param(
  [string]$ServiceName = "NetracerWatchdog",
  [string]$DisplayName = "Netracer Watchdog",
  [string]$RepoRoot = "",
  [string]$ProjectPath = "",
  [string]$PublishDir = "",
  [string]$NodePath = "",
  [int]$Port = 8787,
  [string]$BindHost = "127.0.0.1",
  [string]$DataDir = "data",
  [int]$PollIntervalSeconds = 15,
  [int]$HealthTimeoutSeconds = 5,
  [int]$StartupGraceSeconds = 25,
  [int]$RestartDelaySeconds = 5,
  [int]$UnhealthyThreshold = 3,
  [switch]$TakeoverExisting
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "install-service.ps1 must be run from an elevated PowerShell session."
  }
}

function Get-NodePath {
  param([string]$ConfiguredNodePath)
  if ($ConfiguredNodePath) {
    return (Resolve-Path $ConfiguredNodePath).Path
  }
  return (Get-Command node -ErrorAction Stop).Source
}

function Stop-PortListener {
  param([int]$TargetPort)
  $listener = Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) {
    return
  }

  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if (-not $proc) {
    return
  }

  $allowed = @("node.exe", "dotnet.exe", "Netracer.ServiceHost.exe")
  if ($allowed -notcontains $proc.Name) {
    throw "Port $TargetPort is owned by $($proc.Name). Refusing to stop an unrelated process."
  }

  Stop-Process -Id $proc.ProcessId -Force
  Start-Sleep -Seconds 2
}

Assert-Administrator

$scriptRepoRoot = if ($RepoRoot) { $RepoRoot } else { Join-Path $PSScriptRoot ".." }
$RepoRoot = (Resolve-Path $scriptRepoRoot).Path
$ProjectPath = if ($ProjectPath) { (Resolve-Path $ProjectPath).Path } else { Join-Path $RepoRoot "windows-service\\Netracer.ServiceHost\\Netracer.ServiceHost.csproj" }
$PublishDir = if ($PublishDir) { $PublishDir } else { Join-Path $RepoRoot "windows-service\\publish" }
$NodePath = Get-NodePath -ConfiguredNodePath $NodePath
$HealthUrl = "http://127.0.0.1:$Port/healthz"

dotnet publish $ProjectPath -c Release -r win-x64 --self-contained false -o $PublishDir | Out-Null

$binaryPath = Join-Path $PublishDir "Netracer.ServiceHost.exe"
if (-not (Test-Path $binaryPath)) {
  throw "Published service executable not found at $binaryPath"
}

$serviceArgs = @(
  "--Supervisor:RepoRoot=$RepoRoot",
  "--Supervisor:NodePath=$NodePath",
  "--Supervisor:Port=$Port",
  "--Supervisor:Host=$BindHost",
  "--Supervisor:DataDir=$DataDir",
  "--Supervisor:HealthUrl=$HealthUrl",
  "--Supervisor:PollIntervalSeconds=$PollIntervalSeconds",
  "--Supervisor:HealthTimeoutSeconds=$HealthTimeoutSeconds",
  "--Supervisor:StartupGraceSeconds=$StartupGraceSeconds",
  "--Supervisor:RestartDelaySeconds=$RestartDelaySeconds",
  "--Supervisor:UnhealthyThreshold=$UnhealthyThreshold"
)

$quotedArgs = $serviceArgs | ForEach-Object {
  if ($_ -match "\s") { "`"$_`"" } else { $_ }
}
$binPath = ('"{0}" {1}' -f $binaryPath, ($quotedArgs -join " "))

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
  }
  sc.exe config $ServiceName binPath= $binPath start= auto | Out-Null
}
else {
  sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= $DisplayName | Out-Null
}

sc.exe description $ServiceName "Supervises netracer and restarts it after crashes or failed health checks." | Out-Null
sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/10000 | Out-Null
sc.exe failureflag $ServiceName 1 | Out-Null

if ($TakeoverExisting) {
  Stop-PortListener -TargetPort $Port
}

Start-Service -Name $ServiceName

$deadline = (Get-Date).AddSeconds(30)
do {
  Start-Sleep -Milliseconds 750
  try {
    $response = Invoke-WebRequest $HealthUrl -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
      break
    }
  } catch {
  }
} while ((Get-Date) -lt $deadline)

if ((Get-Date) -ge $deadline) {
  throw "Service installed but health check at $HealthUrl did not become ready within 30 seconds."
}

[pscustomobject]@{
  serviceName = $ServiceName
  displayName = $DisplayName
  binaryPath = $binaryPath
  nodePath = $NodePath
  repoRoot = $RepoRoot
  healthUrl = $HealthUrl
  takeoverExisting = [bool]$TakeoverExisting
} | ConvertTo-Json -Depth 6
