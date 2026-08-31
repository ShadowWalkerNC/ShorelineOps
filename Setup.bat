@echo off
setlocal enabledelayedexpansion

title Shoreline Care OS — 1-Click Desktop Setup
color 0A

echo ======================================================================
echo          SHORELINE CARE OS — 1-CLICK DESKTOP SETUP
echo   Healthcare Dietary & Clinical Nutrition Operations (v5.0.0)
echo ======================================================================
echo.
echo [*] Setting up your workstation... Please wait a few moments.
echo.

:: 1. Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [*] Preparing local runtime environment...
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        echo [*] Installing runtime packages automatically...
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        echo [*] Runtime packages installed successfully.
    ) else (
        echo [!] Note: Node.js LTS is required for the local offline database server.
        echo [*] Opening official Node.js installer: https://nodejs.org/
        start https://nodejs.org/
        echo [*] Please click 'Install' on the downloaded file, then re-run Setup.bat.
        pause
        exit /b 1
    )
)

:: 2. Execute PowerShell setup for shortcuts and local database initialization
powershell -ExecutionPolicy Bypass -File "%~dp0Setup.ps1"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo  [OK] SETUP COMPLETE!
    echo.
    echo  - Desktop Icon Created: 'Shoreline Care OS'
    echo  - Local Database Initialized: %%APPDATA%%\ShorelineOps\data
    echo  - Starting Shoreline Care OS automatically in 3 seconds...
    echo ======================================================================
    timeout /t 3 >nul
    start "" "%~dp0ShorelineOps-Launcher.bat"
    exit /b 0
) else (
    echo.
    echo [X] Setup encountered an issue. Press any key to view details.
    pause
)
