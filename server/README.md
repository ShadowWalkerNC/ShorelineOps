# Shoreline API

Node.js + Express + PostgreSQL backend for Shoreline v5.

## Quick Start

```bash
cd server
npm install
cp .env.example .env   # fill in your values
npm run db:migrate     # creates tables
npm run db:seed        # creates admin user
npm run dev            # starts on :3001
```

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Login — may return MFA challenge/enrollment |
| POST | `/api/auth/mfa/verify` | MFA pending | Complete login with TOTP |
| POST | `/api/auth/mfa/setup/begin` | MFA enroll token or JWT | Start TOTP enrollment |
| POST | `/api/auth/mfa/setup/confirm` | MFA enroll token or JWT | Confirm TOTP and enable MFA |
| POST | `/api/auth/mfa/disable` | JWT | Disable MFA with current TOTP |
| POST | `/api/auth/refresh` | None | Rotate refresh token |
| POST | `/api/auth/logout` | None | Revoke refresh token |
| GET  | `/api/auth/me` | JWT | Current user |
| GET | `/api/residents` | JWT | List all residents |
| GET | `/api/residents/:id` | JWT | Get single resident |
| POST | `/api/residents` | JWT (staff+) | Create resident |
| PUT | `/api/residents/:id` | JWT (staff+) | Update resident |
| DELETE | `/api/residents/:id` | JWT (admin) | Delete resident |
| POST | `/api/audit` | JWT | Receive frontend audit events |
| GET | `/api/audit` | JWT (admin) | View audit log |
| GET | `/health` | None | Health check for Render |

## Deploy to Render

1. Create a new **Web Service** pointing to this repo, root dir `server/`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add a **PostgreSQL** database in Render and copy the `DATABASE_URL` into env vars
5. Set required secrets:
   - `JWT_SECRET` (≥32 chars)
   - `FRONTEND_URL`
   - `SETUP_BOOTSTRAP_SECRET` (≥16 chars)
   - `KIOSK_API_SECRET` (≥16 chars) if using the timecard webhook
   - `NODE_ENV=production`
6. After first deploy, run migrations: `npm run db:migrate`
7. Do **not** enable auto-seed in production unless `ALLOW_AUTO_SEED=true` and strong `SEED_ADMIN_*` values are set.
