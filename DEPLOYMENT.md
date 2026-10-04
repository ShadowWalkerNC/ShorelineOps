# 🚀 ShorelineOps Production Deployment & Operations Runbook

## Current entry points and design adoption — October 4, 2026

See [the URL contract](docs/URLS.md) and [Stitch design adoption](docs/design/STITCH_ADOPTION_2026-10-04.md). Marketing uses `/`, the public sandbox `/demo/`, and real application sign-in `/app/login`. Build-time `PUBLIC_SITE_URL` controls canonical metadata. Separate marketing hosts must set absolute `PUBLIC_DEMO_URL` and `PUBLIC_APP_URL`; unified deployments use relative paths. Local verification does not establish the deployed release.

This guide covers deployment options, production configuration, database management, security hardening, and operational runbooks for **ShorelineOps**.

---

## 1. Local Facility Workstation & Kitchen Kiosk (Offline-First Standalone)

The most popular option for individual senior living communities, dietary kitchens, and clinical care facilities. Runs entirely offline on standard Windows, Mac, or Linux workstations without requiring Docker or cloud infrastructure.

### Instant Workstation Startup

1. **Windows**: Double-click `start.bat` or run:
   ```cmd
   start.bat
   ```
   - **Fast Startup (<2s)**: Reuses pre-compiled production bundles (`dist/index.html` and `server/dist/index.js`).
   - **Force Rebuild**: Pass `start.bat --rebuild` to trigger a clean compile of client and server assets.
   - **Automatic Browser Launch**: Automatically opens your default browser to `http://localhost:3001/`.

2. **Linux / macOS**: Run:
   ```bash
   ./start.sh
   # Or to force a clean recompile:
   ./start.sh --rebuild
   ```

3. **1-Click Desktop Shortcut Setup (Windows)**:
   - Run `Setup.bat` to provision a desktop shortcut `"Shoreline Care OS"`, start menu entry, and initialize the local database.
   - Launches via `ShorelineOps-Launcher.bat`.

### Default Production Credentials

- **Super-Admin Login**: `admin@shorelineops.local`
- **Password**: `ComplexAdminPass2026!`
- **Database File**: `server/shoreline.db` (override via `SQLITE_PATH` in `.env`)
- **API Health Check**: `http://localhost:3001/health`
- **Kitchen Tablet Kiosk**: `http://localhost:3001/app/kitchen/tablet`

---

## 2. Production Docker & Container Deployment

ShorelineOps uses an enterprise-grade multi-stage container build based on Debian Bookworm (**`node:22-slim`**), providing full `glibc` compatibility for native addons (`sqlite3`) and HIPAA security isolation (`USER node`).

### Convenience NPM Scripts

- **Build Production Image**:
  ```bash
  npm run docker:build
  ```
- **Run Container with Environment File**:
  ```bash
  npm run docker:run
  ```
- **Interactive Container Shell (Debugging)**:
  ```bash
  npm run docker:shell
  ```

### Production Docker Compose Stack

The stack includes PostgreSQL 16, backend API, and an optional NGINX reverse proxy (disabled by default — enable with `docker compose --profile proxy up`; HTTP-only, no tested TLS setup).

#### Deployment Steps

1. **Configure production environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set a secure `JWT_SECRET` (minimum 32 hex bytes) and `SEED_ADMIN_PASSWORD`.

2. **Start the containers in background**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify container health & readiness**:
   ```bash
   docker compose ps
   curl -i http://localhost:3001/health
   curl -i http://localhost:3001/ready
   ```

---

#### External managed database (override file)

A host `DATABASE_URL` export alone is ignored: the production Compose file constructs the api `DATABASE_URL` from `DB_USER`/`DB_PASSWORD`/`DB_NAME`. To use an external database, create `docker-compose.external-db.yml` with an api `DATABASE_URL` entry, then start with `docker compose -f docker-compose.production.yml -f docker-compose.external-db.yml up -d --no-deps api` (`--no-deps` is required: plain `up api` still starts the bundled postgres via the api `depends_on`. Base-file `${DB_*:?...}` interpolation runs before the override merges, so `DB_USER`/`DB_PASSWORD`/`DB_NAME` must still be exported even though the override replaces `DATABASE_URL` — dummy values are fine for the unused bundled service. Remote TLS verifies certificates by default).

