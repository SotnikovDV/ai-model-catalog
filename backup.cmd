@echo off
cd /d "%~dp0"

echo === ai-model-catalog dev backup ===
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup-dev.ps1" -IncludeEnv
if errorlevel 1 (
    echo.
    echo ERROR: backup failed.
    pause
    exit /b 1
)

echo.
pause
