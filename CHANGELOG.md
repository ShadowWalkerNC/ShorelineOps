# Changelog — ShorelineOps

All notable changes to the ShorelineOps platform are documented in this file.

---

## [v6.0.0] — 2026-08-23
### Added
- **Multi-Tier LRU Caching & Conditional ETags** (`server/src/middleware/cache.ts`):
  - In-memory LRU cache with configurable TTL and tag-based invalidation.
  - Generates cryptographic `ETag` hashes on JSON payloads and evaluates incoming `If-None-Match` requests, returning `304 Not Modified` with 0 bytes transferred.
- **Tri-State Circuit Breakers** (`server/src/middleware/circuitBreaker.ts`):
  - Protects external EHR (PointClickCare) and distributor APIs against slow network timeouts and service outages with automated fast-failing and cached fallback data.
- **In-Flight Request Deduplication** (`server/src/middleware/dedup.ts`):
  - Coalesces simultaneous identical requests from multiple kitchen tablets into a single database/engine execution.
- **Client Hybrid SWR Cache Manager** (`src/lib/cacheManager.ts`):
  - In-memory + IndexedDB persistent cache providing 0ms instant UI rendering on tablet boot with silent background network revalidation.
- **Exhaustive Automated Test Suite** (`server/src/system.test.ts`):
  - Extended to **52/52 automated tests** with 100% pass rate.

---

## [v5.0.0] — 2026-08-23
### Added
- **Universal Culinary Unit Conversion Engine** (`server/src/engine/units.ts`):
  - Bidirectional conversions across mass, volume, and foodservice counts (#10 cans, cases, bags, portions) with ingredient density awareness.
- **Dietary Nutritional Engine & Clinical Constraint Solver** (`server/src/engine/nutrition.ts`):
  - Macro/micronutrient calculation (Calories, Protein, Carbs, Fat, Sodium, Potassium, Phosphorus, Fiber) and Big 9 allergen scanning.
  - Clinical constraint solver for NAS, Low Sodium, NCS/Diabetic, Renal, Cardiac, and IDDSI Dysphagia levels 3-7.
- **Material Requirements Planning (MRP) & BOM Explosion Engine** (`server/src/engine/mrp.ts`):
  - Explodes scheduled cycle menus across resident headcounts to compute raw ingredient demand and distributor case-pack purchase orders (`POST /api/purchasing/mrp-order`).
- **Kitchen Batch Production Scaling** (`server/src/engine/production.ts`):
  - Station worksheets (Hot Line, Cold Prep, Puree Station, Bakery) with 165°F HACCP core food safety temperature enforcement.
- **Dynamic Clinical Tray Card Generator** (`server/src/routes/kitchen.ts`):
  - High-contrast meal tickets with resident room, table, diet orders, bold red allergen warnings, and IDDSI texture color banners (`GET /api/kitchen/traycards-generated`).
- **Master Recipes Schema & REST API** (`server/src/routes/recipes.ts`, Migration 012):
  - Persistent backend CRUD with automated nutrient calculation, allergen auto-tagging, and client Zustand store synchronization (`src/state/recipesStore.ts`).

---

## [v4.0.0] — 2026-08-23
### Added
- **USDA FoodData Central Integration** (`server/src/integrations/usda.ts`):
  - Automated food composition lookup and nutritional breakdown (`POST /api/ehr/nutrients/usda`).
- **Clinical Dietary Demand & Smart Ordering** (`server/src/integrations/dietaryDemand.ts`):
  - Live resident census scaling for vendor order guides (`POST /api/purchasing/clinical-suggested-order`).
- **Kitchen Tablet Offline Mutation Queue** (`src/lib/offlineQueue.ts`):
  - IndexedDB mutation buffer for tray card dispatches, temperature logs, and par adjustments during Wi-Fi drops.

---

## [v3.0.0] — 2026-08-20
### Added
- **Clinical EHR Connector Interface** (`server/src/integrations/ehr.ts`):
  - Generic FHIR-shaped models for resident census, diet order changes, and texture updates.
- **PointClickCare Inbound Sync Adapter** (`server/src/integrations/pointclickcare.ts`):
  - Ingestion of ADT (Admit/Discharge/Transfer) events and clinical meal safety validation.

---

## [v2.0.0] — 2026-08-18
### Added
- **Multi-Distributor Ecosystem**:
  - `DennisConnector`, `SyscoConnector`, and `UsFoodsConnector` with custom CSV order exports.
  - Contract pricing resolution and real-time inventory availability sync.

---

## [v1.0.0] — 2026-08-15
### Added
- Initial release of ShorelineOps:
  - Resident Profile & Diet Order Management.
  - 4-Week Cycle Menu Planner.
  - Kitchen Tablet Mode (`/kitchen/tablet`).
  - Purchasing & Order Guide with Dennis Food Service reference integration.
  - Food Cost per Resident Day ($/CPD) reporting and 1-click state compliance survey print sheets.
  - Append-only PostgreSQL audit log immutability triggers and HIPAA security hardening.
