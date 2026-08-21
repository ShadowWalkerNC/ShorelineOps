@echo off
echo ========================================================
echo   Launching Shoreline Operations Platform (ShorelineOps)
echo ========================================================
echo.

echo 1. Checking dependencies...
if not exist node_modules (
  echo Installing root dependencies...
  call npm install
)

if not exist server\node_modules (
  echo Installing backend dependencies...
  cd server
  call npm install
  cd ..
)

echo.
echo 2. Building frontend and backend assets...
call npm run build:all

echo.
echo ========================================================
echo   Starting ShorelineOps Local Server on http://localhost:3001
echo   (No Docker or external database required!)
echo.
echo   Login: admin@shoreline.demo
echo   Password: Admin1234!
echo ========================================================
echo.

call npm start
