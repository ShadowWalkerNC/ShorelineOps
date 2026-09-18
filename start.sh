#!/usr/bin/env bash
set -e

echo "======================================================================"
echo "  Shoreline Care OS v5.0 — Healthcare Dietary Operations Platform"
echo "======================================================================"
echo ""

# 1. Checking dependencies
if [ ! -d "node_modules" ]; then
  echo "[*] Installing root dependencies..."
  npm install
fi

if [ ! -d "server/node_modules" ]; then
  echo "[*] Installing backend dependencies..."
  (cd server && npm install)
fi

# 2. Fast Startup vs. Clean Rebuild
DO_BUILD=0
if [ "$1" = "--rebuild" ]; then
  DO_BUILD=1
fi
if [ ! -f "dist/index.html" ] || [ ! -f "server/dist/index.js" ]; then
  DO_BUILD=1
fi

if [ "$DO_BUILD" -eq 1 ]; then
  echo "[*] Compiling client PWA and server production bundles..."
  npm run build:all
else
  echo "[*] Production assets verified (instant startup). Pass '--rebuild' to force compilation."
fi

echo ""
echo "======================================================================"
echo "  Shoreline Care OS Local Station Ready"
echo ""
echo "  Application URL: http://localhost:3001/"
echo "  Kitchen Kiosk:   http://localhost:3001/kitchen/tablet"
echo "  API Health:      http://localhost:3001/health"
echo ""
echo "  Super-Admin:     admin@shorelineops.local"
echo "  Password:        ComplexAdminPass2026!"
echo "======================================================================"
echo ""

# 3. Automatically open default browser in background
(sleep 2 && (xdg-open "http://localhost:3001/" 2>/dev/null || open "http://localhost:3001/" 2>/dev/null || true)) &

# 4. Start Server
npm start
