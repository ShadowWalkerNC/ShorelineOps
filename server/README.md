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
| POST | `/api/auth/login` | None | Login, returns JWT + refresh token |
| POST | `/api/auth/refresh` | None | Rotate refresh token |
| POST | `/api/auth/logout` | None | Revoke refresh token |
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
5. Set `JWT_SECRET`, `FRONTEND_URL`, `NODE_ENV=production`
6. After first deploy, run migrations: `npm run db:migrate`
