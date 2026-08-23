# TODO — ShorelineOps Roadmap & Active Work

## ✅ V1 Milestones (Completed & Verified)
- [x] **Resident Manager**: Complete profile, diet orders (NAS, NCS, Renal), IDDSI texture requirements, allergies, beverage flags, supplements, and dining room table assignments.
- [x] **Weekly Menu Planner**: 4-week cycle menus, Choice A/B meal slots, active week flagging, and printable menu views.
- [x] **Smart Recipe Book**: Base recipe management, ingredient lists, prep instructions, batch yield scaling, **automatic ingredient keyword allergen auto-detection**, and vendor SKU cost linking.
- [x] **Kitchen Tablet Mode (`/kitchen/tablet`)**: Touch-optimized interface for kitchen touchscreens with batch cook worksheets, card-by-card tray dispatch, and rapid par count steppers (`+`/`-`).
- [x] **Daily Kitchen Sheets & Tally Entry**: Real-time meal tallies, modifiers, alternatives, and production sheets.
- [x] **Meal Service & Tray Cards**: High-contrast printable tray cards and digital tickets with bold red allergy warnings.
- [x] **Purchasing & Order Guide (V1)**: Distributor-agnostic module with Dennis Food Service reference adapter, standing par levels, on-hand count tracking, suggested order generator (`Par - Count`), and Dennis CSV export.
- [x] **Distributor Partner Portal (`/distributor`)**: Secure vendor portal for distributor reps to manage item SKUs and contract pricing without PHI access.
- [x] **Cost & Compliance Reporting (V1)**: Real-time Food Cost per Resident Day ($/CPD), Total Dietary Operating Cost (Food + Labor), meal substitution logs, and 1-click state compliance summary print sheets.
- [x] **Technical Security & Compliance**: 10-minute idle auto-logout, 12-char complex passwords, append-only PostgreSQL audit log immutability triggers, and Helmet CSP/HSTS headers.
- [x] **Commercial & Legal Packaging**: Master Services Agreement template, BAA integration, 5-minute live sales demo script, onboarding templates, and ROI pitch deck.
- [x] **Astro Marketing Site (`/marketing`)**: High-converting Astro + Tailwind marketing site featuring founder-chef positioning and pricing tiers.

---

## ✅ V2 Milestones — Distributor Ecosystem (Completed)
- [x] **Distributor Connector Interface**: Generic `DistributorConnector` specification (`getCatalog`, `importOrderGuide`, `calculateSuggestedOrder`, `exportOrder`).
- [x] **Dennis Food Service Adapter (`DennisConnector`)**: Implementation with broadline catalog sync and Dennis-formatted CSV order exports.
- [x] **Multi-Distributor Support (`SyscoConnector` & `UsFoodsConnector`)**: Implemented in `server/src/integrations/broadline.ts` with custom CSV order formats.
- [x] **Real-Time Customer Pricing Sync**: Contract pricing resolution via `getCustomerPricing(accountId)`.
- [x] **Live Inventory & Item Availability**: Real-time stock status and restock estimates via `getAvailability(accountId)`.

---

## ✅ V3 Milestones — Clinical EHR Integration (Completed)
- [x] **Generic EHR Connector Specification (`EhrConnector`)**: FHIR-shaped models for resident census, diet order changes, texture updates, and meal validation.
- [x] **PointClickCare Inbound Sync Adapter (`PointClickCareConnector`)**: Implemented in `server/src/integrations/pointclickcare.ts` for automated ADT and diet order ingestion.
- [x] **Dynamic Meal Validation**: Automated detection of menu item conflicts when a resident's diet order changes (allergies, IDDSI puree, NCS, NAS).
- [x] **Nutritional Analysis Engine**: Therapeutic macronutrient compliance engine (calories, protein, carbs, fat, sodium) per diet order (`POST /api/ehr/nutrients/analyze`).

---

