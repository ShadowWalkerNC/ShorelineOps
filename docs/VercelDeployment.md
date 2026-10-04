# Vercel Production Deployment Guide

ShorelineOps is configured for seamless deployment on Vercel across both the **Interactive Demo Application** (React 18 + Vite SPA) and the **Marketing / Developer Portal** (Astro).

## Unified static hosting (root `vercel.json`)

The root project builds one `dist/` tree (`node scripts/build_unified_site.mjs`):
marketing at `/`, the demo SPA at `/demo`, the gatekept app SPA at `/app`.
Routing rules:

| Request | Served |
|---|---|
| `/`, `/pricing`, `/story`, … | Marketing files from `dist/` (filesystem) |
| `/demo`, `/demo/*` | `dist/demo/index.html` (SPA shell, deep links included) |
| `/app`, `/app/*` | `dist/app/index.html` (SPA shell, deep links included) |
| Existing files (`/demo/assets/*`, `/app/assets/*`, `/_astro/*`, images) | The file itself — filesystem takes precedence over rewrites (same as the canonical Vite SPA config) |
| `/api/*` | Vercel native 404 — there is intentionally no `/api` rewrite, so API calls on static hosting fail honestly instead of receiving marketing HTML |

The Express server (`server/src/index.ts`, via `server/src/shellRouting.ts`)
mirrors this: distinct shells per prefix, honest 503 for a missing shell
bundle, honest 404 for a missing asset, and `/api`/`/health`/`/ready`
passthrough. Covered by `server/src/static-routing.test.ts` with synthetic
temp bundles.

The two-project layout below is a legacy alternative; prefer the unified root
project unless the projects must deploy independently.

---

## 1. Project Overview & Architecture on Vercel

```
                      +-----------------------------------------------+
                      |                 VERCEL EDGE                   |
                      +-------+-------------------------------+-------+
                              |                               |
                              v                               v
       +-------------------------------+     +--------------------------------+
       |   PROJECT 1: DEMO APP (SPA)   |     | PROJECT 2: MARKETING (ASTRO)   |
       |   Root Directory: /           |     | Root Directory: marketing      |
       |   Build: npm run build:demo   |     | Build: npm run build           |
       |   Output: dist                |     | Output: dist                   |
       |   Domain: demo.shorelineops.com|    | Domain: shorelineops.com       |
       +-------------------------------+     +--------------------------------+
```

---

## 2. Deploying the Demo Application (React / Vite SPA)

1. **Import Repository** into Vercel.
2. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `.` (Root)
   - **Build Command**: `npm run build:demo`
   - **Output Directory**: `dist`
3. **SPA Routing**: Handled automatically by root `vercel.json`:
   ```json
   {
     "framework": "vite",
     "buildCommand": "npm run build:demo",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/demo", "destination": "/demo/index.html" },
       { "source": "/demo/:path*", "destination": "/demo/index.html" },
       { "source": "/app", "destination": "/app/index.html" },
       { "source": "/app/:path*", "destination": "/app/index.html" }
     ]
   }
   ```

---

## 3. Deploying the Marketing Site (Astro)

1. In Vercel, create a **New Project** pointing to the same GitHub repository.
2. Configure Project Settings:
   - **Framework Preset**: `Astro`
   - **Root Directory**: `marketing`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Handled automatically by `marketing/vercel.json`.

---

## 4. Environment Variables Checklist

| Variable Name | Required | Target Project | Description |
|---|---|---|---|
| `VITE_DEMO_MODE` | Yes (Demo) | Demo App | Set to `true` to enable pre-seeded evaluation credentials. |
| `VITE_API_URL` | Optional | Demo App | External Express API endpoint URL (if not using local mock). |
| `DATABASE_URL` | Production | API Server | PostgreSQL connection string for production database. |
| `JWT_SECRET` | Production | API Server | Cryptographic key for session token signing. |
