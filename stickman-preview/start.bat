@echo off
rem Double-click to start the local server and open the page in the default browser.
rem The page is the built app in dist\. build-if-stale.ps1 builds it first when it is missing or older than the sources
rem (needs Node.js); without Node.js an existing dist\ is served as is.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-if-stale.ps1"
if exist "dist\index.html" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8000 -Open
pause
