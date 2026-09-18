# ShorelineOps System Architecture & Technical Specification

> **Platform:** Shoreline Care OS (v5.0.0 / v6.5.0)  
> **Status:** Production-Ready • Open-Source (MIT License)  
> **Target Equivalence:** MealSuite Care, Sysco IMPAC, CBORD NetMenu, Computrition, FOOD-TRAK, eMenuCHOICE, Grove Menus

---

## 1. System Overview

ShorelineOps is a high-reliability, offline-first healthcare dietary operations, clinical nutrition, and care coordination platform designed specifically for senior living and post-acute healthcare facilities (Assisted Living, Memory Care, Skilled Nursing, CCRCs, and Rehabilitation Centers).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PRESENTATION LAYER                                     │
│  React 18 PWA • shadcn/ui • Tailwind CSS • Apple HIG Design System • Zustand • WebAudio│
│  Offline Mutation Queue (IndexedDB) • ServiceWorker Precache • Web Speech & Bluetooth  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ REST / JSON (Argon2 / JWT + RBAC)
┌───────────────────────────────────────────v────────────────────────────────────────────┐
│                                API & SERVICE ROUTING                                   │
│  Express.js • Helmet Security • Rate Limiting • In-Memory LRU Cache • Request Dedup    │
│  Circuit Breakers • PointClickCare Webhooks • Model Context Protocol (MCP) Server     │
└───────┬───────────────────┬───────────────────┬───────────────────┬────────────────────┘
        │                   │                   │                   │
┌───────v───────────┐ ┌─────v─────────────┐ ┌───v─────────────────┐ ┌─v──────────────────┐
│  CLINICAL SAFETY  │ │ PRODUCTION & MRP  │ │PURCHASING ADAPTERS  │ │SURVEY & COMPLIANCE │
│ • SafetyEvaluator │ │ • ProductionEngine│ │ • DennisConnector   │ │ • CmsSurveyEngine  │
│ • QR Verifier     │ │ • MrpForecast     │ │ • SyscoConnector    │ │ • 14-Hour Spans    │
│ • IDDSI Matrix    │ │ • NutritionSolver │ │ • 3-Way MatchEngine │ │ • $/CPD Auditor    │
│ • RD Triage Queue │ │ • Recipe Scaling  │ │ • Vendor Credit Memo│ │ • Immutable Audit  │
└───────┬───────────┘ └─────┬─────────────┘ └───┬─────────────────┘ └─┬──────────────────┘
        │                   │                   │                     │
┌───────v───────────────────v───────────────────v─────────────────────v──────────────────┐
│                                 PERSISTENCE LAYER                                      │
│  PostgreSQL 16 (Foreign Keys, Cascade Deletes, Append-Only Triggers, Fail-Closed Pool) │
│  SQLite (Local Offline-First Workstations, In-Memory Test Harness, Zero-Config Local) │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive Data Model

The ShorelineOps database schema comprises 43 tables managed through an append-only migration pipeline (`server/src/db/migrate.ts`):

