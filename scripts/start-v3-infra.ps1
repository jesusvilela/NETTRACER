$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:APP_NAME = "netracer-v3"
$env:PORT = "8789"
$env:DATA_DIR = "data-v3"
$env:NNN_RAMDISK_DIR = Join-Path $root "data-v3\nnn-ramdisk"
$env:NNN_BRIDGE_ENABLED = "0"

npm start
