@echo off
setlocal enabledelayedexpansion

title Shoreline Care OS — One-Time Setup Wizard
color 0B

echo ======================================================================
echo          SHORELINE CARE OS — 1-CLICK DESKTOP INSTALLER
echo   Open-Source Healthcare Dietary & Clinical Nutrition Operations
echo ======================================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js was not found on your system.
    echo [*] Attempting to install Node.js automatically via Windows Package Manager...
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        echo [*] Node.js installed. Please restart this installer.
        pause
        exit /b 1
    ) else (
        echo [X] Could not install Node.js automatically.
        echo [*] Please download and install Node.js LTS from: https://nodejs.org/
        pause
        exit /b 1
    )
)

echo [*] Node.js environment detected.
node -v
echo.

echo [*] Executing Shoreline Care OS installer configuration...
powershell -ExecutionPolicy Bypass -File "%~dp0Setup.ps1"

if %errorlevel% equ 0 (
    echo.
    echo ======================================================================
    echo [OK] INSTALLATION COMPLETE!
    echo.
    echo [*] A desktop shortcut 'Shoreline Care OS' has been created.
    echo [*] You can now launch Shoreline Care OS anytime from your desktop.
    echo ======================================================================
    echo.
    set /p LAUNCH="Would you like to launch Shoreline Care OS now? (Y/N): "
    if /i "!LAUNCH!"=="Y" (
        start "" "%~dp0ShorelineOps-Launcher.bat"
    )
) else (
    echo.
    echo [X] An error occurred during setup. Please check the logs above.
    pause
)
