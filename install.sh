#!/usr/bin/env bash
# ==============================================================================
# Shoreline Care OS — Turnkey Unix/Linux/macOS Deployment Engine
# Healthcare Dietary Operations & Clinical Nutrition Platform (v5.0.0)
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================================${NC}"
echo -e "${CYAN}  SHORELINE CARE OS — TURNKEY BOOTSTRAP & PROVISIONING${NC}"
echo -e "${CYAN}======================================================================${NC}"

# 1. Environment & Node.js Verification
echo -e "\n${YELLOW}[1/6] Verifying runtime environment...${NC}"

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Node.js is not installed.${NC}"
    echo "Please install Node.js 24 from https://nodejs.org/"

    exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2)

if ! node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=19)?0:1)"; then
    echo "[ERROR] Node.js 22.19 or newer is required; Node.js 24 is recommended."
    exit 1
fi
echo -e "${GREEN}[OK] Node.js v$NODE_VER detected.${NC}"

# 2. Local Data Directory Provisioning
echo -e "\n${YELLOW}[2/6] Provisioning persistent data storage...${NC}"
umask 077
SHORELINE_DATA_DIR="$HOME/.local/share/ShorelineOps/data"
SHORELINE_LOGS_DIR="$HOME/.local/share/ShorelineOps/logs"

mkdir -p "$SHORELINE_DATA_DIR"
mkdir -p "$SHORELINE_LOGS_DIR"
echo -e "${GREEN}[OK] Data directory: $SHORELINE_DATA_DIR${NC}"
echo -e "${GREEN}[OK] Logs directory: $SHORELINE_LOGS_DIR${NC}"

# 3. Keep workstation credentials externally provisioned.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "Provision JWT_SECRET and SETUP_BOOTSTRAP_SECRET in the launching account before use."
echo "No repository .env or default account is generated."

# 4. Dependency Installation
echo -e "\n${YELLOW}[4/6] Installing dependencies...${NC}"
npm ci --no-audit --no-fund
echo -e "${GREEN}[OK] Dependencies installed successfully.${NC}"

# 5. Production Compilation
echo -e "\n${YELLOW}[5/6] Building production client and server assets...${NC}"
npm run build:all
echo -e "${GREEN}[OK] Production build completed.${NC}"

# 6. Launch only after explicit credential provisioning and account setup.
echo "Build completed. This does not certify clinical, device, recovery or installer acceptance."
echo "Launch the local workstation with: node launcher.js"
echo "Default URL: http://127.0.0.1:4000/app/login (PORT may select another local port)."
echo "Existing databases are not migrated automatically; verify backup and staging migration first."
echo "For server/systemd deployments, use the reviewed deployment configuration and protected environment separately."
