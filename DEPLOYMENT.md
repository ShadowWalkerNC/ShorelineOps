# 🚀 ShorelineOps Production Deployment & Operations Runbook

This guide covers deployment options, production configuration, database management, security hardening, and operational runbooks for **ShorelineOps**.

---

## 1. Quick Start: Production Docker Compose

The simplest and most resilient way to run ShorelineOps on any VPS, dedicated server, or local facility server.

### Prerequisites
- Docker Engine $\ge 24.0$ & Docker Compose $\ge 2.20$
- A domain name or local IP address pointing to your host

### Deployment Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
   cd ShorelineOps
   ```

2. **Configure production environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set a secure `JWT_SECRET` and `SEED_ADMIN_PASSWORD`:
   ```bash
   # Generate a 32-byte cryptographically secure random secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Start the containers in background**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify container health**:
   ```bash
   docker compose ps
   curl -i http://localhost:3001/health
   curl -i http://localhost:3001/ready
   ```

---

## 2. Cloud Platform Deployment (Railway / Render / Fly.io)

### Railway
1. Create a new project on [Railway.app](https://railway.app).
2. Provision a **PostgreSQL** database service.
3. Deploy the repository using the root `Dockerfile`.
4. Set the following environment variables in Railway:
   - `NODE_ENV`: `production`
   - `PORT`: `3001`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `DATABASE_SSL_REJECT_UNAUTHORIZED`: `false` (for managed DB certificates)
   - `JWT_SECRET`: *(your generated 32+ character hex string)*
   - `SEED_ADMIN_EMAIL`: `admin@yourcommunity.org`
   - `SEED_ADMIN_PASSWORD`: *(12+ character complex password)*

### Render
1. Create a **Web Service** pointing to the GitHub repository.
2. Select **Docker** as the runtime environment.
3. Provision a **PostgreSQL** database on Render.
4. Link `DATABASE_URL` and configure `JWT_SECRET`.
5. Set Health Check Path to `/health`.

---

## 3. Bare-Metal / Ubuntu Linux VM (Systemd + Nginx + PostgreSQL)

### Step 1: Install PostgreSQL 16
```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib nginx curl git
sudo -u postgres psql -c "CREATE USER shoreline WITH PASSWORD 'your_secure_password';"
sudo -u postgres psql -c "CREATE DATABASE shorelineops OWNER shoreline;"
```

### Step 2: Build Application
```bash
cd /var/www/shorelineops
npm ci
npm run build
cd server
npm ci
npm run build
```

### Step 3: Configure Systemd Service (`/etc/systemd/system/shorelineops.service`)
```ini
[Unit]
Description=ShorelineOps Dietary API & Web Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/shorelineops/server
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DATABASE_URL=postgresql://shoreline:your_secure_password@localhost:5432/shorelineops
Environment=JWT_SECRET=your_32_character_jwt_secret_here
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable shorelineops
sudo systemctl start shorelineops
```

### Step 4: Configure Nginx Reverse Proxy with HTTPS (`/etc/nginx/sites-available/shorelineops`)
```nginx
server {
    server_name dietary.yourcommunity.org;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Obtain free SSL via Let's Encrypt:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dietary.yourcommunity.org
```

---

## 4. Operational Health Probes & Monitoring

ShorelineOps exposes two dedicated health endpoints:

### Liveness Probe (`GET /health`)
- **Purpose**: Checks if the Node.js process is active and accepting requests.
- **Response**: `200 OK`
```json
{
  "status": "ok",
  "service": "ShorelineOps API",
  "version": "6.0.0",
  "uptimeSeconds": 1420,
  "timestamp": "2026-08-23T19:48:00.000Z"
}
```

### Readiness Probe (`GET /ready`)
- **Purpose**: Verifies that the PostgreSQL database connection pool is active and ready to process transactions.
- **Response**: `200 OK` or `503 Service Unavailable`
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-08-23T19:48:00.000Z"
}
```

---

## 5. Automated Database Backups

### Linux Cron Backup Script (`scripts/backup.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/shorelineops"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "[Backup] Creating PostgreSQL snapshot..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/shorelineops_$TIMESTAMP.sql.gz"

# Retain 30 days of backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -delete
echo "[Backup] Complete: $BACKUP_DIR/shorelineops_$TIMESTAMP.sql.gz"
```

---

## 6. Security Checklist for Senior Living & HIPAA Alignment

- [x] **Enforce HTTPS / TLS 1.3**: All traffic encrypted in transit.
- [x] **Set Cryptographic JWT Secret**: Minimum 32 bytes random string.
- [x] **10-Minute Inactive Auto-Logout**: Protected via client session timer.
- [x] **Immutable Audit Triggers**: Database triggers prevent modification/deletion of audit records.
- [x] **Vendor Role Isolation**: Food distributor accounts cannot access resident PHI.
- [x] **Database Isolation**: PostgreSQL running in isolated VPC / Docker network with strict password authentication.
