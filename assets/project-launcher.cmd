@echo off
rem PATH independence: Windows PowerShell is called by absolute path, never through PATH.
if not exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" echo PREGATE could not evaluate: Windows PowerShell is not in %%SystemRoot%%\System32\WindowsPowerShell\v1.0; report it to the user 1>&2 & exit /b 2
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0project-launcher.ps1" %*
exit /b %errorlevel%