```
┌──────────────────────────────┐       ┌──────────────────────────────┐
│          FACILITIES          │1     *│          RESIDENTS           │
│ ──────────────────────────── │───────│ ──────────────────────────── │
│ id (UUID / PK)               │       │ id (UUID / PK)               │
│ facility_name (TEXT)         │       │ facility_id (UUID / FK)      │
│ bed_count (INT)              │       │ name (TEXT)                  │
│ primary_distributor (TEXT)   │       │ room (TEXT)                  │
│ cpd_target (NUMERIC)         │       │ status (Active/Hospital/LOA) │
│ wings (JSONB)                │       │ diet_type (Diabetic/Renal...)│
│ dining_rooms (JSONB)         │       │ texture (IDDSI Levels 3-7)   │
└──────────────┬───────────────┘       │ allergies (TEXT[])           │
               │1                      │ fluid_restriction_ml (INT)   │
               │                       │ is_npo (BOOLEAN)             │
               │                       └──────────────┬───────────────┘
               │                                      │1
               │                                      │*
               │                       ┌──────────────v───────────────┐
               │                       │         TRAY_EVENTS          │
               │                       │ ──────────────────────────── │
               │                       │ id (UUID / PK)               │
               │                       │ resident_id (UUID / FK)      │
               │                       │ status (assembled/dispatched)│
               │                       │ token_hash (TEXT)            │
               │                       │ timestamp (TIMESTAMPTZ)      │
               │                       └──────────────────────────────┘
               │*
┌──────────────v───────────────┐       ┌──────────────────────────────┐
│           VENDORS            │1     *│         VENDOR_ITEMS         │
│ ──────────────────────────── │───────│ ──────────────────────────── │
│ id (UUID / PK)               │       │ id (UUID / PK)               │
│ name (Dennis/Sysco/USFoods)  │       │ vendor_id (UUID / FK)        │
│ code (TEXT / UNIQUE)         │       │ vendor_sku (TEXT / UNIQUE)   │
│ edi_protocol (CSV/FTP/AS2)   │       │ name, brand, pack_size, uom  │
│ contract_pricing (JSONB)     │       │ unit_cost (NUMERIC)          │
└──────────────────────────────┘       └──────────────┬───────────────┘
                                                      │1
                                                      │*
┌──────────────────────────────┐       ┌──────────────v───────────────┐
│       PURCHASE_ORDERS        │1     *│    PURCHASE_ORDER_LINES      │
│ ──────────────────────────── │───────│ ──────────────────────────── │
│ id (UUID / PK)               │       │ id (UUID / PK)               │
│ facility_id (UUID / FK)      │       │ purchase_order_id (UUID / FK)│
│ vendor_id (UUID / FK)        │       │ vendor_item_id (UUID / FK)   │
│ status (draft/submitted...)  │       │ qty_ordered, qty_received    │
│ total_amount (NUMERIC)       │       │ unit_cost, credit_claimed    │
└──────────────────────────────┘       └──────────────────────────────┘
```

### Core Schema Entity Summary
1. **Clinical & Identity**: `residents`, `diet_orders`, `diet_review_flags`, `resident_profile_history`, `ehr_reconciliation_queue`.
2. **Menu, Recipes & Nutrition**: `menu_items`, `menu_weeks`, `recipes`, `recipe_nutrients`, `menu_item_recipes`.
3. **Kitchen Execution & HACCP**: `production_sheets`, `tray_runs`, `tray_events`, `haccp_equipment`, `haccp_logs`, `hydration_records`.
4. **Supply Chain & MRP**: `vendors`, `vendor_items`, `facility_item_maps`, `order_guides`, `purchase_orders`, `purchase_order_lines`, `distributor_invoices`, `vendor_credit_memos`.
5. **Inventory & Costing**: `inventory_items`, `inventory_transactions`, `inventory_counts`, `daily_cost_log`, `budget_periods`, `budget_entries`.
6. **Operations & Governance**: `users`, `refresh_tokens`, `staff_profiles`, `timecard_punches`, `call_outs`, `facility_config`, `facility_settings`, `audit_log`, `communications`.

---

## 3. Module Boundaries & Vertical Slices

### Slice 1: Resident Diet & Deterministic Allergen Safety
- **Database**: `residents`, `diet_orders`, `diet_review_flags`, `ehr_reconciliation_queue`.
- **Logic (`server/src/engine/safetyEvaluator.ts`)**: Pure deterministic evaluation. Non-overridable hard-blocks on:
  1. Strict NPO (Nil Per Os) designation $\to$ suppresses tray generation immediately.
  2. FDA Big 9 Allergen Collision $\to$ cross-checks recipe Bill of Materials; flags cross-contact risk.
  3. IDDSI Dysphagia Mismatch $\to$ unassigned or incompatible textures block tray ticket validation.
- **RD Triage Queue**: Inbound EHR updates (PointClickCare ADT / FHIR) stage into `ehr_reconciliation_queue` for dietitian review before updating live dining orders.

### Slice 2: Cycle Menu Planning & Recipe Scaling
- **Database**: `menu_weeks`, `menu_items`, `recipes`, `recipe_nutrients`, `menu_item_recipes`.
- **Logic (`server/src/engine/nutrition.ts`, `server/src/engine/production.ts`)**:
  - 4-week rotating cycle menu engine supporting Choice A / Choice B / Alternates.
  - Bill of Materials explosion multiplying active census $\times$ portion size $\times$ recipe scaling factor.
  - Institutional USDA FoodData Central nutrient solver calculating calories, protein, carbs, fat, sodium, fiber, and potassium per meal slot.

