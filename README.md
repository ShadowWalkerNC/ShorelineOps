# ShorelineOps
### Open-Source Dietary Operations & Care Coordination Platform for Senior Living

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: HIPAA & SOC 2 Ready](https://img.shields.io/badge/Compliance-HIPAA%20%26%20SOC%202%20Ready-green.svg)](#-security--compliance-hipaa--soc-2)
[![Stack: React 18 / Vite / Node.js / PostgreSQL](https://img.shields.io/badge/Stack-React%2018%20%7C%20Node%20%7C%20Postgres-blueviolet.svg)](#%EF%B8%8F-tech-stack)

**Shoreline Operations Platform (ShorelineOps)** is a full-stack, HIPAA-ready dietary operations, recipe management, and vendor purchasing system built specifically for **Assisted Living, Memory Care, and Skilled Nursing Facilities**.

It connects resident clinical needs directly to menu cycles, batch kitchen worksheets, tray card dispatch lines, and food distributor order guides—eliminating proprietary vendor lock-in and saving facilities **$1.50–$3.00 per resident day**.

---

## 🗺️ How Shoreline Works: End-to-End System Workflow

Shoreline coordinates the daily operational lifecycle of a healthcare foodservice team in four interconnected phases:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. CLINICAL ADMISSIONS & DIET ORDERS                                                            │
│    Dietitians & Nursing configure:                                                              │
│    • Therapeutic Diets (NAS, NCS/Diabetic, Renal, Cardiac)                                      │
│    • IDDSI Texture Modifications (Regular, Minced & Moist, Pureed, Nectar Thick)                │
│    • Critical Allergen Exclusions (Gluten, Dairy, Nuts, Eggs, Shellfish) & Beverage Needs       │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. MENU PLANNING & RECIPE PRODUCTION                                                            │
│    Dietary Managers & Chefs:                                                                    │
│    • Build multi-week cycle menus with Choice A / Choice B options                              │
│    • Recipe Book with auto-allergen detection and live batch scaling                            │
│    • Recipe ingredients linked to Dennis Food Service catalog SKUs                              │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. KITCHEN TABLET SERVICE & TRAY CARDS                                                          │
│    Line Cooks & Servers on Kitchen Tablets (`/kitchen/tablet`):                                 │
│    • Cook Worksheets: Batch yield scaling, internal temp guides, prep tracking                  │
│    • Tray Card Dispatch: High-contrast resident meal tickets with bold red allergen alerts      │
│    • Quick Par Counter: 2-minute morning walk-through inventory steppers (+ / -)                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. PURCHASING & COMPLIANCE REPORTING                                                            │
│    Management & Distributor Partners:                                                           │
│    • Suggested PO Generator: Auto-calculates order quantity based on (Par Level - On Hand)      │
│    • Dennis Food Service Adapter: 1-click drag-and-drop CSV guide sync & PO CSV export          │
│    • Financial / Survey Audit: Real-time Cost per Resident Day ($/CPD) & state compliance sheets│
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📱 Application Layout & User Interface

Shoreline organizes its interface into 4 core functional modules:

### 1. 🔵 Core Operations
- **Dashboard (`/`)**: Daily resident census tally, active meal count, dietary alerts, and quick action shortcuts.
- **Residents & Diets (`/residents`)**: Complete medical profile management, texture assignments, dining room table seating, and fluid restriction tracking.
- **Communications (`/communications`)**: Shift notes, cross-departmental announcements, and kitchen broadcast messaging.

### 2. 🔴 Dietary & Kitchen Command
- **Kitchen Tablet Mode (`/kitchen/tablet`)**: Touch-optimized interface for wall-mounted kitchen displays or handheld iPads:
  - *Cook Worksheets*: Step-by-step batch cooking status (`pending` ➔ `prepping` ➔ `completed`).
  - *Tray Card Line*: Resident-by-resident digital ticket verification displaying allergies in bright red banner alerts.
  - *Quick Par Counter*: Rapid `+` / `-` steppers to count cases during daily morning walk-throughs.
- **Menu Planner (`/menu`)**: Interactive cycle week builder with day/meal slots and alternative choices.
- **Dietary Tray Cards (`/kitchen/traycards`)**: High-contrast printable tray tickets formatted for meal delivery carts.
- **Recipe Book (`/recipes`)**: Master recipe repository with automatic ingredient allergen detection and batch yield scaling.
- **Production Sheets (`/production`)**: Cook sheets, prep volume calculations, and planned vs. actual cooked variance.
- **Meal Tally Entry (`/kitchen/orders`)**: Daily order tallies for dining rooms and room tray deliveries.

### 3. 🟣 Purchasing, Cost & Distributor Portal
- **Purchasing & Orders (`/purchasing`)**:
  - *Standing Order Guide*: Track par levels, on-hand inventory, and average usage.
  - *Suggested Order Generator*: Automatic purchase order generation when inventory drops below par.
  - *Dennis CSV Importer*: Drag-and-drop importer for vendor order guides and broadline catalogs.
  - *Dennis CSV Order Export*: Exports electronic order sheets formatted directly for Dennis Food Service.
- **Distributor Portal (`/distributor`)**: Dedicated self-service vendor portal for distributor sales representatives to update catalog SKUs and contract pricing without accessing resident PHI.
- **Cost & Compliance Reports (`/reporting`)**: Real-time **Food Cost per Resident Day ($/CPD)**, total operating cost per resident day (food + labor), substitution logs, and state survey compliance audit print sheets.
- **Inventory & Stock (`/inventory`)**: Dry storage, walk-in cooler, and freezer stock management with waste tracking.
- **Budget & Spend (`/budget`)**: Monthly food spend allocation and invoice reconciliation.

### 4. ⚪ Facility, Team & Security
- **Staff Roster (`/staff`)**: Dietary and server directory with assigned shifts and contact info.
- **Time Clock Logs (`/timecards`)**: Punch clock logs with optional integration for external Attendance on Demand (AoD) kiosks.
- **Administration (`/admin`)**: 10-tier Role-Based Access Control (RBAC) user provisioning, facility settings, and audit log viewer.
- **Setup Wizard (`/setup`)**: Initial installation wizard to configure wings, dining rooms, initial admin accounts, and sign the Business Associate Agreement (BAA).

---

## 📚 Commercial, Legal & Developer Hub

| Document | Description |
|---|---|
| 💼 **[Executive Pitch & Commercial Kit](SALES_PITCH.md)** | Facility pitch deck, ROI savings model ($1.50–$3.00/day), pricing tiers, and distributor value proposition. |
| 📄 **[Commercial Services Agreement](COMMERCIAL_AGREEMENT.md)** | Master Software License Agreement, HIPAA BAA terms, 100% customer data ownership, and SLA commitments. |
| 🎬 **[5-Minute Live Sales Demo Script](DEMO_SCRIPT.md)** | Step-by-step presentation script for Executive Directors, DONs, and Dietary Managers. |
| 📥 **[Facility Onboarding Templates](ONBOARDING_TEMPLATES.md)** | Ready-to-use CSV/Excel templates for 10-minute resident census and Dennis order guide imports. |
| 💼 **[Product Marketing Guide](PRODUCT_MARKETING.md)** | Problem/solution breakdown, clinical safety, and feature deep-dives. |
| 💻 **[Developer & API Guide](DEVELOPERS.md)** | Tech stack, folder structure, 10-tier RBAC matrix, and connector contracts. |
| 🚚 **[Distributor Onboarding Guide](DISTRIBUTORS.md)** | Integration manual for food distributors (Dennis Food Service) & item master setup. |
| 🏗️ **[System Architecture](ARCHITECTURE.md)** | High-level system topology, module boundaries, and security safeguards. |
| 📋 **[Development Roadmap](TODO.md)** | Track completed V1 deliverables and V2–V4 milestones. |

---

## 🚀 Quickstart & Local Installation

### Prerequisites
- **Node.js**: v18+ 
- **PostgreSQL**: v14+ (or built-in SQLite offline mode for development)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
cd ShorelineOps
```

### 2. Backend Setup (`/server`)
```bash
cd server
cp .env.example .env
npm install
npm run dev
```
*The backend API runs on `http://localhost:3001`.*

### 3. Frontend Setup (Root)
```bash
# In the repository root
npm install
npm run dev
```
*The frontend web app runs on `http://localhost:3000`.*

### 4. Sign In
- **URL**: [http://localhost:3000/login](http://localhost:3000/login)
- **Demo Email**: `admin@shoreline.demo`
- **Demo Password**: `Admin1234!`

---

## 🐳 Production Docker Deployment

Deploy the entire production stack (Nginx PWA + Express API + PostgreSQL 15) with one command:

```bash
docker-compose up -d --build
```

- **Frontend Application**: `http://localhost:80`
- **API Backend**: `http://localhost:3001`
- **Automated Backup**: Run `bash scripts/backup.sh` (Linux/macOS) or `powershell scripts/backup.ps1` (Windows) to create timestamped database backups with 30-day auto-rotation.

---

## 🔒 Security & Compliance (HIPAA & SOC 2)

ShorelineOps includes comprehensive healthcare safeguards out of the box:
- **Session Security**: 10-minute idle inactivity auto-logout tracker.
- **Append-Only Audit Log**: Database triggers block all `UPDATE` or `DELETE` queries on the `audit_log` table for strict non-repudiation.
- **10-Tier Granular RBAC**: Strict separation of roles (Super Admin, Dietitian/RD, Dietary Staff, Distributor Partner, Server, Read-Only).
- **Distributor PHI Isolation**: Distributor partner logins are cryptographically restricted from viewing resident medical records or dietary orders.
- **HTTP Security Headers**: Strict CSP, HSTS preload, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` via Helmet.

---

## 📄 License & Legal

Distributed under the MIT License. See `LICENSE` for more information.

*Disclaimer: Organizations deploying ShorelineOps with Protected Health Information (PHI) are responsible for executing Business Associate Agreements (BAAs) with their cloud hosting providers and maintaining administrative compliance safeguards.*
