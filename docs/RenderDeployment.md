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
  │   1. WEB SERVICE: API         │ │ 2. STATIC SITE: DEMO SPA  │ │ 3. STATIC SITE: MARKETING │
  │   Name: shoreline-api         │ │ Name: shoreline-demo      │ │ Name: shoreline-marketing │
  │   Runtime: Node (Express)     │ │ Framework: Vite + React   │ │ Framework: Astro          │
  │   Port: 3001                  │ │ Publish: dist             │ │ Root: marketing           │
  │   Health: /health             │ │ Rewrite: /* -> /index.html│ │ Publish: dist             │
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

## 🚀 Option A: 1-Click Blueprint Deployment (Recommended)

1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository: `ShadowWalkerNC/ShorelineOps`.
4. Render will detect the `render.yaml` file and automatically configure all 4 services:
   - `shoreline-api` (Web Service)
   - `shoreline-demo` (Static Site)
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
- **Health Check Path**: `/health`
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `PORT`: `3001`
  - `JWT_SECRET`: *(Generate a secure 32+ character random string)*
  - `DATABASE_URL`: *(Paste Internal Database URL from Step 1)*
  - `FRONTEND_URL`: `https://shoreline-demo.onrender.com`

### 3. Deploy Interactive Demo App (SPA)
- **Type**: `Static Site`
- **Name**: `shoreline-demo`
- **Build Command**: `npm install && npm run build:demo`
- **Publish Directory**: `dist`
- **Redirects & Rewrites**:
  - **Type**: `Rewrite`
  - **Source**: `/*`
  - **Destination**: `/index.html`
- **Environment Variables**:
  - `VITE_DEMO_MODE`: `true`
  - `VITE_API_URL`: `https://shoreline-api.onrender.com`

### 4. Deploy Marketing / Developer Portal
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

### 2. Client-Side Page Refresh Returns 404
- **Cause**: Single Page Application (SPA) routes require index.html fallback routing.
- **Resolution**: Ensured by the `routes` rewrite in `render.yaml` (`source: /*`, `destination: /index.html`).

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
| **shoreline-demo** | `VITE_DEMO_MODE` | No | Set `true` to enable instant pre-seeded accounts. |
| **shoreline-demo** | `VITE_API_URL` | No | URL of the backend API service. |
