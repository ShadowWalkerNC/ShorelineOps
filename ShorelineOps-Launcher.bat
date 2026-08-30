@echo off
setlocal

title Shoreline Care OS Launcher
color 0A

echo ======================================================================
echo                 SHORELINE CARE OS — STARTING
echo   Healthcare Dietary & Clinical Operations Platform (v5.0.0)
echo ======================================================================
echo.

:: Launch the Node.js unified launcher
cd /d "%~dp0"
node launcher.js

if %errorlevel% neq 0 (
    echo.
    echo [X] Launcher exited with error code %errorlevel%.
    pause
)
