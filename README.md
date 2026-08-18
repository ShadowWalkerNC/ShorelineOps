# ShorelineOps

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: HIPAA & SOC 2 Ready](https://img.shields.io/badge/Compliance-HIPAA%20%26%20SOC%202%20Ready-green.svg)](#-security--compliance-hipaa--soc-2)
[![Stack: Node.js / React / TypeScript / PostgreSQL](https://img.shields.io/badge/Stack-Node%20%7C%20React%20%7C%20TS%20%7C%20Postgres-blueviolet.svg)](#%EF%B8%8F-tech-stack)

**Shoreline Operations Platform (ShorelineOps)** — An open-source, HIPAA/SOC 2-compliant internal care coordination, dietary management, and facility operations system for healthcare and senior living environments.

### 📚 Documentation Hub
- **💼 [Product & Marketing Overview](PRODUCT_MARKETING.md)** — Executive pitch, problem/solution breakdown, value propositions, and resident safety.
- **💻 [Developer & API Guide](DEVELOPERS.md)** — Tech stack, folder structure, 10-tier RBAC matrix, and connector contracts.
- **🚚 [Distributor Onboarding Guide](DISTRIBUTORS.md)** — Integration manual for food distributors (Dennis Food Service) & item master setup.
- **🏗️ [System Architecture](ARCHITECTURE.md)** — High-level system topology, module boundaries, and security safeguards.
- **📋 [Development Roadmap](TODO.md)** — Track completed V1 deliverables and V2–V4 milestones.

---

## 🌟 Features & Core Modules

- **🏥 Onboarding Setup Wizard**: First-time installation wizard (`/setup`) to configure facility info, wings, dining rooms, Super Admin credentials, and sign the Business Associate Agreement (BAA).
- **📋 Resident & Diet Orders**: Manage profiles, medical alerts, allergies, texture modifications, beverage preferences, and dining table assignments.
- **🍽️ Menu & Production Planner**: Design weekly menus, track meal prep counts, print tray cards, and generate production log sheets.
- **🛒 Purchasing & Order Guides**: Distributor-agnostic purchasing module with Dennis Food Service as the primary reference adapter. Supports vendor catalog item mapping, par levels, on-hand counts, suggested purchase order generation, and Dennis-ready CSV/PDF export sheets.
- **📊 Cost & Compliance Reporting**: Real-time operational tracking of Food Cost per Resident Day, meal substitution logs, active allergy risk summaries, special diet/texture requirements, and planned vs. cooked production variance.
- **⏱️ Timecard & Kiosk Punch**: Punch clock log with optional integration for external Attendance on Demand (AoD) kiosks.
- **💬 Internal Communications**: Announcement board, shift notes, and staff broadcast messages.
- **🔒 Role-Based Access Control (RBAC)**: Fine-grained permissions for Administrators, Managers, Dietary Staff, Caregivers, Servers, and Read-Only users.
- **🛡️ Audit Immutability**: Append-only PostgreSQL audit log triggers for strict non-repudiation and compliance reporting.

---

## 🚀 Deployment & Production Setup

ShorelineOps is designed to run as a full-stack Node.js + Express API backend backed by a PostgreSQL database and a Vite + React frontend.

### 1. Prerequisites

- **Node.js**: v18.x or higher
- **PostgreSQL**: v14.x or higher
- **Git**

### 2. Clone the Repository

```bash
git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
cd ShorelineOps
```

### 3. Backend Environment Setup (`/server`)

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your production settings:

```env
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://postgres:your_secure_password@localhost:5432/shorelineops
JWT_SECRET=generate_a_64_char_random_secret_here
SETUP_BOOTSTRAP_SECRET=your_bootstrap_key_for_setup_wizard
KIOSK_API_SECRET=your_timecard_kiosk_secret
FRONTEND_URL=https://your-domain.com
```

Install backend dependencies and run database migrations:

```bash
npm install
npm run build
npm start
```

*Note: Migrations run automatically on startup (`server/src/db/migrate.ts`).*

### 4. Frontend Environment Setup (Root)

```bash
# In the repository root
cp .env.example .env.local
```

Edit `.env.local` to point to your backend API:

```env
VITE_API_URL=https://api.your-domain.com
```

Install dependencies and start the app:

```bash
npm install
npm run build
# Preview or serve dist/ directory
npm run preview
```

### 5. Running the First-Time Setup Wizard

1. Open your browser and navigate to `https://your-domain.com/setup`.
2. Enter your `SETUP_BOOTSTRAP_SECRET` key to unlock the wizard.
3. Complete the **6-Step Onboarding Process**:
   - Facility details & type (Assisted Living, Skilled Nursing, Memory Care, etc.).
   - Wings & Dining Rooms configuration.
   - Super Admin user creation.
   - Digital BAA (Business Associate Agreement) sign-off.
   - Clean production vs sample database initialization.
4. Upon submission, your instance is locked and ready for facility operations.

---

## 🧪 Optional Sandbox / Demo Evaluation

For rapid evaluation, developer testing, or sales demonstrations without setting up a PostgreSQL database:

```bash
# Set VITE_DEMO_MODE=true in your local frontend environment
VITE_DEMO_MODE=true npm run dev
```

*When `VITE_DEMO_MODE=true` is enabled, pre-populated demo login buttons are displayed on the login page.*

---

## 🔒 Security & Compliance (HIPAA & SOC 2)

ShorelineOps includes comprehensive technical safeguards out of the box:

- **Session Security**: 10-minute idle inactivity auto-logout tracker ([`AuthContext.tsx`](file:///c:/Users/white/OneDrive/Documents/GitHub/ShorelineOps/src/security/AuthContext.tsx)).
- **Password Hardening**: Minimum 12-character passwords requiring uppercase, lowercase, numbers, and special symbols.
- **Append-Only Audit Log**: Database triggers (`trg_prevent_audit_log_update` and `trg_prevent_audit_log_delete`) in [`migrate.ts`](file:///c:/Users/white/OneDrive/Documents/GitHub/ShorelineOps/server/src/db/migrate.ts) block all `UPDATE` or `DELETE` queries on `audit_log`.
- **HTTP Security Headers**: Strict CSP, HSTS preload, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` implemented via Helmet in [`index.ts`](file:///c:/Users/white/OneDrive/Documents/GitHub/ShorelineOps/server/src/index.ts).
- **Timecard Authorization**: Bearer token authentication or secret key validation on all punch clock endpoints.

---

## 📁 Repository Structure

```
ShorelineOps/
├── server/                    # Express.js + PostgreSQL API Backend
│   ├── src/
│   │   ├── db/                # Database pool, migrations, & seeding
│   │   ├── middleware/        # Auth (JWT), RBAC, & security rate-limiters
│   │   ├── routes/            # Residents, Menu, Production, Timecard, Setup, Auth
│   │   ├── compliance.test.ts # Automated security validation suite
│   │   └── index.ts           # Server entry point & security headers
├── src/                       # React 18 + TypeScript Frontend
│   ├── components/            # UI components & shared navigation
│   ├── features/              # Feature modules (Residents, Menu, Staff, Timecard, Admin)
│   ├── pages/                 # Setup Wizard, Login, Legal Pages
│   └── security/              # Auth Context, Idle Tracker, RBAC Helpers
├── BAA.md                     # Business Associate Agreement Template
├── HIPAA_NOTICE.md            # HIPAA Notice of Privacy Practices
├── PRIVACY.md                 # Privacy Policy
├── TERMS.md                   # Terms of Use
└── DEMO.md                    # Sandbox & Demo Environment Documentation
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Vanilla CSS Design System
- **Backend**: Node.js, Express, TypeScript, PostgreSQL (`pg`), JWT, Zod
- **Database**: PostgreSQL with forward-only schema migrations
- **Compliance**: Built-in HIPAA & SOC 2 Technical Safeguards

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📄 Legal & License

Distributed under the MIT License. See `LICENSE` for more information.

*Disclaimer: Organizations deploying ShorelineOps with Protected Health Information (PHI) are responsible for executing Business Associate Agreements (BAAs) with their cloud hosting providers and maintaining administrative compliance safeguards.*