## ✅ V4 Milestones — Nutrition Engine & Offline Ecosystem (Completed)
- [x] **USDA FoodData Central Connector (`server/src/integrations/usda.ts`)**: Food composition database integration, nutrient breakdown (Calories, Protein, Carbs, Fat, Sodium, Fiber, Potassium), and clinical compliance checks (`POST /api/ehr/nutrients/usda`).
- [x] **Clinical Dietary Demand & Smart Ordering Engine (`server/src/integrations/dietaryDemand.ts`)**: Dynamic census scaling connecting active resident therapeutic diets (NAS, NCS, Pureed/Thickened IDDSI) directly to vendor PO generation (`POST /api/purchasing/clinical-suggested-order`).
- [x] **Kitchen Tablet Offline Mutation Queue (`src/lib/offlineQueue.ts`)**: IndexedDB persistent storage and sync queue for tray dispatches, temperature logs, and par adjustments during network interruptions.
- [x] **Comprehensive End-to-End System Test Suite (`server/src/system.test.ts`)**: 23 automated tests covering Security, Multi-Distributor Connectors (Dennis, Sysco, US Foods), EHR Inbound Sync (PointClickCare), USDA Nutrition, and Census-Driven Smart Ordering.


## ✅ V5 Milestones — Unified Dietary, Recipe MRP & Tray Service Engine (Completed & Verified)
- [x] **Unit Conversion & Density Matrix Engine (`server/src/engine/units.ts`)**: Pure mathematical conversions for Mass (g, kg, oz, lb), Volume (ml, l, tsp, tbsp, fl oz, cup, pt, qt, gal), Counts (#10 cans, cases, bags, portions), and density-aware liquid/flour transforms.
- [x] **Dietary Nutritional & Clinical Constraint Solver (`server/src/engine/nutrition.ts`)**: Automated Big 9 allergen scanning, institutional macro & micronutrient calculation, and therapeutic diet constraint checking (NAS, NCS, Renal, Cardiac, High Protein, IDDSI purees).
- [x] **Material Requirements Planning (MRP) & BOM Explosion (`server/src/engine/mrp.ts`)**: Multi-level Bill of Materials explosion converting cycle menus $\times$ resident census $\rightarrow$ raw ingredient demand $\rightarrow$ inventory stock depletion $\rightarrow$ distributor case-pack purchase orders (`POST /api/purchasing/mrp-order`).
- [x] **Kitchen Batch Production & Station Scaling (`server/src/engine/production.ts`)**: Automated station worksheets (Hot Line, Cold Prep, Puree Station, Bakery) with 165°F HACCP core food safety temperature enforcement.
- [x] **Dynamic Clinical Tray Card Generator (`server/src/routes/kitchen.ts`)**: High-contrast meal service tickets with resident room, table, diet orders, bold red allergen warnings, and IDDSI texture color banners (`GET /api/kitchen/traycards-generated`).
- [x] **Master Recipes API & Schema (`server/src/routes/recipes.ts`, Migration 012)**: Persistent backend CRUD with automated nutrient calculation, allergen auto-tagging, and client Zustand store synchronization (`src/state/recipesStore.ts`).
- [x] **Comprehensive End-to-End System Test Suite (`server/src/system.test.ts`)**: 42/42 automated unit and integration tests passing with 100% success rate across all 9 subsystems.

## ✅ V6 Milestones — Multi-Tier Caching, Circuit Breakers & Network Safeguards (Completed & Verified)
- [x] **In-Memory LRU Cache & Conditional ETag Engine (`server/src/middleware/cache.ts`)**: Low-latency LRU memory cache with TTL, tag-based invalidation, and HTTP conditional `ETag` / `If-None-Match` evaluation returning `304 Not Modified` with 0 bandwidth for unchanged data.
- [x] **Circuit Breaker State Machine & Timeout Wrapper (`server/src/middleware/circuitBreaker.ts`)**: Tri-state circuit breaker (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF_OPEN`) protecting external EHR and distributor APIs from slow networks and downstream timeouts.
- [x] **In-Flight Request Deduplication Engine (`server/src/middleware/dedup.ts`)**: Coalesces concurrent simultaneous requests into a single database/engine execution, eliminating thread starvation during shift start.
- [x] **Client-Side Hybrid SWR Cache Manager (`src/lib/cacheManager.ts`)**: Stale-While-Revalidate caching combining memory + IndexedDB for 0ms instant tablet UI rendering and silent background network revalidation.
- [x] **Comprehensive End-to-End System Test Suite (`server/src/system.test.ts`)**: **52/52 automated tests passing with 100% success rate** across all 10 operational subsystems.

---

## 🌐 Next Roadmap & Future Architecture
- [ ] Monorepo package restructuring (`apps/shoreline-web`, `apps/shoreline-api`, `packages/domain`, `packages/db`, `packages/integrations`).
- [ ] Third-party open plugin marketplace UI for community distributor connectors.

