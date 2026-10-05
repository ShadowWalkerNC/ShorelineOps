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
        if !errorlevel! neq 0 (
            echo [X] Runtime installation failed. Setup has stopped.
            exit /b 1
        )
        echo [*] Runtime installed. Open a new terminal and rerun Setup.bat to refresh PATH.
        exit /b 0
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
    echo  - Data directory prepared: %%APPDATA%%\ShorelineOps\data
    echo  - Provision JWT_SECRET and SETUP_BOOTSTRAP_SECRET before launch.
    echo  - Complete facility/account setup; existing databases are not migrated.
    echo ======================================================================
    exit /b 0
) else (
    echo.
    echo [X] Setup encountered an issue. Press any key to view details.
    pause
)
