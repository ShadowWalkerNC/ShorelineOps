#!/usr/bin/env bash
# ==============================================================================
# Shoreline Care OS — Turnkey Unix/Linux/macOS Deployment Engine
# Healthcare Dietary Operations & Clinical Nutrition Platform (v5.0.0)
# ==============================================================================

set -e

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
    echo "Please install Node.js 20+ LTS via: https://nodejs.org or run:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    exit 1
fi

NODE_VER=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo "$NODE_VER" | cut -d'.' -f1)

if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${RED}[ERROR] Node.js v$NODE_VER detected. Shoreline Care OS requires Node.js v20.0.0 or later.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Node.js v$NODE_VER detected.${NC}"

# 2. Local Data Directory Provisioning
echo -e "\n${YELLOW}[2/6] Provisioning persistent data storage...${NC}"
SHORELINE_DATA_DIR="$HOME/.shoreline/data"
SHORELINE_LOGS_DIR="$HOME/.shoreline/logs"

mkdir -p "$SHORELINE_DATA_DIR"
mkdir -p "$SHORELINE_LOGS_DIR"
echo -e "${GREEN}[OK] Data directory: $SHORELINE_DATA_DIR${NC}"
echo -e "${GREEN}[OK] Logs directory: $SHORELINE_LOGS_DIR${NC}"

# 3. Environment File Configuration (.env)
echo -e "\n${YELLOW}[3/6] Configuring environment settings...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
    echo "Generating new production .env from .env.example..."
    cp .env.example .env
    
    # Generate random 32-byte hex string for JWT_SECRET
    RANDOM_JWT=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # Replace default JWT_SECRET with cryptographic key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$RANDOM_JWT/" .env
        sed -i '' "s/NODE_ENV=development/NODE_ENV=production/" .env
    else
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$RANDOM_JWT/" .env
        sed -i "s/NODE_ENV=development/NODE_ENV=production/" .env
    fi
    echo -e "${GREEN}[OK] Created .env with freshly generated cryptographic JWT secret.${NC}"
else
    echo -e "${GREEN}[OK] Existing .env file detected.${NC}"
fi

# 4. Dependency Installation
echo -e "\n${YELLOW}[4/6] Installing dependencies...${NC}"
npm install --no-audit --no-fund
npm --prefix server install --no-audit --no-fund
echo -e "${GREEN}[OK] Dependencies installed successfully.${NC}"

# 5. Production Compilation
echo -e "\n${YELLOW}[5/6] Building production client and server assets...${NC}"
npm run build:all
echo -e "${GREEN}[OK] Production build completed.${NC}"

# 6. Service Integration (systemd helper for Linux)
echo -e "\n${YELLOW}[6/6] Finalizing setup...${NC}"

if command -v systemctl >/dev/null 2>&1 && [ -w /etc/systemd/system ]; then
    SERVICE_FILE="/etc/systemd/system/shoreline.service"
    CURRENT_USER=$(whoami)
    NODE_PATH=$(command -v node)
    
    cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Shoreline Care OS Healthcare Dietary Platform
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_PATH $SCRIPT_DIR/server/dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
EnvironmentFile=$SCRIPT_DIR/.env

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    echo -e "${GREEN}[OK] Installed systemd service: /etc/systemd/system/shoreline.service${NC}"
    echo "To enable automatic boot startup: sudo systemctl enable --now shoreline"
fi

echo -e "\n${CYAN}======================================================================${NC}"
echo -e "${GREEN}  SHORELINE CARE OS INSTALLED AND READY FOR USE!${NC}"
echo -e "${CYAN}======================================================================${NC}"
echo -e "To start Shoreline Care OS immediately:"
echo -e "  ${YELLOW}node launcher.js${NC}   (or: ${YELLOW}npm start${NC})"
echo -e "\nAccess the workstation UI in your browser:"
echo -e "  ${GREEN}http://localhost:3001${NC}"
echo -e "\nDefault Admin Account (Demo Sandbox):"
echo -e "  Username: ${YELLOW}admin${NC}"
echo -e "  Password: ${YELLOW}admin123${NC}"
echo -e "${CYAN}======================================================================${NC}\n"
