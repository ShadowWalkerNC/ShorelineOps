# ShorelineOps Architecture & Technical Specification

## 1. System Overview

**ShorelineOps** is an open-source dietary operations, clinical nutrition, and healthcare foodservice coordination platform designed specifically for assisted living, memory care, and skilled nursing communities.

Its core operational philosophy is **distributor independence, deterministic clinical safety, and real-time operational resilience**:
1. Facilities should never be locked into a single food distributor ERP.
2. Resident diet orders, IDDSI texture requirements, and allergen exclusions drive production, purchasing, and tray delivery with deterministic non-overridable safety hard-blocks.
3. Clinical EHR integrations and distributor ordering are decoupled via standard adapter interfaces.
4. Multi-tier caching, conditional ETags, request deduplication, and circuit breakers ensure 0ms offline-first kitchen tablet performance.

---

## 2. Architectural Layers

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               Shoreline UI (PWA)                                │
│       (React 18 + Vite + TypeScript + Zustand + Hybrid SWR / IndexedDB Cache)   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ REST / Bearer JWT (Conditional ETags / 304)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                              Shoreline Express API                              │
│       (Node.js + Express + Helmet + LRU Cache + Dedup + Circuit Breakers)       │
└───────┬──────────────────────┬──────────────────────┬───────────────────┬───────┘
        │                      │                      │                   │
┌───────▼──────┐       ┌───────▼──────┐       ┌───────▼──────┐    ┌───────▼──────┐
│  PostgreSQL  │       │ Distributor  │       │  EHR Sync    │    │ USDA Central │
│  (Database)  │       │  Connectors  │       │ (FHIR spec)  │    │  (Nutrition) │
│ • Audit Log  │       │ • Dennis     │       │ • PointClick │    │ • SR Legacy  │
│ • MRP Schema │       │ • Sysco/USF  │       │   Care       │    │ • FNDDS      │
└──────────────┘       └──────────────┘       └──────────────┘    └──────────────┘
```

---

## 3. Core Modules & Route Map

| Module | Core Responsibilities | Routes / APIs | Primary Users |
|---|---|---|---|
| **Resident Manager** | Profile, diet orders (NAS, NCS, Renal), IDDSI textures, allergies, beverages, dining room table assignments | `/residents`, `/api/residents` | Dietitians, RDs, DONs |
| **EHR Triage Queue** | RD reconciliation gate for conflicting inbound EHR diet/texture updates and unverified allergens | `/residents`, `/api/ehr/reconciliation-queue` | Registered Dietitians |
| **Kitchen Tablet Mode** | Touch worksheets, batch yield scaling, temp logs (165°F), tray line dispatch, quick par count steppers, QR line scanner | `/kitchen/tablet`, `/api/kitchen` | Line Cooks & Prep Staff |
| **Menu Planner** | 4-week cycle menus, Choice A/Choice B, active cycle week, weekly nutritional audit, print view | `/menu`, `/api/menu` | Dietary Directors |
| **Smart Recipe Book** | Master recipe catalog with automatic Big 9 allergen detection, USDA nutrient calculation, and vendor SKU costing | `/recipes`, `/api/recipes` | Chefs & Kitchen Staff |
| **Dietary & Nutrition Engine** | Macro/micronutrient aggregation (Calories, Protein, Carbs, Fat, Sodium, Potassium, Phosphorus, Fiber) and clinical diet order constraint solver | `/api/recipes/analyze-nutrition`, `/api/ehr/nutrients/usda` | Clinical Dietitians & RDs |
| **MRP & BOM Purchasing** | Multi-level Bill of Materials explosion, on-hand inventory depletion, multi-distributor lowest-cost split order generator | `/purchasing`, `/api/purchasing/mrp-order` | Dietary Managers |
| **3-Way Invoice Match** | PO vs Dock Receiving vs Invoiced price/quantity variance detection and automated vendor credit memos | `/purchasing`, `/api/purchasing/invoices/match` | Dietary Managers & AP |
| **Daily Cook Sheets** | Real-time meal tallies, modifiers, alternatives, and station prep worksheets | `/kitchen/sheet`, `/api/kitchen/sheet` | Line Cooks |
| **Production Sheets** | Station batch scaling (Hot Line, Cold Prep, Puree Station, Bakery) with HACCP temperature limits | `/production`, `/api/production` | Cooks & Managers |
| **Tray Cards & Service** | High-contrast resident meal tickets with signed QR tokens, red allergen alert banners, and IDDSI texture color banners | `/kitchen/traycards`, `/api/kitchen/traycards-generated` | Dietary Servers |
| **Distributor Portal** | Vendor portal for distributor sales reps to update SKUs and contract pricing without PHI access | `/distributor`, `/api/distributor` | Food Distributor Reps |
| **Cost & Compliance** | Food cost ($/CPD), total dietary operating cost (food + labor), substitution log, and 1-click survey print sheet | `/reporting`, `/api/reporting` | Administrators & Inspectors |
| **CMS-2567 Survey Binder** | Automated compliance cross-walk auditing Federal F-Tags (F800–F812), 14-hr meal timing spans, 90-day HACCP logs | `/reporting`, `/api/reporting/cms-survey-export` | State Surveyors & RDs |

---

## 4. Algorithmic Engines

### 4.1 Deterministic Clinical Safety Rules Engine (`server/src/engine/safetyEvaluator.ts`)
- **Strict NPO Lockout**: Non-overridable `BLOCK` on any oral food or beverage dispatch when resident is designated NPO.
- **Canonical Allergen Intersection**: Scans Big 9 allergens (Gluten, Dairy, Eggs, Peanuts, Tree Nuts, Soy, Fish, Shellfish, Sesame) and flags cross-contact risk.
- **IDDSI Food & Liquid Texture Compatibility**: Strict matrix enforcement between resident prescription (Pureed L4, Minced L5, Soft L6, Regular L7) and recipe textures.
- **Therapeutic Nutrient Ceilings**: Hard limits for NAS Sodium ($\le 600\text{mg}$), Diabetic Carbs ($\le 60\text{g}$), and Renal Potassium/Phosphorus.

### 4.2 Universal Culinary Unit Conversion Engine (`server/src/engine/units.ts`)
- **Universal Matrix**: Exact bidirectional conversions across Mass (`g`, `kg`, `oz`, `lb`), Volume (`ml`, `l`, `tsp`, `tbsp`, `fl oz`, `cup`, `pt`, `qt`, `gal`), and Foodservice Counts (`#10 can`, `case`, `pack`, `bag`, `slice`, `portion`).
- **Density Awareness**: Volume-to-mass conversions based on ingredient specific gravities (flours, sugars, butter, liquids, purees).

