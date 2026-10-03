# Render Production Deployment Guide

ShorelineOps provides native 1-click multi-service deployment on **[Render](https://render.com)** using the official `render.yaml` Blueprint specification.

---

## 🏗️ Architecture on Render

```
                                  ┌────────────────────────────────┐
                                  │          RENDER CLOUD          │
                                  └───────────────┬────────────────┘
                                                  │
                  ┌───────────────────────────────┼───────────────────────────────┐
                  ▼                               ▼                               ▼
  ┌───────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
  │   1. WEB SERVICE: API         │ │ 2. STATIC: UNIFIED ORIGIN │ │ 3. STATIC: MARKETING ONLY │
  │   Name: shoreline-api         │ │ Name: shoreline-demo      │ │ Name: shoreline-marketing │
  │   Runtime: Node (Express)     │ │ / -> marketing (Astro)    │ │ Framework: Astro          │
  │   Port: 3001                  │ │ /demo/* -> demo shell     │ │ Root: marketing           │
  │   Health: /ready             │ │ /app/* -> app shell       │ │ Publish: dist             │
  └───────────────┬───────────────┘ └───────────────────────────┘ └───────────────────────────┘
                  │
                  ▼
  ┌───────────────────────────────┐
  │   4. MANAGED POSTGRESQL       │
  │   Name: shoreline-db          │
  │   DB: shoreline               │
  └───────────────────────────────┘
```

---

## 🧭 Unified Origin vs. Marketing-Only Service

- **`shoreline-demo` (unified static origin, primary entry point).** Despite its name, this one static service hosts all three shells from a single URL: marketing pages at `/`, the serverless demo sandbox at `/demo/`, and the production app at `/app/`. Scoped rewrites send `/demo` and `/demo/*` to `/demo/index.html` and `/app` and `/app/*` to `/app/index.html`. Marketing files and genuinely unknown paths are left alone (unknown paths return Render's default 404).
- **`shoreline-marketing` (separate marketing-only service).** Builds only `marketing/` and serves just the Astro site from its own URL with independent deploys. Use it when marketing needs its own service; otherwise the unified origin is the only static site visitors need.

---

## 🚀 Option A: 1-Click Blueprint Deployment (Recommended)

1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository: `ShadowWalkerNC/ShorelineOps`.
4. Render will detect the `render.yaml` file and automatically configure all 4 services:
   - `shoreline-api` (Web Service)
   - `shoreline-demo` (Static Site, unified origin: `/` + `/demo` + `/app`)
   - `shoreline-marketing` (Static Site)
   - `shoreline-db` (PostgreSQL Instance)
5. Click **Apply** to provision and build all services in parallel.

---

## 🛠️ Option B: Manual Service Setup on Render

If you prefer provisioning services individually in the Render dashboard:

### 1. Provision PostgreSQL Database
- **Name**: `shoreline-db`
- **Database**: `shoreline`
- **User**: `shoreline_user`
- **Region**: `Oregon (US West)`
- **Plan**: `Free` or `Starter`
- Note down the **Internal Database URL** (`postgres://...`).

### 2. Deploy API Web Service
- **Name**: `shoreline-api`
- **Runtime**: `Node`
- **Root Directory**: `server`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/ready`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `3001`
  - `JWT_SECRET`: *(Generate a secure 32+ character random string)*
  - `DATABASE_URL`: *(Paste Internal Database URL from Step 1)*
  - `FRONTEND_URL`: `https://shoreline-demo.onrender.com`

### 3. Deploy Unified Static Origin (Marketing + Demo + App)
- **Type**: `Static Site`
- **Name**: `shoreline-demo`
- **Build Command**: `npm install && npm run build:demo`
- **Publish Directory**: `dist`
- **Redirects & Rewrites** (one fallback per app shell; no blanket catch-all):
  - Rewrite `/demo` → `/demo/index.html`
  - Rewrite `/demo/*` → `/demo/index.html`
  - Rewrite `/app` → `/app/index.html`
  - Rewrite `/app/*` → `/app/index.html`
- **Environment Variables**:
  - `VITE_DEMO_MODE`: `true` (the unified build overrides this per shell: `true` in `/demo`, `false` in `/app`)
  - `VITE_API_URL`: `https://shoreline-api.onrender.com/api` (used only by `/app`; must end with `/api`). The `/demo` shell is a serverless sandbox and never calls this API.

### 4. Deploy Marketing / Developer Portal (Standalone, Optional)

Standalone marketing-only site with its own URL and deploys. Skip this if the unified origin above is your entry point — it already serves the same marketing pages at `/`.
- **Type**: `Static Site`
- **Name**: `shoreline-marketing`
- **Root Directory**: `marketing`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

---

## 🔧 Troubleshooting Common Render Issues

### 1. `getaddrinfo ENOTFOUND dpg-...`
- **Cause**: The API container tried connecting to PostgreSQL before the database finished provisioning or the internal hostname was resolving.
- **Resolution**: ShorelineOps v6+ includes automated retry logic and non-fatal fallback. The API will retry 5 times and fall back to local offline storage if DNS resolution fails, keeping your web service healthy while the database boots.

### 2. Client-Side Page Refresh Serves the Wrong Shell (or 404s)
- **Cause**: Each app shell (`/demo`, `/app`) needs its own `index.html` fallback. A blanket catch-all rewrite serves the marketing homepage for deep links such as `/demo/reporting`; missing rules 404 instead.
- **Resolution**: `render.yaml` defines four scoped rewrites on `shoreline-demo`: `/demo` and `/demo/*` → `/demo/index.html`, `/app` and `/app/*` → `/app/index.html`. Render serves real files first, so static assets and marketing pages are never rewritten.

### 3. CORS Error Between Demo and API
- **Cause**: Browser blocks cross-origin requests from `https://shoreline-demo.onrender.com` to `https://shoreline-api.onrender.com`.
- **Resolution**: Ensure `FRONTEND_URL` environment variable on `shoreline-api` matches your demo domain.

---

## 📊 Environment Variable Reference

| Service | Variable Name | Required | Default / Description |
|---|---|---|---|
| **shoreline-api** | `DATABASE_URL` | Yes (Prod) | PostgreSQL connection string (`postgres://...`). |
| **shoreline-api** | `JWT_SECRET` | Yes | 32+ char secret for JWT authentication signing. |
| **shoreline-api** | `PORT` | No | Defaults to `3001`. |
| **shoreline-api** | `NODE_ENV` | Yes | `production` |
| **shoreline-api** | `FRONTEND_URL` | No | CORS allowed origin for client web apps. |
| **shoreline-demo** | `VITE_DEMO_MODE` | No | Baked per shell by the unified build (`true` in `/demo`, `false` in `/app`). |
| **shoreline-demo** | `VITE_API_URL` | No | Full API base for the `/app` bundle only; must end with `/api` (the Axios client and tokenManager append `/auth/*`). The `/demo` shell never calls it. |
