#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Launching Shoreline Operations Platform (ShorelineOps)"
echo "========================================================"
echo ""

echo "1. Checking dependencies..."
if [ ! -d "node_modules" ]; then
  npm install
fi

if [ ! -d "server/node_modules" ]; then
  (cd server && npm install)
fi

echo ""
echo "2. Building frontend and backend assets..."
npm run build:all

echo ""
echo "========================================================"
echo "  Starting ShorelineOps Local Server on http://localhost:3001"
echo "  (No Docker or external database required!)"
echo ""
echo "  Login: admin@shoreline.demo"
echo "  Password: Admin1234!"
echo "========================================================"
echo ""

npm start
