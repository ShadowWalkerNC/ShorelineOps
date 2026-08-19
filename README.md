<div align="center">

# 🍽️ ShorelineOps
### The Open-Source Dietary Operations & Care Coordination Platform for Senior Living

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: HIPAA & SOC 2 Ready](https://img.shields.io/badge/Compliance-HIPAA%20%26%20SOC%202%20Ready-emerald.svg)](#-security--compliance-hipaa--soc-2)
[![Stack: React 18 / Node / Postgres](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20Postgres-blueviolet.svg)](#%EF%B8%8F-tech-stack)
[![Astro Marketing Site](https://img.shields.io/badge/Marketing%20Site-Astro%20%2B%20Tailwind-orange.svg)](marketing)

**Built by a senior living chef, not a VC.**  
*Bridging clinical resident diets, kitchen batch cooking, tray cards, and food distributor purchasing without proprietary vendor lock-in.*

[🚀 Live Demo Sandbox](http://localhost:3000) • [💼 Commercial Pitch](SALES_PITCH.md) • [📄 Legal Agreement](COMMERCIAL_AGREEMENT.md) • [🎬 5-Min Demo Script](DEMO_SCRIPT.md) • [🚚 Dennis Guide](DISTRIBUTORS.md)

</div>

---

## 🧭 System Overview: How Shoreline Coordinates the Daily Kitchen

```
                                  ┌───────────────────────────────┐
                                  │ 1. CLINICAL DIET ORDERS       │
                                  │ • Pureed, Minced, NAS, Renal  │
                                  │ • Bold Allergen Exclusions    │
                                  │ • Thickened Nectar Liquids    │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│ 2. MENU & RECIPE PLANNING     │ │ 3. KITCHEN TABLET SERVICE     │ │ 4. DISTRIBUTOR PURCHASING     │
│ • 4-Week Cycle Menus          │ │ • Large-Touch Cook Worksheets │ │ • Suggested POs (Par - Count) │
│ • Auto-Allergen Detection     │─┼▶ • 1-Tap Tray Card Dispatch   │─┼▶ • Dennis Food Service CSV Sync │
│ • Dennis SKU Cost Linking     │ │ • 2-Minute Par Count Walk     │ │ • Real-Time $/CPD Cost Audit  │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

---

## 🌟 Core Modules at a Glance

### 1. 🔴 Kitchen Tablet Mode (`/kitchen/tablet`)
> *Designed specifically for wall-mounted kitchen touchscreens or handheld iPads.*

- 🍳 **Batch Cook Worksheets**: Live portion scaling based on today's census, internal temperature guidelines (165°F), and one-tap status toggling (`pending` ➔ `prepping` ➔ `completed`).
- 📋 **Digital Tray Card Line**: Step-through resident meal tickets displaying bold, high-contrast red allergen alerts and required thickened beverages.
- 📦 **Quick Par Counter**: Stepper `+` and `-` buttons for cooks to record physical inventory counts during morning walk-throughs without typing.

### 2. 🟢 Clinical Resident & Diet Safety (`/residents`)
> *Eliminates dangerous meal delivery mistakes and guarantees 100% IDDSI compliance.*

- 🥗 **Therapeutic Diet Orders**: No Added Salt (NAS), No Concentrated Sweets (NCS/Diabetic), Renal, Cardiac, and Low Fat.
- 🥣 **IDDSI Texture Modifications**: Regular, Mechanical Soft, Ground / Minced & Moist, Pureed, and Nectar Thick.
- ⚠️ **Visual Allergy Guard**: Auto-highlights allergen conflicts (Gluten, Dairy, Nuts, Eggs, Shellfish, Soy, Seeds) directly on recipes and tray tickets.
- 🪑 **Dining Seating & Delivery**: Table assignments by dining room or room tray delivery carts.

### 3. 🟣 Purchasing, Dennis Food Service & Distributor Portal (`/purchasing`)
> *Distributor-agnostic purchasing that cuts food spend by $1.50–$3.00 per resident day.*

- 🤖 **Suggested Purchase Order Generator**: Calculates exact order quantities in 1 click using `Par Level - On Hand`.
- 📥 **Dennis CSV Drag-and-Drop**: Drop in your Dennis Food Service order guide or broadline catalog for instant par synchronization.
- 📄 **Instant Dennis Order Export**: Generates electronic CSV purchase orders formatted directly for Dennis Food Service.
- 🚚 **Dedicated Distributor Partner Portal (`/distributor`)**: Sales reps update contract unit pricing and pack sizes without viewing resident PHI.

### 4. 📊 Food Cost ($/CPD) & State Survey Compliance (`/reporting`)
> *Real-time financial control and stress-free annual health inspections.*

- 💵 **Cost Per Resident Day ($/CPD)**: Real-time dashboard comparing daily food spend against your target budget (e.g. $10.86/day).
- ⏱️ **Total Dietary Operating Spend**: Combined food spend + dietary labor hours pulled directly from punch logs.
- 📝 **Substitution Log**: Clinical audit trail of all meal substitutions and justifications.
- 🖨️ **Printable Compliance Summary**: One-click print-ready report for state health surveyors.

---

## 🖥️ Screen-by-Screen Map

| Module | Route | What You Do Here | Primary Users |
|---|---|---|---|
| 🔵 **Dashboard** | `/` | Census overview, meal tallies, active diet alerts, and fast shortcuts. | Executive Directors & All Staff |
| 🟢 **Residents & Diets** | `/residents` | Manage medical profiles, textures, allergies, and table seats. | Dietitians, RDs, DONs |
| 🔴 **Kitchen Tablet** | `/kitchen/tablet` | Touch display for batch cook worksheets, tray card dispatch, and quick par counts. | Line Cooks & Prep Staff |
| 🟡 **Menu Planner** | `/menu` | 4-week cycle menu calendar with Choice A / Choice B slots. | Dietary Directors |
| 🟣 **Purchasing & Orders** | `/purchasing` | Order guide par levels, suggested PO generator, and Dennis CSV export. | Dietary Managers |
| 🟣 **Distributor Portal** | `/distributor` | Vendor portal to update catalog SKUs, pack sizes, and contract unit pricing. | Food Distributor Reps |
| 🟢 **Cost & Compliance** | `/reporting` | $/CPD analytics, substitution logs, allergen safety audits, and survey sheets. | Administrators & Inspectors |
| 🟣 **Smart Recipe Book** | `/recipes` | Master recipe book with automatic allergen detection and yield scaling. | Chefs & Cooks |
| ⚪ **Facility Setup** | `/setup` | 6-step onboarding wizard to configure wings, dining rooms, and BAA sign-off. | Super Administrators |

---

## ⚡ Quickstart: Try the Demo in 60 Seconds

The application includes an instant evaluation mode with zero backend setup required:

1. **Launch the web application**:
   ```bash
   npm install
   npm run dev
   ```
2. **Open in Browser**: Navigate to **[http://localhost:3000](http://localhost:3000)**.
3. **Sign In**:
   - **Email**: `admin@shoreline.demo`
   - **Password**: `Admin1234!`
4. **Explore**:
   - Tap through **Kitchen Tablet Mode** at `/kitchen/tablet`.
   - Test **Dennis CSV Auto-Ordering** at `/purchasing`.
   - View **Cost per Resident Day Analytics** at `/reporting`.

---

## 🐳 One-Click Production Docker Deployment

Deploy the entire production stack (Nginx Frontend + Express API + PostgreSQL 15) with automated healthchecks:

```bash
# Clone the repository
git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
cd ShorelineOps

# Start production containers
docker-compose up -d --build
```

- **Frontend App**: `http://localhost:80`
- **Backend API**: `http://localhost:3001`
- **Automated Backup**: Run `bash scripts/backup.sh` (Linux/macOS) or `powershell scripts/backup.ps1` (Windows) for timestamped backups with 30-day auto-rotation.

---

## 🔒 Security, Privacy & HIPAA Compliance

ShorelineOps includes comprehensive healthcare safeguards:
- **10-Minute Idle Auto-Logout**: Protects resident health data on shared kitchen computers (`AuthContext.tsx`).
- **Append-Only Audit Immutability**: PostgreSQL triggers prevent alteration or deletion of audit logs for non-repudiation during state surveys.
- **10-Tier Granular RBAC**: Strict role boundaries separating Super Admins, Registered Dietitians, Dietary Staff, Distributor Partners, and Read-Only users.
- **Distributor PHI Isolation**: Food vendor logins are cryptographically restricted from viewing resident medical records or dietary orders.
- **HTTP Security Headers**: Strict CSP, HSTS preload, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` via Helmet.

---

## 📚 Complete Commercial & Technical Hub

- 💼 **[Executive Pitch & Commercial Kit](SALES_PITCH.md)** — Cost savings math ($1.50–$3.00/day), pricing tiers, and ROI breakdown.
- 📄 **[Commercial Services Agreement](COMMERCIAL_AGREEMENT.md)** — Master software license agreement and HIPAA Business Associate Agreement (BAA).
- 🎬 **[Live Sales Demo Script](DEMO_SCRIPT.md)** — 5-minute walkthrough script for facility leadership.
- 📥 **[Onboarding Templates](ONBOARDING_TEMPLATES.md)** — CSV/Excel templates for 10-minute census and order guide imports.
- 🚚 **[Distributor Onboarding Guide](DISTRIBUTORS.md)** — Food distributor partner manual for Dennis Food Service.
- 💻 **[Developer & API Guide](DEVELOPERS.md)** — Complete tech stack, database schemas, and API documentation.
- 🏗️ **[System Architecture](ARCHITECTURE.md)** — System design, module boundaries, and security safeguards.
- 📋 **[Development Roadmap](TODO.md)** — Track completed V1 deliverables and V2–V4 milestones.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
