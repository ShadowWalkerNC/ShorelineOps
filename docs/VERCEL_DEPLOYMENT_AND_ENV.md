# Vercel Deployment & Environment Configuration Guide

This guide details the exact environment variables and project configurations needed to deploy **Shoreline Care OS** (SaaS App + Marketing Website) on **Vercel** with upcoming **Supabase** backend support.

---

## 1. Project Architecture on Vercel

Shoreline Care OS is structured as an npm monorepo with two frontend applications:

| Component | Directory | Framework | Vercel Deployment Purpose |
|---|---|---|---|
| **Care OS SaaS App** | `./` (Root) | React 18 + Vite | Primary clinical & culinary operations application |
| **Marketing Website** | `marketing/` | Astro + Tailwind | Public landing pages, pricing calculator, distributor guide |
| **API Backend** | `server/` | Express + Node.js | Microservices, database pool, hardware telemetry (can be hosted on Render/Railway/Fly or serverless) |

---

## 2. Vercel Environment Variables Matrix

### A. SaaS Web Application (Vite Frontend)

Add these in **Vercel Dashboard $\rightarrow$ Project Settings $\rightarrow$ Environment Variables**:

| Variable Name | Example Value | Description |
|---|---|---|
| `VITE_API_URL` | `https://api.shorelineops.com/api` | The base URL of your live API server. |
| `VITE_DEMO_MODE` | `false` | Set to `false` for live customer accounts; `true` for a pre-seeded evaluation demo. |
| `VITE_SUPABASE_URL` | `https://[ref].supabase.co` | Your Supabase project URL (Project Settings $\rightarrow$ API). |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Supabase public anonymous key. Safe for browser exposure. |
| `VITE_SHORELINE_LICENSE_KEY` | `SH_ENT_...` | SaaS cryptographic license key for Pro/Enterprise features. |
| `VITE_SESSION_TIMEOUT_MS` | `900000` | Inactivity logout threshold (900,000ms = 15 mins for HIPAA compliance). |

> [!TIP]
> **Vercel Build Settings for SaaS App:**
> - **Root Directory:** `./` (empty / project root)
> - **Framework Preset:** `Vite`
> - **Build Command:** `npm run build:demo`
> - **Output Directory:** `dist`

---

### B. Marketing Website (Astro)

If you deploy the `marketing/` folder as a separate Vercel project (or preview domain):

| Variable Name | Example Value | Description |
|---|---|---|
| `PUBLIC_DEMO_URL` | `https://app.shorelineops.com` | Destination URL when visitors click "Try Interactive Demo" or "Launch". |
| `PUBLIC_APP_URL` | `https://app.shorelineops.com` | Destination URL for the "Sign In" button in the navigation header. |
| `PUBLIC_SUPABASE_URL` | `https://[ref].supabase.co` | (Optional) If you collect marketing waitlists or contact forms directly into Supabase. |
| `PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | (Optional) Supabase anonymous key for marketing lead capture. |

> [!TIP]
> **Vercel Build Settings for Marketing Website:**
> - **Root Directory:** `marketing`
> - **Framework Preset:** `Astro`
> - **Build Command:** `npm run build`
> - **Output Directory:** `dist`

---

### C. Backend API Server & Supabase Database

If hosting the backend API server (`server/`):

| Variable Name | Example Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security, rate limiting, and cache policies. |
| `PORT` | `3001` | Server port (assigned automatically by cloud hosts). |
| `JWT_SECRET` | `64-char-hex-string` | Cryptographic secret for signing bearer JWTs. Min 32 characters. |
| `FRONTEND_URL` | `https://app.shorelineops.com` | Allowed CORS origin for browser requests. |
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres` | Supabase PostgreSQL connection string. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` | Required `false` for Supabase managed connection poolers. |
| `SUPABASE_URL` | `https://[ref].supabase.co` | Supabase API endpoint. |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | Supabase service-role secret. **Never expose this to the frontend!** |
| `SETUP_BOOTSTRAP_SECRET` | `your-facility-secret` | Passphrase required to initialize the initial Super Admin account. |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Stripe secret key for enterprise tier subscription checkouts. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook signing secret for real-time license updates. |

---

## 3. How to Connect Supabase

When you are ready to connect Supabase:

1. **Create a Supabase Project:**
   - Go to [database.new](https://database.new) and create a project.
2. **Retrieve Credentials:**
   - Go to **Project Settings $\rightarrow$ API**:
     - Copy **Project URL** $\rightarrow$ Set as `VITE_SUPABASE_URL`.
     - Copy **anon public** key $\rightarrow$ Set as `VITE_SUPABASE_ANON_KEY`.
     - Copy **service_role secret** $\rightarrow$ Set as `SUPABASE_SERVICE_ROLE_KEY` (server only).
   - Go to **Project Settings $\rightarrow$ Database**:
     - Copy the **URI connection string** $\rightarrow$ Set as `DATABASE_URL`.
     - Set `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.
3. **Run Initial Database Migration:**
   - Point your local shell to Supabase and execute the automated schema migrations:
   ```bash
   DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" npm run db:migrate
   ```
   This automatically provisions all 45 tables (census, diet orders, cycle menus, HACCP logs, split MRP, and immutable audit logs) into your Supabase database.