### 4.3 Multi-Distributor Split MRP Engine (`server/src/engine/mrp.ts`)
- **BOM Multi-Level Explosion**:
  $$\text{Ingredient Requirement (g)} = \sum_{\text{Meals}} \left( \text{Resident Headcount} \times \text{Choice \%} \times \frac{\text{Scaled Portions}}{\text{Base Yield}} \times \text{Ingredient Base Qty (g)} \right)$$
- **Multi-Vendor Pricing Comparator**: Compares competing catalog quotes across Dennis, Sysco, and US Foods, computes effective unit costs ($/\text{lb}$ or $/\text{g}$), and generates optimal split PO proposals aligned with delivery lead times.

### 4.4 Three-Way Invoice Match Engine (`server/src/engine/invoicing.ts`)
- **Price Creep Detection**: Identifies unit price inflation exceeding purchase order contract rates.
- **Short-Shipment Calculation**: Evaluates receiving dock verified counts against billed quantities.
- **Automated Credit Memos**: Generates formal vendor credit deduction claims for immediate accounting processing.

### 4.5 CMS-2567 Survey Compliance Cross-Walk (`server/src/engine/cmsSurvey.ts`)
- **Federal F-Tag Audit**: Cross-walks operations against F800, F801, F803, F804, F805, F808, F809, and F812.
- **14-Hour Span Rule (F809)**: Audits elapsed hours between evening dinner service and next morning breakfast ($\le 14\text{h}$, or $\le 16\text{h}$ with bedtime snack).
- **90-Day Temperature Integrity**: Verifies HACCP hot ($\ge 140^\circ\text{F}$) and cold ($\le 41^\circ\text{F}$) holding log compliance.

---

## 5. Performance, Caching & Resilience Infrastructure

### 5.1 In-Memory LRU Cache & Conditional ETags (`server/src/middleware/cache.ts`)
- Sub-millisecond cached reads with tag-based invalidation.
- Generates cryptographic `ETag` headers and evaluates incoming `If-None-Match` requests, returning **`304 Not Modified` with 0 bytes transferred** when data is unchanged.

### 5.2 Tri-State Circuit Breakers (`server/src/middleware/circuitBreaker.ts`)
- Protects external distributor and clinical EHR APIs from network timeouts.
- State Machine: `CLOSED` $\xrightarrow{\text{Failures} \ge 3}$ `OPEN (Fast-fail with fallback)` $\xrightarrow{\text{10s Timeout}}$ `HALF_OPEN (Trial)`.

### 5.3 In-Flight Request Deduplication (`server/src/middleware/dedup.ts`)
- Coalesces simultaneous identical requests from multiple kitchen tablets into a single database/engine execution.

### 5.4 Client Hybrid SWR Cache (`src/lib/cacheManager.ts`)
- Instant 0ms UI rendering from memory + IndexedDB with silent background network revalidation.

---

## 6. Security & Technical Safeguards (HIPAA Aligned)

- **10-Minute Idle Auto-Logout**: Automatic session invalidation protecting resident Protected Health Information (PHI) on shared workstations (`AuthContext.tsx`).
- **Password Hardening**: Minimum 12 characters requiring uppercase, lowercase, numbers, and special symbols.
- **Audit Log Immutability**: Append-only PostgreSQL triggers (`trg_prevent_audit_log_update` and `trg_prevent_audit_log_delete`) preventing modification of audit records.
- **Distributor PHI Isolation**: Distributor partner accounts are cryptographically restricted from viewing resident clinical records or dietary orders.
- **Network Security**: Strict Content Security Policy (CSP), HSTS preload, X-Frame-Options Deny, and rate limiting via Helmet.
