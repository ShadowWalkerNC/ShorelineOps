<div align="center">

# 🍽️ ShorelineOps (Care OS v5.0)
### The Open-Source Dietary Operations & Care Coordination Platform for Senior Living & Healthcare

[![License: AGPL/MIT](https://img.shields.io/badge/License-AGPL%20%2F%20MIT-blue.svg)](LICENSING.md)
[![UI: shadcn/ui + Apple HIG](https://img.shields.io/badge/UI-shadcn%2Fui%20%2B%20Apple%20HIG-black.svg)](#-design-system--uiux)
[![Security: Built with HIPAA-aligned safeguards](https://img.shields.io/badge/Security-Built%20with%20HIPAA--aligned%20safeguards-emerald.svg)](#-security-technical-safeguards--hipaa-alignment)
[![Stack: React 18 / Node / SQLite / Postgres](https://img.shields.io/badge/Stack-React%2018%20%7C%20Node%20%7C%20Postgres-blueviolet.svg)](#%EF%B8%8F-tech-stack)
[![Marketing & Pricing Site](https://img.shields.io/badge/Marketing%20Site-Astro%20%2B%20Tailwind-orange.svg)](marketing)

**Built by an executive healthcare chef, not a venture fund.**  
*Bridging clinical resident diets, kitchen batch cooking, tray cards, multi-distributor purchasing, and CMS-2567 survey binders without vendor lock-in.*

[🚀 Live Demo App](https://shoreline-demo.onrender.com/menu) • [🌐 Marketing & Pricing Portal](https://shoreline-marketing.onrender.com) • [🔑 Open Core Licensing](LICENSING.md) • [📋 Daily Operations Audit](docs/DAILY_OPERATIONS_AUDIT.md) • [📘 Architecture](ARCHITECTURE.md) • [🚚 Distributors](DISTRIBUTORS.md)

</div>

---

## 🍽️ What is ShorelineOps?

**ShorelineOps** is an open-source clinical nutrition and dietary operations platform designed for senior living and healthcare dining (Assisted Living, Memory Care, Skilled Nursing, CCRCs, and Acute Care).

In healthcare dining, culinary operations are clinical care:
- Swallowing disorders (dysphagia) require strict adherence to the **IDDSI framework** (Levels 0–7).
- Food allergies must be cross-referenced against recipe ingredients in real-time.
- State surveyors require complete documentation under **CMS Federal F-Tags (F800–F814)**.
- Kitchens must optimize raw food spend across broadline food distributors (**Dennis Food Service, Sysco, US Foods, Gordon Food Service**) using par levels and Lowest-Cost Split MRP.

---

## 🧭 System Architecture & Daily Flow

```
                                  ┌───────────────────────────────┐
                                  │ 1. CLINICAL DIET & EHR ORDERS │
                                  │ • PointClickCare 2-Way Sync   │
                                  │ • IDDSI Pureed / Minced Textures│
                                  │ • Highlighted Allergen Flags  │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐ ┌───────────────────────────────┐
│ 2. MENU & RECIPE PLANNING     │ │ 3. KITCHEN TABLET & TRAY SCAN │ │ 4. MULTI-DISTRIBUTOR MRP      │
│ • 4-Week Cycle Menu Engine    │ │ • Batch Cook Worksheets       │ │ • Lowest-Cost Split PO Engine │
│ • USDA Nutritional Solver     │─┼▶ • Digital Tray Card Scanner  │─┼▶ • Dennis & Sysco EDI Sync    │
│ • Bill of Materials Explosion │ │ • HACCP 165°F Temp Logs       │ │ • 3-Way Invoice Match & Memos │
└───────────────────────────────┘ └───────────────────────────────┘ └───────────────────────────────┘
                                                  │
                                                  ▼
                                  ┌───────────────────────────────┐
                                  │ 5. CMS-2567 SURVEY BINDER     │
                                  │ • 1-Click F-Tag Audit Crosswalk│
                                  │ • 14-Hour Meal Timing Logs    │
                                  │ • Food Cost ($/CPD) Auditing  │
                                  └───────────────────────────────┘
```

---

## 🌟 Core Modules & Capabilities

### 1. 🟢 Clinical Resident & Diet Management (`/residents`)
- **IDDSI Dysphagia Alignment**: Supports Levels 0–7 (Regular, Soft & Bite-Sized, Minced & Moist, Pureed, Liquidised, Thickened Liquids).
- **PointClickCare (PCC) EHR 2-Way Sync**: Catches inbound ADT admission/discharge transfers and physician diet updates into a real-time Registered Dietitian Triage Queue.
- **Deterministic Allergen Intersection**: Hard-blocks meals containing resident allergens with red banner warnings.

### 2. 🔴 Kitchen Tablet Mode & Digital Tray Line (`/kitchen/tablet` & `/kitchen/traycards`)
- **Large-Touch Cook Worksheets**: Designed for line cooks wearing wet nitrile gloves with $\ge 44\text{px}$ touch targets.
- **Digital Tray Card Scanner**: Camera OCR barcode scanning verifies resident identity and dysphagia texture before trays leave the hot line.
- **HACCP Food Safety Logs**: Instant pass/fail recording for 165°F poultry and 145°F fish core temperatures.

### 3. 🟣 Multi-Distributor Split MRP & Purchasing (`/purchasing` & `/distributor`)
- **Lowest-Cost Split MRP Optimizer**: Compares contract line-item rates across Dennis Food Service, Sysco, and US Foods to guarantee lowest case cost (saving $1.50–$3.00 per resident day).
- **3-Way Invoice Matching & Credit Memos**: Scans delivery invoices at the loading dock, flags price overcharges, and generates formal vendor credit claims.
- **Vendor Partner Portal (`/distributor`)**: Sales reps manage contract catalogs and EDI 850/810 connectors without seeing resident PHI.

### 4. 📊 CMS-2567 Federal Survey Ready Binder (`/reporting`)
- **1-Click Digital Inspection Binder**: Full crosswalk coverage for Federal F-Tags (F800 through F814).
- **14-Hour Rule Compliance (F809)**: Verifies interval between evening meal and morning breakfast.
- **Cost Per Resident Day ($/CPD)**: Real-time food cost dashboard benchmarked against target budgets.

### 5. ⚙️ Facility & Operations Settings (`/settings`)
- **Facility Profile**: Customize facility name, parent organization, NPI, state license, and clinical leadership.
- **Wings & Dining Locations**: Interactive residential unit and dining room configuration.
- **Clinical & Dietary Standards**: CPD target budgets, meal schedule times, and temperature units.
- **SaaS License Manager**: Manage active tier entitlements and license keys.

---

## 🖥️ Screen-by-Screen Map

| Module | Route | What You Do Here | Primary Users |
|---|---|---|---|
| **Dashboard** | `/` | Daily census, meal service KPI telemetry, safety alerts, and activity feed | All Staff |
| **Residents & Diets** | `/residents` | Resident roster, diet orders, IDDSI textures, allergies, and EHR triage | RD / Nursing / CDM |
| **Menu Cycle Planner** | `/menu` | 4-week cycle menus, meal items, recipes, and dietary modifications | Chef / Dietary Mgr |
| **Batch Production** | `/production` | Daily scaled prep sheets, cooking stations, yields, and temp logs | Line Cooks / Prep |
| **Recipe Book** | `/recipes` | Standardized batch recipes, ingredient scaling, and USDA nutrition | Cooks / Bakers |
| **Inventory & Par Walk** | `/inventory` | Stock on hand, par levels, locations, and low stock warnings | Kitchen Mgr / Cooks |
| **Kitchen Tablet Kiosk** | `/kitchen/tablet` | Glove-friendly touchscreen prep lists and fast par counting | Line Cooks |
| **Tray Card Generator** | `/kitchen/traycards` | High-contrast thermal meal service tickets and barcode scanning | Dining Aides / Cooks |
| **Purchasing & Split MRP** | `/purchasing` | Dennis/Sysco order guides, lowest-cost split POs, and invoice matching | Dietary Director |
| **Reporting & CMS Binder** | `/reporting` | $/CPD cost logs, substitutions, and CMS-2567 federal survey binder | Administrator / CDM |
| **Vendor Portal** | `/distributor` | Distributor SKU catalog master, EDI connectors, and pricing | Distributor Sales Reps |
| **Facility Settings** | `/settings` | Facility profile, wings, dining rooms, meal schedule, and licensing | Admin / Executive Dir |
| **Administration** | `/admin` | Staff scheduling, user accounts, audit log, and HealerBot panel | Admin / HR |

---

## 🔑 Open Core Licensing Model

| Tier | Price | Model | Features Included |
|---|---|---|---|
| **Community Core** | $0 / Free | Open Source (AGPL/MIT) | Unlimited resident census, cycle menus, recipe scaler, tray cards, local SQLite/Postgres |
| **Pro Cloud SaaS** | $199 / mo | Commercial SaaS | Everything in Core + Multi-Distributor Lowest-Cost Split MRP, USDA Nutrition Solver, Cloud Sync |
| **Enterprise Care** | $399 / mo | Commercial SaaS | Everything in Pro + PointClickCare Live Sync, CMS-2567 Survey Binder, 3-Way Invoice Match |
| **Demo Sandbox** | Free Preview | Live Evaluation | Pre-seeded multi-facility evaluation sandbox live on Render |

See [`LICENSING.md`](LICENSING.md) for complete entitlement architecture.

---

## 🤖 Autonomous Operations Consultant & Daily Audit

ShorelineOps includes an autonomous **Dietary Operations Consultant Agent** (`dietary_operations_consultant`) and daily review engine:
- **Run Audit on Demand**:
  ```bash
  npm run audit:operations
  ```
- **Daily Log**: Inspect [`docs/DAILY_OPERATIONS_AUDIT.md`](docs/DAILY_OPERATIONS_AUDIT.md) for clinical safety stress-tests and roadmap recommendations.

---

## 🛠️ Quickstart & Local Development

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
cd ShorelineOps
npm install
```

### 2. Run the Full Stack
```bash
npm run dev:all
```
- App: `http://localhost:5173`
- API Server: `http://localhost:3001`
- Marketing Site: `http://localhost:4321` (via `cd marketing && npm run dev`)

### 3. Run Test Suite
```bash
npm test
```
All 89 unit, integration, and clinical safety test suites pass with 0 failures.

---

## 📄 Compliance & Legal
- [Master Services Agreement (MSA)](COMMERCIAL_AGREEMENT.md)
- [Business Associate Agreement (BAA)](BAA.md)
- [HIPAA Notice of Privacy Practices](HIPAA_NOTICE.md)
- [Open Core Licensing Guide](LICENSING.md)
