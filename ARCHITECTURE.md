# ShorelineOps Architecture & Technical Specification

## 1. System Overview

**ShorelineOps** is an open-source dietary operations, clinical nutrition, and healthcare foodservice coordination platform designed specifically for assisted living, memory care, and skilled nursing communities.

Its core operational philosophy is **distributor independence, clinical safety, and real-time operational resilience**:
1. Facilities should never be locked into a single food distributor ERP.
2. Resident diet orders, IDDSI texture requirements, and allergen exclusions drive production, purchasing, and tray delivery.
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
| **Kitchen Tablet Mode** | Touch worksheets, batch yield scaling, temp logs (165°F), tray line dispatch, quick par count steppers | `/kitchen/tablet`, `/api/kitchen` | Line Cooks & Prep Staff |
| **Menu Planner** | 4-week cycle menus, Choice A/Choice B, active cycle week, weekly nutritional audit, print view | `/menu`, `/api/menu` | Dietary Directors |
| **Smart Recipe Book** | Master recipe catalog with automatic Big 9 allergen detection, USDA nutrient calculation, and vendor SKU costing | `/recipes`, `/api/recipes` | Chefs & Kitchen Staff |
| **Dietary & Nutrition Engine** | Macro/micronutrient aggregation (Calories, Protein, Carbs, Fat, Sodium, Potassium, Phosphorus, Fiber) and clinical diet order constraint solver | `/api/recipes/analyze-nutrition`, `/api/ehr/nutrients/usda` | Clinical Dietitians & RDs |
| **MRP & BOM Purchasing** | Multi-level Bill of Materials explosion, on-hand inventory depletion, distributor case-pack purchase orders | `/purchasing`, `/api/purchasing/mrp-order` | Dietary Managers |
| **Daily Cook Sheets** | Real-time meal tallies, modifiers, alternatives, and station prep worksheets | `/kitchen/sheet`, `/api/kitchen/sheet` | Line Cooks |
| **Production Sheets** | Station batch scaling (Hot Line, Cold Prep, Puree Station, Bakery) with HACCP temperature limits | `/production`, `/api/production` | Cooks & Managers |
| **Tray Cards & Service** | High-contrast resident meal tickets with red allergen alert banners and IDDSI texture color banners | `/kitchen/traycards`, `/api/kitchen/traycards-generated` | Dietary Servers |
| **Distributor Portal** | Vendor portal for distributor sales reps to update SKUs and contract pricing without PHI access | `/distributor`, `/api/distributor` | Food Distributor Reps |
| **Cost & Compliance** | Food cost ($/CPD), total dietary operating cost (food + labor), substitution log, and 1-click survey print sheet | `/reporting`, `/api/reporting` | Administrators & Inspectors |

---

## 4. Algorithmic Engines

### 4.1 Unit Conversion & Standard Density Engine (`server/src/engine/units.ts`)
- **Universal Matrix**: Exact bidirectional conversions across Mass (`g`, `kg`, `oz`, `lb`), Volume (`ml`, `l`, `tsp`, `tbsp`, `fl oz`, `cup`, `pt`, `qt`, `gal`), and Foodservice Counts (`#10 can`, `case`, `pack`, `bag`, `slice`, `portion`).
- **Density Awareness**: Volume-to-mass conversions based on ingredient specific gravities (flours, sugars, butter, liquids, purees).

### 4.2 Dietary Nutritional Calculation & Clinical Constraint Solver (`server/src/engine/nutrition.ts`)
- **Nutritional Calculation**: Computes Calories, Protein, Carbs, Fat, Sat Fat, Sodium, Potassium, Phosphorus, Fiber, and Sugar.
- **Clinical Constraint Solver**:
  - **NAS (No Added Salt)**: $\le 600\text{mg}$ sodium/meal, $\le 2000\text{mg}$/day.
  - **Low Sodium Strict**: $\le 500\text{mg}$ sodium/meal, $\le 1500\text{mg}$/day.
  - **NCS (Diabetic)**: $\le 60\text{g}$ carbohydrates/meal.
  - **Renal Diet**: Constrains Sodium, Potassium ($\le 700\text{mg}$), and Phosphorus ($\le 350\text{mg}$).
  - **IDDSI Textures**: Level 4 Pureed, Level 5 Minced & Moist, Level 6 Soft & Bite-Sized, Level 7 Regular.
  - **Allergens**: Scans Big 9 allergens (Gluten, Dairy, Eggs, Nuts, Soy, Fish, Shellfish, Sesame).

### 4.3 Material Requirements Planning (MRP) & BOM Explosion (`server/src/engine/mrp.ts`)
- **BOM Multi-Level Explosion**:
  $$\text{Ingredient Requirement (g)} = \sum_{\text{Meals}} \left( \text{Resident Headcount} \times \text{Choice \%} \times \frac{\text{Scaled Portions}}{\text{Base Yield}} \times \text{Ingredient Base Qty (g)} \right)$$
- **Distributor Case Rounding**: Calculates net deficit against on-hand stock and par levels, packaging reorders into whole distributor case units.

### 4.4 Kitchen Batch Production & Station Routing (`server/src/engine/production.ts`)
- Station worksheets partitioned for `Hot Line` ($165^\circ\text{F}$ HACCP target), `Cold Prep` ($41^\circ\text{F}$), `Puree Station`, and `Bakery`.
- Automatic resident tray card generator with high-contrast clinical safety flags.

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
