@echo off
cd /d "%~dp0"

echo === ai-model-catalog SQLite backup ===
echo.

call npm run db:backup
if errorlevel 1 (
    echo.
    echo ERROR: backup failed.
    pause
    exit /b 1
)

echo.
pause