### Slice 3: Kitchen Tablet Kiosk & Hardware Temp Logging
- **Database**: `haccp_logs`, `haccp_equipment`, `tray_runs`, `tray_events`, `hydration_records`.
- **Ergonomics & Hardware**:
  - Touch-optimized tablet UI with $\ge 48\text{px}$ touch targets conforming to Jakob's Law.
  - WebBluetooth LE digital thermometer integration (`WebBluetoothProbeDriver`) for zero-manual-entry probe temperatures.
  - Hands-free Web Speech API ("Tap to Speak Temp") for cooks wearing food-prep gloves.
  - Mandatory corrective action dialog triggered on temperatures below critical limit (< 165°F reheat, < 140°F hot hold, > 40°F cold hold).
  - High-contrast 4" $\times$ 6" thermal tray card generator with cryptographic scan verification (`POST /api/kitchen/verify-tray-scan`).

### Slice 4: Purchasing Integration & Dennis Food Service Adapter Pattern
- **Database**: `vendors`, `vendor_items`, `order_guides`, `purchase_orders`, `distributor_invoices`, `vendor_credit_memos`.
- **Integration Surface (The Distributor Reality)**:
  - *Industry Reality*: Broadline foodservice distributors (Dennis Food Service, Sysco, US Foods, PFG, Gordon) do not provide open OAuth 2.0 public REST APIs for independent software developers. Instead, enterprise foodservice relies on:
    1. Scheduled EDI 850 (Purchase Order), EDI 855 (PO Ack), and EDI 810 (Invoice) transactions via secure SFTP/AS2.
    2. Weekly Electronic Order Guides (CSV/XLSX contract pricing feeds).
  - *The Adapter Pattern*: ShorelineOps defines a formal TypeScript interface `DistributorConnector` (`server/src/integrations/broadline.ts`):
    ```ts
    export interface DistributorConnector {
      readonly code: string
      readonly name: string
      getCatalog(accountId?: string): Promise<VendorCatalogItem[]>
      importOrderGuide(csvBuffer: Buffer): Promise<ImportSummary>
      calculateSuggestedOrder(parItems: ParItem[]): SuggestedOrderResult
      exportOrder(po: PurchaseOrder): Promise<ExportResult>
    }
    ```
  - *Implemented Adapters*:
    1. `DennisConnector`: Dennis Food Service catalog sync, order guide parsing, and Dennis-formatted CSV/EDI export.
    2. `SyscoConnector`: Sysco IMPAC-compatible order guide parser and electronic export.
    3. `UsFoodsConnector`: US Foods electronic interchange adapter.
    4. `MockDistributorConnector`: Fully functional synthetic test adapter populated with 500+ institutional broadline SKUs for offline testing, CI/CD, and demonstrations.
  - *Split MRP Engine (`server/src/engine/mrp.ts`)*: Compares item pricing across Dennis, Sysco, and US Foods line-by-line; the lowest-cost vendor wins each SKU, computing net facility savings.
  - *3-Way Invoice Match Engine (`server/src/engine/invoicing.ts`)*: Reconciles PO contract price vs receiving dock count vs distributor invoice; flags price creep and short-ships, auto-generating vendor credit memo deductions.

### Slice 5: Food Cost & CMS-2567 Compliance Reporting
- **Database**: `daily_cost_log`, `budget_periods`, `budget_entries`, `substitution_log`, `audit_log`.
- **Logic (`server/src/engine/cmsSurvey.ts`, `server/src/routes/reporting.ts`)**:
  - Cost Per Resident Day ($/CPD) analytics isolating Food vs Labor vs Supplements.
  - CMS-2567 Federal Dietary Survey Binder crosswalking F-Tags F800 through F814:
    - F800 (Dietary Services General)
    - F801 (Qualified Dietary Staff)
    - F802 (Sufficient Dietary Support Personnel)
    - F803 (Standardized Menus & Nutritional Adequacy)
    - F804 (Food Prepared in Palatable Form)
    - F805 (Food Form Accommodates Resident Needs — IDDSI 2.0)
    - F806 (Allergen & Therapeutic Diet Order Adherence)
    - F807 (Hydration & Fluid Restrictions)
    - F808 (Therapeutic Diet Orders Signed by Physician/RD)
    - F809 (14-Hour Maximum Dinner-to-Breakfast Span Audit)
    - F812 (Food Safety, HACCP 165°F Core Temperature & Sanitation)
  - Ephemeral Surveyor Guest Mode: Read-only inspector view that hides confidential financials and vendor contracts while exposing meal spans, HACCP logs, and diet orders.

