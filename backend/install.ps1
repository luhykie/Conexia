# Install Laravel dependencies using D: drive for Composer cache and temp files.
# Run this if C: drive is low on space: powershell -ExecutionPolicy Bypass -File backend/install.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$env:COMPOSER_HOME = Join-Path (Split-Path -Parent $root) ".composer"
$env:COMPOSER_CACHE_DIR = Join-Path $env:COMPOSER_HOME "cache"
$env:TEMP = Join-Path (Split-Path -Parent $root) ".tmp"
$env:TMP = $env:TEMP

New-Item -ItemType Directory -Force -Path $env:COMPOSER_HOME, $env:COMPOSER_CACHE_DIR, $env:TEMP | Out-Null

Set-Location $root
composer install --prefer-dist --no-interaction --no-dev -o

if (-not (Test-Path "vendor\autoload.php")) {
  throw "Composer install did not complete. Free space on C: or run from a machine with adequate disk space."
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  php artisan key:generate
}

Write-Host "Laravel backend ready."
