$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:APP_NAME = "netracer-v4"
$env:PORT = "8790"
$env:DATA_DIR = "data-v4"
$env:NNN_RAMDISK_DIR = Join-Path $root "data-v4\nnn-ramdisk"
$env:NNN_BRIDGE_ENABLED = "0"

npm start
