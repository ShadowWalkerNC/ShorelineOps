# Vercel Production Deployment Guide

ShorelineOps is configured for seamless deployment on Vercel across both the **Interactive Demo Application** (React 18 + Vite SPA) and the **Marketing / Developer Portal** (Astro).

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
       { "source": "/(.*)", "destination": "/index.html" }
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
