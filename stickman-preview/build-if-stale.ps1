# Builds dist\ when it is missing or older than the sources, so start.bat never serves an old build after a git pull
# (git stamps the files it changes with the current time). Node.js is needed only when there is something to build, and
# dependencies are installed (npm ci) only when package-lock.json changed, so an up-to-date machine needs no network.
# Without Node.js, or when the install or build fails, an existing dist\ is kept and served with a warning.
# Usage: powershell -ExecutionPolicy Bypass -File build-if-stale.ps1   (Windows PowerShell 5.1 or PowerShell 7)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$index = Join-Path 'dist' 'index.html'
function Built { if (Test-Path -LiteralPath $index) { (Get-Item -LiteralPath $index -Force).LastWriteTimeUtc } else { $null } }
function KeepOld($what) {
  if (Built) { Write-Warning "$what failed: serving the previous build in dist\." }
  else { Write-Warning "$what failed and there is no previous build in dist\ to serve." }
  exit 0
}

# the newest file the build reads
$inputs = @('src', 'public', 'poster', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json') | Where-Object { Test-Path -LiteralPath $_ }
$newest = $inputs | ForEach-Object { Get-ChildItem -LiteralPath $_ -File -Recurse -Force } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
$built = Built
if ($built -and $newest -and $newest.LastWriteTimeUtc -le $built) { Write-Host 'dist\ is up to date.'; exit 0 }
$why = if ($built) { 'the sources are newer than dist\ (' + $newest.Name + ')' } else { 'dist\ not found' }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  if ($built) { Write-Warning ($why + ', but Node.js is not installed: serving the old build. Install Node.js 22.13 or newer to rebuild.') }
  else { Write-Host 'dist\ not found and Node.js is not installed: build the app on a machine with Node.js (npm ci, npm run build) and copy the dist folder here.' }
  exit 0
}

Write-Host ($why + ': building...')
$installed = Join-Path 'node_modules' '.package-lock.json'
if (-not (Test-Path -LiteralPath $installed) -or (Get-Item -LiteralPath 'package-lock.json' -Force).LastWriteTimeUtc -gt (Get-Item -LiteralPath $installed -Force).LastWriteTimeUtc) {
  & npm ci
  if ($LASTEXITCODE -ne 0) { KeepOld 'npm ci' }
}
& npm run build
if ($LASTEXITCODE -ne 0) { KeepOld 'npm run build' }
