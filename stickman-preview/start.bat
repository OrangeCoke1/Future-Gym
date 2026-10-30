@echo off
rem Double-click to start the local server and open the page in the default browser.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8000 -Open
pause
