# Railway deployment

ShorelineOps deploys as one public web service plus PostgreSQL. The Express service serves every browser surface from one origin:

| Path | Purpose | Authentication |
| --- | --- | --- |
| `/` | Astro marketing site | Public |
| `/demo/` | Seeded browser-only product demo | Public, automatic demo session |
| `/app/` | Live facility application | Login required |
| `/api/` | Express API used by `/app/` | JWT except documented setup/health routes |
| `/ready` | Database and migration readiness | Public probe |

The frontend intentionally uses the same-origin `/api` path. Do not set `VITE_API_URL` for the unified service. A separate API hostname is only needed when the frontend is deployed independently; in that case, set `VITE_API_URL` to the full API URL and add the frontend origin to `FRONTEND_URL`.

## Railway services

The required production services are:

1. `shoreline-api`, built from the repository root with the root `Dockerfile`.
2. `shoreline-db`, a managed PostgreSQL service referenced by `DATABASE_URL`.

Older `shoreline-demo` and `shoreline-marketing` services are compatibility deployments. They can remain temporarily, but the canonical public URLs are the paths on `shoreline-api`. Remove the duplicate services after DNS and bookmarks have moved to the unified URL.

## Required production variables

Set these on `shoreline-api`:

- `NODE_ENV=production`
- `DATABASE_URL=${{shoreline-db.DATABASE_URL}}` (use Railway's reference picker)
- `JWT_SECRET` with at least 32 random characters
- `SETUP_BOOTSTRAP_SECRET` with at least 16 random characters for first-time owner creation
- `FRONTEND_URL` to the public service origin (comma-separated when custom domains are added)

On a fresh database, open `/app/login`. The application checks `/api/setup/status` and sends you to `/app/setup` until the first facility owner exists. Enter the exact `SETUP_BOOTSTRAP_SECRET`, choose a unique admin email and password, and complete setup. Demo credentials are never accepted by the production app.

## Deployment checks

Railway should use `/ready` as the health check for `shoreline-api`. The service does not accept API traffic until all migrations and the schema integrity check pass. A configured PostgreSQL migration failure terminates startup so Railway cannot mark a broken database deployment healthy.