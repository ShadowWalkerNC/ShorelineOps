<div align="center">

# 🍽️ ShorelineOps
### The Open-Source Dietary Operations & Care Coordination Platform for Senior Living

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Security: Built with HIPAA-aligned safeguards](https://img.shields.io/badge/Security-Built%20with%20HIPAA--aligned%20safeguards-emerald.svg)](#-security-technical-safeguards--hipaa-alignment)
[![Stack: React 18 / Node / Postgres](https://img.shields.io/badge/Stack-React%2018%20%7C%20Node%20%7C%20Postgres-blueviolet.svg)](#%EF%B8%8F-tech-stack)
[![Astro Marketing Site](https://img.shields.io/badge/Marketing%20Site-Astro%20%2B%20Tailwind-orange.svg)](marketing)

**Built by a senior living chef, not a VC.**  
*Bridging clinical resident diets, kitchen batch cooking, tray cards, and food distributor purchasing without proprietary vendor lock-in.*

[🚀 Live Demo Sandbox](http://localhost:3000) • [💼 Commercial Pitch & ROI Guide](SALES_PITCH.md) • [📄 Commercial Agreement (Sample)](COMMERCIAL_AGREEMENT.md) • [🎬 5-Min Demo Script](DEMO_SCRIPT.md) • [🚚 Dennis Guide](DISTRIBUTORS.md)

</div>

---

## 🍽️ What is ShorelineOps?

**ShorelineOps** is an open-source software application designed to support daily dietary, food production, and purchasing operations for senior living communities (Assisted Living, Memory Care, and Skilled Nursing Facilities).

In senior living, foodservice directly impacts clinical care. Kitchens must prepare specialized textures for residents with swallowing disorders (dysphagia), manage allergen exclusions, provide accurate tray cards for meal service, track operating budgets, and order supplies from broadline distributors (such as **Dennis Food Service**).

ShorelineOps is designed to replace scattered binders, dry-erase boards, and rigid legacy software with a **single, transparent, self-hostable digital system**.

> **Open-Source with Managed SaaS Options:**  
> ShorelineOps is 100% open-source under the MIT license and can be self-hosted for free. Managed cloud hosting, technical support, distributor onboarding assistance, and turnkey compliance services will be offered for operators who prefer not to manage their own local infrastructure.

---

## 🧭 System Overview: How Shoreline Coordinates the Daily Kitchen

```
                                  ┌───────────────────────────────┐
                                  │ 1. CLINICAL DIET ORDERS       │
                                  │ • Pureed, Minced, NAS, Renal  │
                                  │ • Highlighted Allergen Flags  │
                                  │ • Thickened Nectar Liquids    │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│ 2. MENU & RECIPE PLANNING     │ │ 3. KITCHEN TABLET SERVICE     │ │ 4. DISTRIBUTOR PURCHASING     │
│ • Multi-Week Cycle Menus      │ │ • Large-Touch Cook Worksheets │ │ • Suggested POs (Par - Count) │
│ • Auto-Allergen Detection     │─┼▶ • 1-Tap Tray Card Dispatch   │─┼▶ • Dennis Food Service CSV Sync │
│ • Dennis SKU Cost Linking     │ │ • 2-Minute Par Count Walk     │ │ • Real-Time $/CPD Cost Audit  │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
```

---

## 🌟 Core Capabilities

### 1. 🔴 Kitchen Tablet Mode (`/kitchen/tablet`)
> *Designed specifically for wall-mounted kitchen touchscreens or handheld iPads.*

- 🍳 **Batch Cook Worksheets**: Live portion scaling based on today's census, internal temperature guidelines (165°F), and one-tap status toggling (`pending` ➔ `prepping` ➔ `completed`).
- 📋 **Digital Tray Card Line**: Step-through resident meal tickets displaying bold, high-contrast red allergen alerts and required thickened beverages.
- 📦 **Quick Par Counter**: Stepper `+` and `-` buttons for cooks to record physical inventory counts during morning walk-throughs without typing.

### 2. 🟢 Clinical Resident & Diet Management (`/residents`)
> *Reduces meal delivery errors and is built around the IDDSI framework for texture-modified diets.*

- 🥗 **Therapeutic Diet Orders**: Structured support for No Added Salt (NAS), No Concentrated Sweets (NCS/Diabetic), Renal, Cardiac, and Low Fat orders.
- 🥣 **IDDSI Texture Alignment**: Built around International Dysphagia Diet Standardisation Initiative standards (Regular, Mechanical Soft, Ground / Minced & Moist, Pureed, and Nectar Thick).
- ⚠️ **Visual Allergy Warnings**: Auto-highlights allergen conflicts (Gluten, Dairy, Nuts, Eggs, Shellfish, Soy, Seeds) directly on recipes and tray tickets.
- 🪑 **Dining Seating & Delivery**: Table assignments by dining room or room tray delivery carts.

### 3. 🟣 Purchasing, Dennis Food Service & Distributor Portal (`/purchasing`)
> *Distributor-agnostic purchasing designed to reduce food spend and purchasing errors.*

- 🤖 **Suggested Purchase Order Generator**: Calculates suggested replenishment quantities using `Par Level - On Hand`.
- 📥 **Dennis CSV Drag-and-Drop**: Drop in your Dennis Food Service order guide or broadline catalog for rapid par synchronization.
- 📄 **Dennis Order Export**: Generates electronic CSV purchase orders formatted for Dennis Food Service order workflows.
- 🚚 **Dedicated Distributor Partner Portal (`/distributor`)**: Sales reps update contract unit pricing and pack sizes without viewing resident PHI.

### 4. 📊 Food Cost ($/CPD) & Compliance Support (`/reporting`)
> *Real-time financial visibility and survey preparation support.*

- 💵 **Cost Per Resident Day ($/CPD)**: Real-time dashboard comparing daily food spend against your target budget.
- ⏱️ **Total Dietary Operating Spend**: Combined food spend + dietary labor hours pulled from timecard punch logs.
- 📝 **Substitution Log**: Structured audit trail of meal substitutions and documented justifications.
- 🖨️ **Printable Compliance Summary**: One-click print-ready report to assist during state health inspection reviews.

---

## 🖥️ Screen-by-Screen Map

| Module | Route | What You Do Here | Primary Users |
|---|---|---|---|
| 🔵 **Dashboard** | `/` | Census overview, meal tallies, active diet alerts, and fast shortcuts. | Executive Directors & All Staff |
| 🟢 **Residents & Diets** | `/residents` | Manage resident profiles, textures, allergies, and table seats. | Dietitians, RDs, DONs |
| 🔴 **Kitchen Tablet** | `/kitchen/tablet` | Touch display for batch cook worksheets, tray card dispatch, and quick par counts. | Line Cooks & Prep Staff |
| 🟡 **Menu Planner** | `/menu` | Multi-week cycle menu calendar with Choice A / Choice B slots. | Dietary Directors |
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

Deploy the full production stack (Nginx Frontend + Express API + PostgreSQL 15) with automated healthchecks:

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

## 🔒 Security: Technical Safeguards & HIPAA Alignment

ShorelineOps includes the following technical safeguards. *(Facilities remain responsible for their own comprehensive HIPAA compliance program, formal BAAs, and internal staff training.)*

- **10-Minute Idle Auto-Logout**: Technical session termination to protect resident health information on shared kitchen/nursing workstations (`AuthContext.tsx`).
- **Append-Only Audit Immutability**: PostgreSQL triggers prevent alteration or deletion of audit logs for non-repudiation during state compliance audits.
- **10-Tier Granular RBAC**: Role boundaries separating Super Admins, Registered Dietitians, Dietary Staff, Distributor Partners, and Read-Only users.
- **Distributor PHI Isolation**: Food vendor logins are cryptographically restricted from viewing resident medical records or dietary orders.
- **HTTP Security Headers**: Strict CSP, HSTS preload, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` via Helmet.

---

## 📚 Commercial, Technical & Legal Resources

- 💼 **[Executive Pitch & Commercial ROI Model](SALES_PITCH.md)** — Projected cost savings model ($1.50–$3.00/day benchmarked against industry food waste), pricing tiers, and distributor value proposition.
- 📄 **[Master Services & Software License Agreement (Sample)](COMMERCIAL_AGREEMENT.md)** — Commercial agreement template *(legal review recommended prior to execution)*.
- 🎬 **[Live Sales Demo Script](DEMO_SCRIPT.md)** — 5-minute walkthrough script for facility leadership.
- 📥 **[Facility Onboarding Templates](ONBOARDING_TEMPLATES.md)** — Standard CSV/Excel templates for census and order guide imports.
- 🚚 **[Distributor Onboarding Guide](DISTRIBUTORS.md)** — Partner manual for Dennis Food Service and broadline vendors.
- 💻 **[Developer & API Guide](DEVELOPERS.md)** — Tech stack, database schemas, and API endpoint documentation.
- 🏗️ **[System Architecture](ARCHITECTURE.md)** — High-level system design, module boundaries, and security safeguards.
- 📋 **[Development Roadmap](TODO.md)** — Track completed V1 deliverables and V2–V4 milestones.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
