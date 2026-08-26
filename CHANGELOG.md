# Changelog — ShorelineOps

All notable changes to the ShorelineOps platform are documented in this file.

---

## [v10.0.0] — 2026-08-26
### Added
- **Corporate Headquarters Multi-Facility Portal** (`/enterprise`, `server/src/routes/enterprise.ts`, `src/state/enterpriseStore.ts`):
  - Centralized portfolio management for senior living chains across 5+ communities.
  - Real-time aggregate census roll-up (325 beds / 309 active census), cross-facility $/CPD spend benchmarking, and 1-click master 4-week seasonal cycle menu syndication.
- **Hands-Free Voice HACCP & CMS F807 Resident Hydration Pass** (`/kitchen/tablet`, `server/src/routes/kitchen.ts`):
  - Web Speech API voice transcription for line cooks logging hot-holding/internal core temperatures hands-free during meal service rushes.
  - Dedicated CMS F807 resident fluid intake tracking pass ensuring regulatory hydration compliance.
- **Open Core Demo Evaluation Sandbox Mode** (`src/security/license.ts`, `src/components/FeatureGate.tsx`):
  - Automatic unlocked evaluation on localhost and demo sandbox URLs (`render.com`, `vercel.app`).
  - Added 1-click **"✨ Enable Demo Sandbox"** activation button in `<FeatureGate>`.
- **Render Production Deployment Fix**:
  - Pinned Node.js 20.14.0 across all 3 services in `render.yaml` and `.node-version`.
  - Corrected Astro static publish path (`dist` with `rootDir: marketing`).
- **Real Production UI Screenshots & Capture Guide** (`docs/SCREENSHOT_CAPTURE_GUIDE.md`, `README.md`):
  - Overhauled `README.md` embedding real UI screenshots of the Executive Dashboard, 4-Week Menu Cycle Planner, Clinical Residents Roster, and Kitchen Tablet Kiosk.
- **Expanded Test Suite (`server/src/system.test.ts`)**:
  - **94/94 automated tests passing (100%)** across 20 operational subsystems.

---

## [v9.0.0] — 2026-08-25
### Added
- **Open Core Licensing & Entitlement Engine** (`src/security/license.ts`, `src/components/FeatureGate.tsx`, `server/src/middleware/requireTier.ts`):
  - 4-tier entitlement system (`community`, `pro`, `enterprise`, `demo`) with cryptographic HMAC token verification (`SH_PRO_...` / `SH_ENT_...`).
  - Gated proprietary endpoints (PointClickCare Live Sync, Multi-Distributor Split MRP, CMS-2567 Survey Binder, 3-Way Invoice Match) with HTTP 402 `LICENSE_TIER_REQUIRED`.
  - Apple HIG `<FeatureGate>` upgrade cards embedded in client features for self-hosted community operators.
- **shadcn/ui Component Library Integration** (`src/components/ui/`):
  - Accessible Radix UI primitives (`Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Input`, `Select`, `Switch`, `Separator`, `Avatar`) with CVA and Tailwind CSS variables.
  - Added `src/lib/utils.ts` (`cn()`) and `components.json` for shadcn CLI workflows.
- **Facility & Operations Settings Page** (`src/features/settings/SettingsPage.tsx`, `src/state/settingsStore.ts`):
  - 5-tab configuration center for Facility Profile, Residential Wings & Dining Locations, Clinical & Dietary Standards, Broadline Distributors, and HIPAA Security / Licensing.
- **Distributor & Vendor Portal Overhaul** (`src/features/distributor/DistributorPortalPage.tsx`):
  - Multi-distributor switcher (Dennis, Sysco, US Foods, Gordon), telemetry metrics, and item master publisher.
- **Autonomous Dietary Operations Consultant Engine** (`dietary_operations_consultant`, `scripts/operations_consultant_audit.js`):
  - Automated operational stress-testing engine (`npm run audit:operations`) and master log (`docs/DAILY_OPERATIONS_AUDIT.md`) with daily scheduled cron workflow.
- **UI/UX Design System Unification**:
  - Unified Astro marketing portal and React web application with identical Apple HIG frosted glass header navigation, typography, system colors, and card layouts.

---

## [v8.0.0] — 2026-08-24
### Added
- **Deterministic Clinical Safety Rules Engine** (`server/src/engine/safetyEvaluator.ts`):
  - Non-overridable hard-blocks for strict NPO, canonical Big 9 allergen intersections with cross-contact risk, IDDSI food & liquid compatibility matrices, and therapeutic nutrient ceilings.
- **Signed QR Tokens & Assembly Verification Scanner** (`server/src/routes/kitchen.ts`, `src/features/kitchen/components/TrayAssemblyScanner.tsx`):
  - Cryptographic token generation (`ticketId:profileVersion:hash`) on physical tray cards with active scanner lockout for superseded stale diet orders or NPO residents with Web Audio synthesis and haptic feedback.
- **Recipe Variant Graph Explosion** (`server/src/engine/production.ts`):
  - Explodes base recipes into Regular, Pureed L4, Minced & Moist L5, Low Sodium, and Carb-Controlled prep sheets with pan layouts.
- **Multi-Distributor Split MRP Comparator** (`server/src/engine/mrp.ts`):
  - Lowest-cost vendor quotation evaluation (Dennis vs Sysco vs US Foods) with case-pack rounding, lead time alignment, and split PO proposals.
- **Three-Way Invoice Match Engine & Credit Memos** (`server/src/engine/invoicing.ts`, `server/src/routes/purchasing.ts`):
  - Line-item price creep detection and short-shipped case tracking with automated vendor credit memo generation.
- **PointClickCare Inbound Reconciliation Exception Queue** (`server/src/integrations/pointclickcare.ts`, `server/src/routes/ehr.ts`, `src/features/residents/EhrReconciliationQueue.tsx`):
  - Registered Dietitian clinical triage gate preventing unmapped or conflicting EHR diet/texture orders from failing silently.
- **CMS-2567 Digital Survey Binder Generator** (`server/src/engine/cmsSurvey.ts`, `server/src/routes/reporting.ts`):
  - Audits 14-hour dinner-to-breakfast meal span (F809), 90-day HACCP holding temperatures, and exports printable 1-click Markdown survey binders.
- **Exhaustive Automated System Test Suite** (`server/src/system.test.ts`):
  - Extended to **89/89 automated tests** with 100% pass rate.

---

## [v7.0.0] — 2026-08-24
### Added
- **Turborepo Workspace Monorepo** (`turbo.json`):
  - Configured npm workspaces (`server`, `marketing`) and Turborepo caching pipelines for unified build orchestration.
- **Autonomous Self-Healing Bot Daemon** (`server/src/agent/healer.ts`):
  - Diagnostic auditor inspecting database health, LRU cache memory, active census, and HACCP compliance logs.
- **Community Distributor Marketplace Registry** (`src/features/distributor/CommunityPluginRegistry.tsx`):
  - Open pluggable distributor marketplace for Dennis, Sysco, US Foods, GFS, PFG, and local farm co-ops.
- **Model Context Protocol (MCP) Server** (`server/src/mcp/server.ts`):
  - 5 high-leverage MCP tools enabling autonomous AI agent dietary auditing and MRP replenishment.

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