### Slice 6: Staff Timecards & Labor Costing
- **Database**: `staff_profiles`, `timecard_punches`, `call_outs`.
- **Logic**: Touch tablet punch clock, shift tracking, overtime alerts, manager call-out logging, and basic labor cost roll-up into the daily operating cost summary.

### Slice 7: Multi-Facility Portfolio & Enterprise Scaling
- **Scalability Architecture**:
  - Indexed multi-tenant architecture with composite indexes (`idx_residents_facility`, `idx_order_guides_facility_item`, `idx_menu_weeks_facility`).
  - Scales to 12+ facilities, 1,000+ residents, and 100,000+ catalog SKUs without in-memory filtering:
    - Paginated and cursor-based database queries across all endpoints (`LIMIT`/`OFFSET` with indexed sort keys).
    - Database request deduplication (`server/src/middleware/dedup.ts`) coalescing simultaneous requests.
    - Fail-closed PostgreSQL connection pool with connection leasing and keep-alive recycling.
  - Corporate Syndication Engine (`SyndicationEngine` in `server/src/engine/syndication.ts`): Broadcasts 4-week cycle menus from corporate headquarters to satellite spoke facilities, with automated tolerance checks for local ingredient substitutions.

---

## 4. Architectural Decisions & Deviations

### Why React 18 + Vite + Express + SQLite/Postgres vs Next.js App Router?

While Next.js App Router is a strong choice for content websites and standard B2B dashboards, healthcare culinary operations present distinct operational constraints that necessitated a decoupled architecture:

| Healthcare Kitchen Requirement | Monolithic Next.js (SSR / Server Components) | Shoreline Decoupled Architecture (React 18 PWA + Express) |
|---|---|---|
| **Kitchen Hardware Offline Resilience** | Requires persistent internet/server connection for server actions and component streaming. If Wi-Fi blips inside a stainless-steel walk-in cooler, the line halts. | **Offline-First PWA**: Service Worker precaches the application shell; IndexedDB mutation queue stores tray checks and temp logs during network drops, replaying when Wi-Fi reconnects. |
| **Sub-50ms QR Scanner & Audio Latency** | Network round-trips for server-side evaluation introduce perceptible 200–500ms lag on tray line assembly. | **Client-Side Token Pre-Validation**: Instant WebAudio buzzer/bell synthesis and haptic vibration feedback with background async audit sync. |
| **Local Bare-Metal Workstation Deployment** | Running a local Next.js node server on an isolated desktop PC in a rural facility requires complex runtime environments and node process orchestration. | **1-Click Turnkey Desktop**: Unified launcher (`launcher.js` / `Setup.ps1`) runs lightweight Express + local SQLite with 0 external cloud dependencies. |
| **Enterprise Cloud Scalability** | Mixed serverless execution limits persistent database connection pools and background worker loops. | **PostgreSQL Connection Pool**: Persistent, fail-closed connection pool with transactional integrity, immutable audit triggers, and sub-10ms query execution. |
| **Separate Marketing & App Deployability** | Marketing landing pages, pricing calculators, and public legal policies deploy alongside internal HIPAA PHI clinical systems. | **Isolated Monorepo Workspaces**: Astro public marketing portal (`marketing/`) deploys as static HTML to global CDN edges; Express API (`server/`) and React client (`src/`) run in HIPAA-hardened private networks. |

---

## 5. Security & Regulatory Compliance Architecture

- **HIPAA Privacy & Security Rules**:
  - Zero PHI caching: HTTP cache middleware is explicitly bypassed for `/api/residents`.
  - Cache-Control headers across non-PHI routes enforce `private, max-age=60, must-revalidate` to prevent intermediate proxy leaks.
  - Append-only database audit log (`audit_log`) recording every resident read, diet order modification, and PHI export with user ID, IP address, and timestamp.
  - Argon2id password hashing and signed JWT authentication with 10-minute idle session timeout.
- **Open Core Purity & Zero Clinical Lockout**:
  - Community Core remains 100% free, open-source, and offline-capable forever under the MIT license.
  - Billing or subscription lapses strictly disable advanced SaaS automation (2-way EHR sync, split MRP comparator, survey binder export) without ever locking out resident meal delivery, allergen safety checks, or temperature logging.
