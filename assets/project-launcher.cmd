@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0project-launcher.ps1" %*
exit /b %errorlevel%
