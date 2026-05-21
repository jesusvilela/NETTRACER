[CmdletBinding()]
param(
  [string]$ServiceName = "NetracerWatchdog"
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "uninstall-service.ps1 must be run from an elevated PowerShell session."
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
  Write-Output "Service '$ServiceName' is not installed."
  exit 0
}

if ($service.Status -ne "Stopped") {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
}

sc.exe delete $ServiceName | Out-Null
Write-Output "Service '$ServiceName' removed."
