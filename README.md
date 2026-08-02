# ShorelineOps

**Shoreline Operations Platform** — A secure, HIPAA/SOC 2-ready internal care coordination and facility operations management platform.

> **Status:** Production-ready template with Setup Wizard, Express API backend, PostgreSQL database, and zero-dependency Demo Mode.

---

## 🚀 Quick Start & Deployment Modes

ShorelineOps supports **two operational modes**:

### Mode 1: First-Time Setup Wizard (Self-Hosted / Enterprise Deployment)

When deploying a new instance (e.g. for a new facility or client fork):

1. **Start Backend & Database**:
   ```bash
   cd server
   npm install
   npm run dev   # Starts Express API on http://localhost:3001 & runs migrations
   ```
2. **Start Frontend**:
   ```bash
   npm install
   npm run dev   # Starts Vite on http://localhost:5173
   ```
3. **Run Setup**:
   - Open `http://localhost:5173/setup` in your browser.
   - Complete the **6-step Onboarding & Setup Wizard**:
     - Step 1: Facility Information & Type
     - Step 2: Wing & Dining Room Configuration
     - Step 3: Super Admin Account Creation
     - Step 4: Business Associate Agreement (BAA) Sign-off
     - Step 5: Mode Selection (Clean vs Sample Data)
     - Step 6: Initialization & System Lock
   - Once initialized, your facility instance is locked and ready for immediate operational use.

### Mode 2: Interactive Self-Contained Demo Mode

If you are evaluating or demonstrating the platform without setting up a backend/database:

1. **Launch App**: `npm run dev`
2. **Login Screen**: Click any of the pre-configured demo credentials on the login screen (`admin@shoreline.demo`, `manager@shoreline.demo`, `dietary@shoreline.demo`, etc.).
3. **Explore**: Experience full UI functionality with sample data.

---

## 🔒 Security & Compliance (HIPAA & SOC 2)

ShorelineOps includes built-in technical safeguards:

- **10-Minute Idle Session Termination**: Client-side activity tracking auto-logs out inactive sessions ([AuthContext.tsx](file:///c:/Users/white/OneDrive/Documents/GitHub/ShorelineOps/src/security/AuthContext.tsx)).
- **Password Hardening**: Minimum 12 characters requiring uppercase, lowercase, numbers, and special symbols.
- **Append-Only Audit Logging**: PostgreSQL database triggers (`trg_prevent_audit_log_update` and `trg_prevent_audit_log_delete`) prevent `UPDATE` or `DELETE` on `audit_log` records to guarantee non-repudiation.
- **HTTP Security Headers**: Strict CSP, HSTS preload, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` applied via Helmet in [index.ts](file:///c:/Users/white/OneDrive/Documents/GitHub/ShorelineOps/server/src/index.ts).
- **Timecard Protection**: Authentication & secret key verification enforced on all timecard punch and query endpoints.

---

## 📁 Repository Structure

```
ShorelineOps/
├── server/                    # Node.js / Express API Backend
│   ├── src/
│   │   ├── db/                # PostgreSQL Pool & Migration Scripts
│   │   ├── middleware/        # Auth (JWT), RBAC & Security Middlewares
│   │   ├── routes/            # Residents, Menu, Production, Timecard, Setup, Auth
│   │   ├── compliance.test.ts # Compliance Test Suite
│   │   └── index.ts           # Server Entry Point & Helmet Security Setup
├── src/                       # React 18 + Vite Frontend
│   ├── components/            # UI Components & Navigation
│   ├── features/              # Feature Pages (Residents, Menu, Staff, Timecard, Admin)
│   ├── pages/                 # Setup Wizard, Login, Legal Pages
│   └── security/              # Auth Context, Idle Tracker, RBAC Helpers
├── DEMO.md                    # Demo Mode & Supabase Migration Guide
├── PRIVACY.md                 # Privacy Policy
├── BAA.md                     # Business Associate Agreement Template
└── HIPAA_NOTICE.md            # HIPAA Notice of Privacy Practices
```

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Vanilla CSS / Utility Tokens
- **Backend:** Node.js (Express), TypeScript, PostgreSQL (`pg`), JWT, Zod
- **Database Migrations:** Forward-only SQL migrations (`server/src/db/migrate.ts`)
- **Compliance:** HIPAA & SOC 2 Hardened Security Controls

---

## 📄 License

Proprietary — Shoreline Operations LLC. All rights reserved. Unauthorized use, reproduction, or distribution is strictly prohibited.
