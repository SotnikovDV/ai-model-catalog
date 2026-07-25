@echo off
cd /d "%~dp0"

echo === ai-model-catalog deploy to NAS ===
echo Default target: \\192.168.1.113\docker\ai-model-catalog
echo Code only; production DB on NAS is not touched.
echo Pass -IncludeDb to copy local SQLite to NAS.
echo Pass -NasPath to override target.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-nas.ps1" %*
if errorlevel 1 (
    echo.
    echo ERROR: deploy failed.
    pause
    exit /b 1
)

echo.
pause
