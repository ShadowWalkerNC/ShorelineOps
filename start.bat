@echo off
setlocal enabledelayedexpansion

title Shoreline Care OS — Local Workstation
color 0A

echo ======================================================================
echo   Shoreline Care OS v5.0 — Healthcare Dietary Operations Platform
echo ======================================================================
echo.

:: 1. Verify Node.js Environment
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [!] Error: Node.js is not installed or not found on PATH.
  echo     Please install Node.js 20+ LTS from https://nodejs.org/
  pause
  exit /b 1
)

:: 2. Verify Root and Server Dependencies
if not exist "node_modules" (
  echo [*] Installing root dependencies...
  call npm.cmd install
)

if not exist "server\node_modules" (
  echo [*] Installing server dependencies...
  cd server
  call npm.cmd install
  cd ..
)

:: 3. Fast Startup vs. Clean Rebuild
set "DO_BUILD=0"
if "%1"=="--rebuild" set "DO_BUILD=1"
if not exist "dist\index.html" set "DO_BUILD=1"
if not exist "server\dist\index.js" set "DO_BUILD=1"

if "%DO_BUILD%"=="1" (
  echo [*] Compiling client PWA and server production bundles...
  call npm.cmd run build:all
  if %errorlevel% neq 0 (
    echo [X] Build failed with error code %errorlevel%.
    pause
    exit /b %errorlevel%
  )
) else (
  echo [*] Production assets verified (instant startup). Pass '--rebuild' to force compilation.
)

echo.
echo ======================================================================
echo   Shoreline Care OS Local Station Ready
echo.
echo   Application URL: http://localhost:3001/
echo   Kitchen Kiosk:   http://localhost:3001/kitchen/tablet
echo   API Health:      http://localhost:3001/health
echo.
echo   Super-Admin:     admin@shorelineops.local
echo   Password:        ComplexAdminPass2026!
echo ======================================================================
echo.

:: 4. Automatically open default web browser after server starts
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3001/"

:: 5. Start Express API and Static Client
call npm.cmd start
