# Deployment and environment configuration

The active managed deployment uses Railway services and Railway PostgreSQL. This file keeps its historical name so existing links do not break.

## Supported data architecture

The React application calls the Express API. The Express API is the only production component that connects to PostgreSQL through `DATABASE_URL`. Browser Supabase keys are neither required nor supported. The old Supabase schema under `docs/archive/schema-legacy/` is reference material and must not be executed.

Supabase may be used only as a PostgreSQL hosting provider if its standard PostgreSQL connection string is supplied as `DATABASE_URL`. That does not enable direct Supabase browser access, Supabase Auth, or a second schema path.

## Railway service layout

| Service | Build | Start | Health |
|---|---|---|---|
| API and SaaS app | `npm install && npm run build` | `npm start` | `/ready` |
| Public demo | `npm install && npx vite build --base=/` | `npm run preview:demo -- --host 0.0.0.0 --port $PORT` | `/` |
| Marketing | `npm install && npm run build:marketing` | `npm --prefix marketing run preview -- --host 0.0.0.0 --port $PORT` | `/` |
| PostgreSQL | Railway managed PostgreSQL | managed | provider health |

## Required API variables

| Variable | Requirement |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Unique random value of at least 32 characters |
| `FRONTEND_URL` | Comma-separated approved browser origins |
| `PLATFORM_OWNER_EMAIL` | Existing user promoted to ShorelineOps platform owner at boot |
| `LICENSE_SIGNING_SECRET` | HMAC secret for signed commercial entitlements; at least 32 characters |
| `SETUP_BOOTSTRAP_SECRET` | Bootstrap only; remove or rotate after initialization |

Set `DATABASE_SSL_REJECT_UNAUTHORIZED=true` when the database provider supplies a trusted certificate chain. If a provider requires a custom CA, install that CA rather than silently disabling certificate verification.

## Browser and marketing variables

The unified API deployment uses `VITE_API_URL=/api` and `VITE_DEMO_MODE=false`. The public demo is built with demo mode enabled by the build script. Marketing uses `PUBLIC_DEMO_URL` and `PUBLIC_APP_URL` for its two destinations.

## Optional integrations

`EHR_WEBHOOK_SECRET`, the PCC credential set, `STRIPE_WEBHOOK_SECRET`, `USDA_FDC_API_KEY`, and kiosk/AOD variables are optional. Each missing credential means that integration is disabled. It must not be described as live until its provider sandbox, failure handling, and reconciliation tests pass.

## Release gate

Before deployment, run:

```bash
npm run build:demo
npm run build:marketing
npm test
npm audit
```

After deployment, require `/ready` to report a connected database, verify public marketing and demo routes without authentication, verify login and the admin diagnostics endpoint, and complete a backup restore drill in an isolated database before storing production PHI.