---

## 3. Cloud Platform Deployment (Railway / Render / Fly.io)

### Railway
1. Create a new project on [Railway.app](https://railway.app).
2. Provision a **PostgreSQL** database service.
3. Deploy the repository using the root `Dockerfile`.
4. Set the following environment variables in Railway:
   - `NODE_ENV`: `production`
   - `PORT`: `3001`
   - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET`: *(your generated 32+ character hex string)*
   - `SEED_ADMIN_EMAIL`: `admin@yourcommunity.org`
   - `SEED_ADMIN_PASSWORD`: *(12+ character complex password)*
   - Only if the managed database provably fails certificate verification: `DATABASE_SSL_REJECT_UNAUTHORIZED`: `false` (explicit unverified TLS; remote connections verify certificates by default).
5. Set the health check to `/ready` (readiness), not `/health` (liveness).

### Render
1. Create a **Web Service** pointing to the GitHub repository.
2. Select **Docker** as the runtime environment.
3. Provision a **PostgreSQL** database on Render.
4. Link `DATABASE_URL` and configure `JWT_SECRET`.
5. Set Health Check Path to `/ready`.

---

## 4. Bare-Metal / Ubuntu Linux VM (Systemd + Nginx + PostgreSQL)

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
# Local plaintext requires explicit ?sslmode=disable; remote databases must use verified TLS (default).
Environment=DATABASE_URL=postgresql://shoreline:your_secure_password@localhost:5432/shorelineops?sslmode=disable
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

## 5. Operational Health Probes & Monitoring

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

## 6. Automated Database Backups

Use the maintained scripts (`scripts/backup.sh` on Linux/macOS,
`scripts/backup.ps1` on Windows) rather than a hand-rolled `pg_dump | gzip`
pipeline. Both scripts write to a temp file first and publish only when the
dump exit code is 0 and the output validates as non-empty (the raw dump is
validated before compression, since empty input still produces non-empty
gzip); rotation (30-day retention) runs only after a successful publish and
is skipped on failure.

```bash
DB_USER=$DB_USER DB_NAME=$DB_NAME BACKUP_DIR=/var/backups/shorelineops ./scripts/backup.sh
```

```powershell
.\scripts\backup.ps1 -BackupDir C:\backups\shorelineops -DbUser $env:DB_USER -DbName $env:DB_NAME
```

`backup.sh` requires explicit `DB_USER`/`DB_NAME` matching the deployment's Compose-required values (`DB_USER`/`DB_NAME` for production, `POSTGRES_USER`/`POSTGRES_DB` for local) for the container dump path (no stale defaults); the `DATABASE_URL` fallback (used only when the database container is not running) runs without `DB_USER`/`DB_NAME`.

`backup.ps1` requires explicit `-DbUser`/`-DbName` matching the deployment's Compose-required values (`DB_USER`/`DB_NAME` for production, `POSTGRES_USER`/`POSTGRES_DB` for local); it ships no stale defaults and rejects shell metacharacters (quotes, `%`, `&`, etc.) before running.

> **Pending acceptance gate:** backup output is currently a plaintext dump.
> Encryption at rest and an isolated restore drill are still open (see
> `docs/audits/DEPLOYMENT_IMPLEMENTATION_2026-10-01.md`. Store artifacts
> accordingly and do not claim otherwise.

---

## 7. Security Checklist for Senior Living & HIPAA Alignment

- [x] **Enforce HTTPS / TLS 1.3**: All traffic encrypted in transit.
- [x] **Set Cryptographic JWT Secret**: Minimum 32 bytes random string.
- [x] **10-Minute Inactive Auto-Logout**: Protected via client session timer.
- [x] **Immutable Audit Triggers**: Database triggers prevent modification/deletion of audit records.
- [x] **Vendor Role Isolation**: Food distributor accounts cannot access resident PHI.
- [x] **Database Isolation**: PostgreSQL running in isolated VPC / Docker network with strict password authentication.
