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

---

## ✅ V5 Milestones — Unified Dietary, Recipe MRP & Tray Service Engine (Completed & Verified)
- [x] **Unit Conversion & Density Matrix Engine (`server/src/engine/units.ts`)**: Pure mathematical conversions for Mass (g, kg, oz, lb), Volume (ml, l, tsp, tbsp, fl oz, cup, pt, qt, gal), Counts (#10 cans, cases, bags, portions), and density-aware liquid/flour transforms.
- [x] **Dietary Nutritional & Clinical Constraint Solver (`server/src/engine/nutrition.ts`)**: Automated Big 9 allergen scanning, institutional macro & micronutrient calculation, and therapeutic diet constraint checking (NAS, NCS, Renal, Cardiac, High Protein, IDDSI purees).
- [x] **Material Requirements Planning (MRP) & BOM Explosion (`server/src/engine/mrp.ts`)**: Multi-level Bill of Materials explosion converting cycle menus $\times$ resident census $\rightarrow$ raw ingredient demand $\rightarrow$ inventory stock depletion $\rightarrow$ distributor case-pack purchase orders (`POST /api/purchasing/mrp-order`).
- [x] **Kitchen Batch Production & Station Scaling (`server/src/engine/production.ts`)**: Automated station worksheets (Hot Line, Cold Prep, Puree Station, Bakery) with 165°F HACCP core food safety temperature enforcement.
- [x] **Dynamic Clinical Tray Card Generator (`server/src/routes/kitchen.ts`)**: High-contrast meal service tickets with resident room, table, diet orders, bold red allergen warnings, and IDDSI texture color banners (`GET /api/kitchen/traycards-generated`).
- [x] **Master Recipes API & Schema (`server/src/routes/recipes.ts`, Migration 012)**: Persistent backend CRUD with automated nutrient calculation, allergen auto-tagging, and client Zustand store synchronization (`src/state/recipesStore.ts`).

---

## ✅ V6 Milestones — Multi-Tier Caching, Circuit Breakers & Network Safeguards (Completed & Verified)
- [x] **In-Memory LRU Cache & Conditional ETag Engine (`server/src/middleware/cache.ts`)**: Low-latency LRU memory cache with TTL, tag-based invalidation, and HTTP conditional `ETag` / `If-None-Match` evaluation returning `304 Not Modified` with 0 bandwidth for unchanged data.
- [x] **Circuit Breaker State Machine & Timeout Wrapper (`server/src/middleware/circuitBreaker.ts`)**: Tri-state circuit breaker (`CLOSED` $\rightarrow$ `OPEN` $\rightarrow$ `HALF_OPEN`) protecting external EHR and distributor APIs from slow networks and downstream timeouts.
- [x] **In-Flight Request Deduplication Engine (`server/src/middleware/dedup.ts`)**: Coalesces concurrent simultaneous requests into a single database/engine execution, eliminating thread starvation during shift start.
- [x] **Client-Side Hybrid SWR Cache Manager (`src/lib/cacheManager.ts`)**: Stale-While-Revalidate caching combining memory + IndexedDB for 0ms instant tablet UI rendering and silent background network revalidation.

---

## ✅ V7 Milestones — Turborepo Monorepo, CMS-2567 & Open Marketplace (Completed & Verified)
- [x] **Turborepo Workspace Pipeline (`turbo.json`)**: Configured monorepo task pipeline for client, server, and marketing workspace builds (`npm run build:all`).
- [x] **CMS-2567 Dietary Survey Ready Cross-Walk (`server/src/engine/cmsSurvey.ts`)**: Automated state health survey inspection audit engine mapping Federal F-Tags F800–F812 (`GET /api/reporting/cms-survey-export`).
- [x] **Community Distributor Marketplace (`src/features/distributor/CommunityPluginRegistry.tsx`)**: Open pluggable registry for Dennis, Sysco, US Foods, GFS, PFG, and local dairy cooperatives.

---

## ✅ V8 Milestones — Enterprise Competitive Dominance Overhaul (Completed & Verified)
- [x] **Phase 1: Safety & Tray Line Execution (Computrition HS onTray / CBORD NetMenu Parity)**:
  - Deterministic Clinical Safety Rules Engine (`server/src/engine/safetyEvaluator.ts`): Non-overridable hard-blocks for strict NPO, Big 9 allergen intersections with cross-contact risk, IDDSI food & liquid texture compatibility matrices, and therapeutic nutrient ceilings.
  - Signed QR Tokens & Version Control: Tray cards embed cryptographic tokens (`ticketId:profileVersion:hash`).
  - Scan Verification Endpoint (`POST /api/kitchen/verify-tray-scan`): Server validates card version against resident profile version; halts stale tickets (`SUPERSEDED`) or NPO designations (`NPO_ALERT`).
  - Interactive Tray Assembly Scanner UI (`src/features/kitchen/components/TrayAssemblyScanner.tsx`): Sound/buzzer synthesis + haptic vibration feedback for kitchen tablets.
- [x] **Phase 2: Kitchen Production & Multi-Distributor Split MRP (Sysco IMPAC / FOOD-TRAK Parity)**:
  - Recipe Variant Graph Explosion (`server/src/engine/production.ts`): Base recipes dynamically explode into Regular, Pureed L4, Minced & Moist L5, Low Sodium, and Carb-Controlled prep sheets with pan layouts.
  - Multi-Distributor Lowest-Cost Comparator (`server/src/engine/mrp.ts`): Compares item quotes across Dennis, Sysco, and US Foods, computes effective unit costs, and generates split PO proposals.
- [x] **Phase 3: Spend Management & 3-Way Invoice Matching (DiningRD VendorSync Parity)**:
  - Three-Way Match Engine (`server/src/engine/invoicing.ts`): Computes line-item price creep variance and dock short-ship quantities between PO, receiving dock, and distributor invoices.
  - Automated Vendor Credit Memos (`POST /api/purchasing/invoices/match`, `GET /api/purchasing/credit-memos`): Automatically generates formatted credit memo deduction claims.
- [x] **Phase 4: Enterprise Scale & Survey Readiness (MealSuite Connect / DiningRD Parity)**:
  - PointClickCare Inbound Reconciliation Exception Queue (`server/src/integrations/pointclickcare.ts`, `server/src/routes/ehr.ts`): Registered Dietitian triage gate (`src/features/residents/EhrReconciliationQueue.tsx`) preventing unmapped or conflicting EHR diet/texture orders from failing silently.
  - Enhanced CMS-2567 Digital Survey Binder (`server/src/engine/cmsSurvey.ts`): Audits 14-hour dinner-to-breakfast span (F809), 90-day HACCP holding temperatures, and exports printable 1-click Markdown survey binders.
- [x] **Comprehensive End-to-End System Test Suite (`server/src/system.test.ts`)**: **89/89 automated tests passing with 100% success rate** across all 18 operational subsystems.

---

## ✅ V9 Milestones — Open Core Licensing, shadcn/ui & Operations Consultant (Completed & Verified)
- [x] **Open Core Licensing & Entitlement Engine (`src/security/license.ts`, `server/src/middleware/requireTier.ts`)**: Cryptographic HMAC license parsing (`SH_PRO_...` / `SH_ENT_...`), 4-tier model (`community`, `pro`, `enterprise`, `demo`), and `402 LICENSE_TIER_REQUIRED` API protection.
- [x] **shadcn/ui Component Library Integration (`src/components/ui/`)**: Full Radix UI + CVA + Tailwind CSS variables design system with `Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Input`, `Select`, `Switch`, `Separator`, `Avatar`.
- [x] **Facility & Operations Settings (`/settings`, `src/state/settingsStore.ts`)**: Facility profile, residential wings, dining zones, CPD budget solver, meal schedule times, and HIPAA security settings.
- [x] **Distributor & Vendor Portal Overhaul (`/distributor`)**: Multi-distributor switcher (Dennis, Sysco, US Foods, Gordon), telemetry metrics, and item master publisher.
- [x] **Autonomous Dietary Operations Consultant (`dietary_operations_consultant`)**: Automated clinical review engine (`scripts/operations_consultant_audit.js`), master log (`docs/DAILY_OPERATIONS_AUDIT.md`), and daily scheduled cron workflow.
- [x] **Marketing & Web App UI/UX Unification**: Aligned Astro marketing portal and React demo app with identical Apple HIG frosted glass headers, typography, and card components.

---

## ✅ V10 Milestones — Multi-Facility Enterprise, Voice HACCP & Real UI Assets (Completed & Verified)
- [x] **Corporate Headquarters Multi-Facility Portal (`/enterprise`, `server/src/routes/enterprise.ts`, `src/state/enterpriseStore.ts`)**: 5-facility portfolio view, active census roll-up (325 beds / 309 active census), cross-network $/CPD spend benchmarking, and 1-click cycle menu syndication.
- [x] **Hands-Free Voice HACCP & CMS F807 Resident Hydration Pass (`/kitchen/tablet`, `server/src/routes/kitchen.ts`)**: Web Speech API speech-to-temp logging and hydration pass tracking.
- [x] **Open Core Evaluation Demo Sandbox Unlock (`src/security/license.ts`, `src/components/FeatureGate.tsx`)**: Unlocked evaluation on demo sites and localhost with 1-click sandbox toggle.
- [x] **Real Visual Assets & Screenshot Capture Master Guide (`docs/SCREENSHOT_CAPTURE_GUIDE.md`, `README.md`)**: Embedded real production screenshots in README.
- [x] **Comprehensive End-to-End System Test Suite (`server/src/system.test.ts`)**: **94/94 automated tests passing with 100% success rate** across all 20 operational subsystems.

---

## 🏆 Project Status: All Milestones & Stages 100% Complete & Production Ready
- [x] Core Clinical Care & Resident Operations (`/residents`)
- [x] 4-Week Seasonal Cycle Menu Planning (`/menu`)
- [x] Smart Master Recipe Book & Allergen Auto-Scanner (`/recipes`)
- [x] Touch Kitchen Tablet Kiosk & Voice HACCP 165°F Logger (`/kitchen/tablet`)
- [x] Material Requirements Planning (MRP) BOM Purchasing (`/purchasing`)
- [x] Clinical EHR & PointClickCare Sync (`/api/ehr`)
- [x] Model Context Protocol (MCP) Server for CulinaryOS (`/api/mcp`)
- [x] Autonomous Self-Healing Bot Daemon (`/api/mcp/diagnostics/self-healing`)
- [x] CMS-2567 Federal Dietary Survey Cross-Walk Audit Pack (`/api/reporting/cms-survey-export`)
- [x] Pluggable Community Distributor Marketplace (`/distributor`)
- [x] Deterministic Clinical Safety & NPO Hard-Blocks (`/api/kitchen/verify-tray-scan`)
- [x] 3-Way Invoice Matching & Vendor Credit Memos (`/api/purchasing/invoices/match`)
- [x] Inbound EHR Clinical Triage Queue (`/api/ehr/reconciliation-queue`)
- [x] Open Core Tier Separation & FeatureGate Protection (`/settings`, `src/components/FeatureGate.tsx`)
- [x] Facility & Operations Settings (`/settings`)
- [x] Corporate Headquarters Multi-Facility Portal (`/enterprise`, `/api/enterprise`)
- [x] Autonomous Operations Consultant Audit Engine (`npm run audit:operations`)
