@echo off
rem Double-click to start the local server and open the page in the default browser.
rem The page is the built app in dist\; it is built here first (needs Node.js) if it is not there yet.
cd /d "%~dp0"
if not exist "dist\index.html" (
  where npm >nul 2>nul && (call npm install && call npm run build) || echo dist\ not found and Node.js is not installed: build the app on a machine with Node.js ^(npm install, npm run build^) and copy the dist folder here.
)
if exist "dist\index.html" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8000 -Open
pause
