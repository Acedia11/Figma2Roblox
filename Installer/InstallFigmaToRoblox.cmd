@echo off
setlocal

set "ScriptDir=%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ScriptDir%InstallFigmaToRoblox.ps1" %*
exit /b %ERRORLEVEL%
