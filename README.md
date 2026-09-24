<div align="center">

<img src="public/logo.png" alt="Shoreline Care OS" width="450" />

### Open-Source Healthcare Dietary Operations, Clinical Nutrition & Care Coordination Platform

[![License: AGPL/MIT](https://img.shields.io/badge/License-AGPL%20%2F%20MIT-blue.svg)](LICENSING.md)
[![UI: shadcn/ui + Apple HIG](https://img.shields.io/badge/UI-shadcn%2Fui%20%2B%20Apple%20HIG-black.svg)](#platform-interface-tour)
[![Security: Deployment Responsibilities](https://img.shields.io/badge/Security-Deployment%20Responsibilities-blue.svg)](docs/CLAIM_EVIDENCE.md)
[![Tests: Local Regression Suite](https://img.shields.io/badge/Tests-Local%20Regression%20Suite-brightgreen.svg)](#4-run-automated-test-suite)
[![Deploy on Render](https://img.shields.io/badge/Deploy%20to-Render-46E3B7.svg?logo=render&logoColor=white)](docs/RenderDeployment.md)

**Engineered by a healthcare executive chef, not a venture fund.**  
*Bridging clinical resident diets, IDDSI dysphagia safety, touch tablet batch cookery, multi-distributor split MRP purchasing, and CMS-2567 federal survey readiness.*

[Live Demo App](https://shoreline-demo.onrender.com/menu) • [Marketing & Pricing Portal](https://shoreline-marketing.onrender.com) • [Open Core Licensing](LICENSING.md) • [Daily Operations Audit](docs/DAILY_OPERATIONS_AUDIT.md) • [TypeScript SDK](sdk/README.md)

</div>

---

## Platform Interface Tour

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE APPLICATION MODULES                                │
├──────────────────────────┬───────────────────────────┬─────────────────────────────────┤
│ 1. Executive Dashboard   │ 2. Menu Cycle Planner     │ 3. Residents & IDDSI Dysphagia  │
│ 4. Split MRP Purchasing  │ 5. CMS-2567 Survey Binder │ 6. Facility Profile & Standards │
└──────────────────────────┴───────────────────────────┴─────────────────────────────────┘
```

### 1. Executive Culinary & Clinical Dashboard (`/`)
*Real-time census tracking, food cost per resident day ($/CPD) budget variance gauges, active IDDSI texture distribution, and clinical allergen alerts.*

![Executive Dashboard Overview](docs/screenshots/dashboard_overview.png)

### 2. 4-Week Seasonal Cycle Menu Planner (`/menu`)
*4-week institutional cycle menus with standardized recipes, IDDSI dysphagia texture options, and real-time allergen collision warnings.*

![Menu Cycle Planner](docs/screenshots/menu_cycle_planner.png)

### 3. Clinical Residents Roster & IDDSI Dysphagia Orders (`/residents`)
*Therapeutic diet orders (NAS, NCS, Renal), IDDSI Level 4 Pureed badges, allergen warnings, table seating, and PointClickCare EHR triage queue.*

![Residents & Diets](docs/screenshots/residents_iddsi_triage.png)

### 4. Multi-Distributor Lowest-Cost Split MRP (`/purchasing`)
*Compares live contract pricing line-by-line across Dennis Food Service, Sysco, and US Foods, generating optimal split purchase orders — the lowest-cost vendor wins each line.*

![Split MRP Purchasing Comparator](docs/screenshots/split_mrp_purchasing.jpg)

---

## What is ShorelineOps?

**ShorelineOps** is an open-source clinical nutrition and dietary operations platform designed for senior living and healthcare dining (Assisted Living, Memory Care, Skilled Nursing Facilities, CCRCs, and Acute Care Hospitals).

In healthcare dining, culinary operations are clinical care:
- **Dysphagia & Texture Modification**: Swallowing disorders require strict adherence to the **IDDSI framework** (Levels 0–7: Regular, Soft & Bite-Sized, Minced & Moist, Pureed, Liquidised, Thickened Liquids). Blank or unassigned textures automatically trigger a hard clinical hold.
- **Deterministic Allergen Intersection**: Food allergies (Dairy, Gluten, Shellfish, Tree Nuts, Peanuts, Wheat, Soy, Egg, Sesame) are cross-referenced against standardized recipe bill-of-materials in real-time with non-overridable hard-blocks.
- **State Survey Readiness**: Federal regulations require comprehensive documentation under **CMS State Operations Manual Appendix PP (F-Tags F800–F814)**, including the 14-hour dinner-to-breakfast rule (F809).
- **Distributor Spend Optimization**: Eliminates distributor lock-in by comparing Broadline order guides (**Dennis Food Service, Sysco, US Foods, Gordon Food Service, PFG**) line-by-line so the lowest-cost vendor wins each item.

---

## Complete System Architecture

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
│ • Bill of Materials Explosion │ │ • Durable HACCP Temp Logs       │ │ • 3-Way Invoice Match & Memos │
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

## Core Modules & Capabilities

| Module | Route | Key Capabilities | Target User |
|---|---|---|---|
| **Executive Dashboard** | `/` | Census telemetry, $/CPD cost gauges, IDDSI distribution chart, real-time safety alerts | Executive Dir / CDM |
| **Residents & Diets** | `/residents` | Therapeutic diets (NAS, NCS, Renal), IDDSI levels, allergies, PointClickCare EHR triage queue, and Bulk Census CSV Importer | Registered Dietitian |
| **Menu Cycle Planner** | `/menu` | 4-week cycle menus, Choice A/B alternates, recipe drawer, nutrition totals | Executive Chef |
| **Batch Production** | `/production` | Production sheets built from the scheduled menu × census forecast (with census-trend buffer), scaled prep sheets, cooking stations, durable HACCP temp logs | Line Cooks |
| **Standardized Recipes** | `/recipes` | Master recipe book, ingredient scaling, Big 9 allergen detector, USDA nutrient solver, recipe costing with SKU/estimated provenance | Cooks & Bakers |
| **Digital Tray Cards** | `/kitchen/traycards` | High-contrast 4" x 6" thermal meal tickets with human-readable typography, strict "NO SELECTION" fallback, and scanner verification | Dining Aides |
| **Purchasing & Split MRP** | `/purchasing` | Dennis/Sysco order guides, lowest-cost split POs, 3-way invoice match, credit memos | Dietary Director |
| **CMS Survey Reporting** | `/reporting` | CMS-2567 digital survey binder export (F800–F814) incl. durable HACCP log evidence, $/CPD cost audits, substitution logs, budget targets & spend | Administrator / CDM |
| **Facility Settings** | `/settings` | Facility profile, wings & dining rooms, CPD budget solver, meal schedule times — server-synced across devices with offline cache & sync indicator | System Admin |

---

## Wave F — TypeScript SDK, SEO Optimization & Legal Policy Suite

- **Full Enterprise TypeScript SDK (`@shoreline/sdk` v0.2.0)**:
  - 100% typed client for all platform domains: Residents, Census, Recipe Validation, USDA Nutrition Analysis, Dennis/Sysco Split MRP, 3-Way Invoice Matching, EHR Reconciliation Triage, Kitchen HACCP Logging & Schedules, Tray Tracking, and CMS Survey Binder.
  - Published in `sdk/` with comprehensive type declarations, README documentation, and zero external runtime dependencies.
- **Search Engine Optimization (SEO) & Geolocation**:
  - OpenGraph & Twitter Card metadata across all marketing views.
  - Geolocation coordinates anchored to Portland, Maine (`geo.region: US-ME`, `geo.placename: Portland, Maine`, `geo.position: 43.6591;-70.2568`).
  - Schema.org JSON-LD structured data for `SoftwareApplication` and `MedicalBusiness`.
- **Complete Healthcare Legal & Policy Suite**:
  - Terms of Service & Master Services Agreement (`/terms`).
  - Healthcare Privacy Policy & HIPAA Business Associate Agreement (BAA) with standard provisions (`/privacy`).
  - Technical Security Architecture, SOC 2 Type II Safeguards & 99.9% Uptime SLA Whitepaper (`/security`).
  - Zero-resale guarantee: resident health data is never brokered, sold, or used to train third-party public AI models.

---

## Operational Architecture & Hardware Integration

ShorelineOps incorporates battle-tested operational resilience protocols for physical kitchen deployments. See [`docs/OPERATIONAL_ARCHITECTURE.md`](docs/OPERATIONAL_ARCHITECTURE.md) for full hardware wiring and failover blueprints:

1. **HACCP Temperature Probes & iOS/Safari Resilience**:
   - **Primary Default**: Ergonomic high-contrast on-screen numeric keypad on all tablets and smartphones with automatic HACCP out-of-range bounds highlighting (<165°F cook hold, <140°F steam line hold, >40°F cold hold) and supervisor override badge protection.
   - **Hardware Pairing**: Progressive WebBluetooth connectivity for Cooper-Atkins, BlueTherm, and BLE probes on supported Android/Chromium hardware with 100% zero-lockout manual fallback.
2. **Distributor EDI SFTP Pipeline & Offline Fallback**:
   - **Dual Mode Transmission**: Background SFTP polling engine (`ssh2-sftp-client`) managing `/inbound/` catalogs/invoices and `/outbound/` EDI 850 PO files.
   - **Automated Fallback**: In the event of SFTP unavailability or credential delay, orders automatically package as encrypted vendor CSV/PDF order guides with 1-click manual download and automated SMTP sales-rep dispatch.
3. **Hybrid Nutritional Intelligence Engine**:
   - **Offline Master Database**: Comprehensive pre-seeded local database of institutional culinary ingredients and common therapeutic foods.
   - **Lazy Ingestion**: When connected with a `USDA_API_KEY`, automatically queries USDA FoodData Central and upserts missing items directly into the facility's local offline database.
4. **Multi-Protocol Tray Label Printing (4" x 6")**:
   - **Direct Network TCP (Port 9100)**: Direct socket relay emitting raw ZPL II envelopes (`^XA ... ^XZ`) to networked Zebra thermal printers.
   - **Workstation USB**: Integration with Zebra Browser Print agent for locally attached USB desktop printers.
   - **Universal Browser Dialog**: Standard `@page { size: 4in 6in; }` CSS styling for desktop printers, AirPrint, and batch PDF archival.
5. **Dual Configuration Management**:
   - Managed via the interactive **Facility Settings UI** (`/settings`) with live printer ping and test label generation, stored in the facility database with `.env` and CLI override parity.

---

## Wave E — Clinical Safety, EHR Triage Queue & Kitchen Hardware Ergonomics

- **IDDSI 2.0 Hard Safety Hold & Drink Levels (`src/types/resident.ts`, `server/src/engine/production.ts`)**: Blank or unassigned textures trigger a non-overridable clinical hold (`level: -1, label: 'UNASSIGNED — CONFIRM WITH DIETARY'`). Expanded FDA Big 9 allergens (Milk, Eggs, Fish, Crustacean Shellfish, Tree Nuts, Peanuts, Wheat, Soybeans, Sesame), adaptive feeding equipment options, and IDDSI drink thickness levels 0–4.
- **NPO Exclusion from Batch Cooking & Production Sheets (`src/features/kitchen/KitchenSheetPage.tsx`, `server/src/engine/production.ts`)**: Line cook batch cards exclude NPO residents from cookable counts (`members.filter(m => !m.isNpo)`), surfacing active tray counts vs NPO excluded counts with clean Lucide alert icons.
- **PointClickCare Webhook Ingestion into RD Triage Queue (`server/src/routes/ehr.ts`)**: Connected `POST /api/ehr/webhook` to `pcc.evaluateInboundTriage()`. Automatically checks existing resident records and stores inbound NPO changes, texture downgrades, diet order modifications, and new allergens in `ehr_reconciliation_queue` with `status = 'PENDING_TRIAGE'`.
- **HIPAA Security, PHI Cache Bypass & Private Cache-Control (`server/src/index.ts`, `server/src/middleware/cache.ts`)**: Removed HTTP cache middleware from `/api/residents` so 100% of PHI accesses are audited in `audit_log`. Upgraded cache control headers across non-PHI routes from `public` to `private, max-age=${ttlSeconds}, must-revalidate` and isolated cache keys with tenant `facilityId`.
- **Database Fail-Closed PostgreSQL Integrity (`server/src/db/pool.ts`)**: Removed silent fallback to local SQLite when `DATABASE_URL` is set, eliminating split-brain data loss during network blips in enterprise PostgreSQL deployments.
- **3-Way Invoice Match REST API Endpoint (`server/src/routes/purchasing.ts`)**: Exposed `POST /api/purchasing/invoices/evaluate` powered by `ThreeWayInvoiceMatchingEngine`. Evaluates line-by-line price variances, quantity short-ships, compound variances, and auto-generates vendor credit memo requests.
- **Kitchen Kiosk Bluetooth LE Probe & Hands-Free Voice Logging (`src/features/kitchen/TempLogPanel.tsx`)**: Replaced all emojis with clean Lucide icons. Integrated `WebBluetoothProbeDriver` with 1-click BLE probe pairing and live temperature sync. Added hands-free Web Speech API temperature capture for kitchen tablet kiosks.
- **Section 30 System Integration Test Suite Expansion (`server/src/system.test.ts`)**: **192/192 automated tests passing with 100% success rate** across 30 operational subsystems.

---

## Open Core Licensing Model

ShorelineOps uses an **Open Core** architecture:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ COMMUNITY CORE (100% Free & Open Source)                                               │
│ • Unlimited Resident Census & Diet Orders      • 4-Week Cycle Menu Planner             │
│ • Standardized Recipe Yield Scaler             • Kitchen Batch Worksheets & Tray Cards │
│ • Local Timecard Punch Kiosk                   • Offline SQLite & PostgreSQL Support   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PRO CLOUD SAAS ($199 / month / facility)                                              │
│ • Multi-Distributor Lowest-Cost Split MRP      • USDA FoodData Central 8,000+ Database │
│ • Cloud Multi-Device Real-Time Sync            • Automated Distributor Order Export    │
│ • Durable HACCP Temperature Logs (Enforced)   • Signed Business Associate Agreement   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ENTERPRISE CARE NETWORK ($399 / month / facility)                                     │
│ • PointClickCare Live 2-Way EHR Sync           • CMS-2567 Digital Survey Ready Binder  │
│ • 3-Way Delivery Invoice Match & Credit Memos  • Full TypeScript SDK & Custom Webhooks │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Autonomous Dietary Operations Consultant

ShorelineOps includes an autonomous **Dietary Operations Consultant Agent** (`dietary_operations_consultant`):
- **Continuous Auditing**: Evaluates clinical IDDSI constraints, kitchen ergonomics, supply chain price variances, and CMS survey compliance.
- **Run Audit On-Demand**:
  ```bash
  npm run audit:operations
  ```
- **Master Audit Log**: Inspect [`docs/DAILY_OPERATIONS_AUDIT.md`](docs/DAILY_OPERATIONS_AUDIT.md) for live focus questions and operational stress-test results.

---

## Turnkey Installation & Deployment

Shoreline Care OS is engineered for zero-friction turnkey deployment across workstations, kitchen tablets, bare-metal servers, and cloud infrastructure.

### Option A: Turnkey Linux / macOS / Cloud Script (Recommended for Unix)
```bash
git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
cd ShorelineOps
chmod +x install.sh
./install.sh
```
*Auto-verifies Node 20+, creates local data directories, generates high-entropy `JWT_SECRET`, compiles client/server assets, and installs a persistent `systemd` service.*

### Option B: Turnkey Windows 1-Click Desktop Setup
In PowerShell (as Administrator or standard user):
```powershell
.\Setup.ps1
```
*Provisions `%APPDATA%\ShorelineOps\data`, installs dependencies, and pins desktop and Start Menu shortcuts. Launch instantly via `ShorelineOps-Launcher.bat`.*

### Option C: Turnkey Multi-Container Docker Stack
```bash
docker compose up -d
```
*Orchestrates a hardened PostgreSQL 16 Alpine database with healthchecks, Node.js API server (port 3001), and Vite/React web client.*

---

## Quickstart & Local Development

### 1. Prerequisites
- Node.js $\ge 20.0.0$
- npm $\ge 10.0.0$

### 2. Clone & Install
```bash
git clone https://github.com/ShadowWalkerNC/ShorelineOps.git
cd ShorelineOps
npm install
```

### 3. Start Development Servers
```bash
# Starts both the React frontend (port 5180) and Express API (port 3001)
npm run dev:all
```
- Web Application: `http://localhost:5180`
- Backend API Server: `http://localhost:3001`
- Astro Marketing Site: `http://localhost:4321` (via `cd marketing && npm run dev`)

### 4. Run Automated Test Suite
```bash
npm test
```
`npm test` compiles the server and runs the system and regression suites against disposable SQLite databases, without inheriting deployment database credentials. On September 24, 2026: **228 system checks and 28 additional tests passed**. These local results do not establish PostgreSQL concurrency, device accessibility, external integration, or production readiness. See the [decision workflow handoff](docs/DECISION_WORKFLOW_HANDOFF.md).

### 5. Operational Safety & Deployment Boundaries
- **Atomic EHR reconciliation**: approving a triage item applies the resident change (diet, texture, NPO, or new allergen) and marks the queue item resolved in one transaction. Malformed or unsupported payloads stay `PENDING_TRIAGE` — failed actions never display success.
- **Honest failure states**: unreachable EHR, offline verification, and unevaluated menu audits render pending/unknown states. A scanner error cannot create simulated success or record assembly.
- **Signed tray cards**: reprint legacy cards. Assembly and later events require the complete signed QR code, current resident version, matching meal/date, and successful safety checks at the write boundary. Missing recipes, unresolved EHR changes, and unsupported allergy/restricted-diet evidence hold the tray. No clinical override is provided.
- **Draft-bound purchasing**: order lines change only while the parent order is a `draft` and only through manager approval; vendor status updates cannot approve orders. Received quantities move only through the receiving workflow.
- **One facility per database**: set `SHORELINE_FACILITY_ID` (see `.env.example`). Credentials or headers from another facility are rejected with `403`; facility switching is disabled.
- **No invented clinical results**: menu review displays “Not evaluated”; shift operations links to operational records without fabricated assignments or completion.
- **Reviewed catalog comparisons**: only confirmed matches with current prices and compatible canonical units enter the price matrix. Specification changes require review again; name similarity never establishes clinical equivalence.

---

## Cloud Deployment on Render

Deploy the complete multi-service stack to Render using the official [`render.yaml`](render.yaml) Blueprint:

1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\to$ **Blueprint**.
3. Connect your repository: `ShadowWalkerNC/ShorelineOps`.
4. Render provisions and builds all 4 services automatically:
   - `shoreline-api` (Node/Express API on port 3001)
   - `shoreline-demo` (React 18 + Vite SPA on `https://shoreline-demo.onrender.com`)
   - `shoreline-marketing` (Astro static portal on `https://shoreline-marketing.onrender.com`)
   - `shoreline-db` (Managed PostgreSQL instance)

See [`docs/RenderDeployment.md`](docs/RenderDeployment.md) for complete deployment instructions and troubleshooting.

---

## CLI & Developer Tools

ShorelineOps ships a unified **command-line interface** (also aliased as `culinaryos`) that gives programmatic control over every clinical, culinary, purchasing, and compliance module.

```bash
# Via npm script
npm run cli -- <command> [subcommand] [flags]

# After npm link or global install
shoreline <command>
culinaryos <command>
```

### Quick Command Reference

| Command | What it does |
|---|---|
| `shoreline residents` | Show active census — diet orders, textures, NPO status |
| `shoreline residents triage` | Print the RD clinical EHR triage queue |
| `shoreline menu audit` | Run CMS F800–F809 & USDA nutritional compliance audit |
| `shoreline production split --census=60` | Station demand split (Steam Table, Puree L4, Minced L5, Soft L6) |
| `shoreline production ap-ep --ep-demand=15` | AP vs EP yield loss & case-pack calculator |
| `shoreline kitchen verify-tray --resident-id=SH-001` | Clinical tray verification with NPO hard-block & allergen check |
| `shoreline kitchen log-temp --item="Turkey" --temp=168` | HACCP 165°F food safety temperature log |
| `shoreline purchasing split-po --item="Turkey Breast"` | Multi-distributor lowest-cost split MRP (Dennis vs Sysco) |
| `shoreline survey cms-binder` | Generate CMS-2567 F-Tag survey compliance binder |
| `shoreline survey cpd` | Cost per resident day ($/CPD) analytics |
| `shoreline mcp tools` | List all MCP tools available for AI agent integration |
| `shoreline doctor` | Full system health diagnostic scan |

---

## TypeScript SDK (`@shoreline/sdk`)

Official client library for integrating facility systems, EHR gateways, and custom reporting pipelines:

```typescript
import { ShorelineClient } from '@shoreline/sdk'

const client = new ShorelineClient({
  baseUrl: 'https://facility.shorelineops.com',
  apiKey: process.env.SHORELINE_API_KEY,
})

// 1. Fetch census & active diets
const census = await client.getCensus()

// 2. Run lowest-cost split MRP comparison
const mrp = await client.getMrpSplitPo('Turkey Breast', 50)

// 3. Evaluate 3-way invoice match
const match = await client.evaluateInvoiceMatch({
  invoiceNumber: 'INV-44019',
  vendorName: 'Dennis Food Service',
  lines: [
    {
      itemSku: 'DNS-1002',
      description: 'Raw Turkey Breast',
      poQty: 10,
      receivedQty: 9,
      invoicedQty: 10,
      poContractUnitPrice: 4.25,
      invoicedUnitPrice: 4.85,
    },
  ],
})

// 4. Log verified HACCP food temperature
await client.logHaccpTemperature({
  checkType: 'food',
  itemName: 'Roasted Turkey Breast',
  tempF: 168.5,
  source: 'probe',
  probeDevice: 'Cooper-Atkins BLE #4',
})
```

See [`sdk/README.md`](sdk/README.md) and [`docs/SDK_REFERENCE.md`](docs/SDK_REFERENCE.md) for full method documentation.

---

## Compliance & Legal Policies

- [Terms of Service & Master Services Agreement (MSA)](TERMS.md) • [Web View](/terms)
- [Healthcare Privacy Policy & HIPAA BAA](PRIVACY.md) • [Web View](/privacy)
- [Technical Security Architecture & SLA Whitepaper](SECURITY.md) • [Web View](/security)
- [Business Associate Agreement Standard Template](BAA.md)
- [HIPAA Notice of Privacy Practices](HIPAA_NOTICE.md)
- [Acceptable Use Policy (AUP)](AUP.md)
- [Open Core Licensing Guide](LICENSING.md)

---

## License

Core platform is licensed under **AGPLv3 / MIT Open Core**. Commercial SaaS features are proprietary to Shoreline Operations LLC.  
Copyright © 2026 Shoreline Operations LLC. Built in Portland, Maine.

## Deployment

See [Railway deployment](docs/RAILWAY_DEPLOYMENT.md) for the production URL layout, required variables, database readiness behavior, and first-owner setup flow.
