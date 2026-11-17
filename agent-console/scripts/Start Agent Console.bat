@echo off
setlocal
title Agent Console
cd /d "%~dp0"

REM Double-clickable launcher: bypasses execution policy for this run only (no permanent change).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-agent-console.ps1" %*

if errorlevel 1 (
  echo.
  echo Launcher failed. See messages above.
  pause
)
endlocal
