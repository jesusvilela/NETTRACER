$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:APP_NAME = "netracer-v2"
$env:PORT = "8788"
$env:DATA_DIR = "data-v2"
$env:NNN_RAMDISK_DIR = Join-Path $root "data-v2\nnn-ramdisk"
$env:NNN_BRIDGE_ENABLED = "0"

npm start
