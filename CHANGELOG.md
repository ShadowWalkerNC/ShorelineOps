# Changelog — ShorelineOps

All notable changes to the ShorelineOps platform are documented in this file.

---

## [v6.4.0] — 2026-09-18
### Added & Enhanced
- **Enterprise TypeScript SDK Expansion (`@shoreline/sdk` v0.2.0)**:
  - Expanded `ShorelineClient` with 8 new methods covering the complete operational surface:
    - `evaluateInvoiceMatch`: 3-way match across PO contract, dock receiving, and distributor invoice.
    - `getReconciliationQueue` & `resolveReconciliationItem`: Inbound EHR triage queue with Registered Dietitian decision audit trail.
    - `logHaccpTemperature` & `getHaccpSchedule`: Hardware-integrated temperature monitoring with mandatory corrective action enforcement.
    - `importCensusCsv`: Role-gated bulk resident roster & clinical diet order importer.
    - `getTrayRuns` & `recordTrayEvent`: Real-time tray line assembly, dispatch, and delivery SLA tracking.
    - `analyzeRecipeNutrition` & `getRecipe`: Automated macro/micronutrient calculation and recipe bill-of-materials.
  - Published comprehensive `sdk/README.md` and updated `docs/SDK_REFERENCE.md` with full code examples.
- **Search Engine Optimization & Healthcare Geolocation** (`marketing/src/layouts/BaseLayout.astro`):
  - Injected OpenGraph and Twitter Card metadata across all marketing views.
  - Added geographic coordinates for Portland, Maine coastal senior living origin (`geo.region: US-ME`, `geo.placename: Portland, Maine`, `geo.position: 43.6591;-70.2568`, `ICBM`).
  - Added schema.org JSON-LD structured data for `SoftwareApplication` and `MedicalBusiness`.
- **Public Healthcare Legal & Policy Suite** (`marketing/src/pages/`):
  - `/terms`: Master Services Agreement (MSA), Open Core licensing architecture, and deterministic clinical safety disclaimer.
  - `/privacy`: Healthcare Privacy Policy, HIPAA Business Associate Agreement (BAA) provisions, and strict zero-resale policy.
  - `/security`: Technical Security Whitepaper, SOC 2 Type II controls mapping, and 99.9% uptime Service Level Agreement (SLA).
- **Repository-Wide Legal & Policy Normalization**:
  - Replaced all placeholder tokens across `TERMS.md`, `PRIVACY.md`, `BAA.md`, `HIPAA_NOTICE.md`, `AUP.md`, and `src/pages/Legal.tsx` with verified Portland, Maine headquarters and privacy officer contacts.
  - Enforced 100% emoji-free compliance across `README.md` and documentation with updated 207/207 test badges.
- **Section 31 System Integration Test Suite Expansion** (`server/src/system.test.ts`):
  - Added Section 31 tests covering client SDK serialization, error status mapping, and endpoint routing: **207/207 tests passing 100%**.

---

## [v6.3.0] — 2026-09-18
### Added & Hardened
- **IDDSI 2.0 Hard Safety Hold & Big 9 Allergens** (`src/types/resident.ts`, `server/src/engine/production.ts`):
  - Replaced unsafe Level 7 Regular fallback with clinical hard-stop (`level: -1, label: 'UNASSIGNED — CONFIRM WITH DIETARY'`).
  - Added full FDA FASTER Act Big 9 major food allergen taxonomy + adaptive equipment options.
  - Implemented IDDSI drink thickness levels 0–4 (`Thin`, `Slightly Thick`, `Mildly Thick`, `Moderately Thick`, `Extremely Thick`).
- **NPO Tray Line Production Hard-Block** (`src/features/kitchen/KitchenSheetPage.tsx`):
  - Excluded NPO residents from cookable batch tray totals (`members.filter(m => !m.isNpo)`).
  - Added dedicated NPO exclusion badge and AlertTriangle iconography (100% emoji-free).
- **PointClickCare Inbound Webhook Ingestion into RD Triage Queue** (`server/src/routes/ehr.ts`):
  - Connected `POST /api/ehr/webhook` to `pcc.evaluateInboundTriage()`.
  - Automatically queries existing resident records and stores inbound NPO changes, texture downgrades, diet order modifications, and new allergens in `ehr_reconciliation_queue` with `status = 'PENDING_TRIAGE'`.
- **HIPAA PHI Cache Bypass & Private Cache-Control** (`server/src/index.ts`, `server/src/middleware/cache.ts`):
  - Removed HTTP caching from `/api/residents` so every access to resident PHI is audited in `audit_log`.
  - Upgraded cache control headers from `public` to `private, max-age=${ttlSeconds}, must-revalidate` and isolated cache keys with tenant `facilityId`.
- **PostgreSQL Fail-Closed Split-Brain Prevention** (`server/src/db/pool.ts`):
  - Removed permanent local SQLite downgrade on transient PostgreSQL connection errors, failing closed and throwing errors to preserve database integrity.
- **Three-Way Invoice Match REST API Endpoint** (`server/src/routes/purchasing.ts`, `server/src/engine/invoicing.ts`):
  - Exposed `POST /api/purchasing/invoices/evaluate` powered by `ThreeWayInvoiceMatchingEngine`.
  - Evaluates line-by-line price variances, quantity shortages, compound variances, and auto-generates vendor credit memo requests.
- **Kitchen Kiosk Bluetooth LE Probe & Hands-Free Web Speech API Voice Logging** (`src/features/kitchen/TempLogPanel.tsx`):
  - 100% emoji-free interface with Lucide SVG icons.
  - Integrated `WebBluetoothProbeDriver` with 1-click BLE probe pairing and live temperature sync.
  - Integrated Web Speech API for hands-free voice temperature logging ("Tap to Speak Temp") for kitchen tablet kiosks.
- **Marketing Site Apple HIG Design & SVG Icon Overhaul** (`marketing/src/`):
  - Fully emoji-free marketing site with 30+ custom Lucide-style SVG icons (`Icon.astro`) and vendor/regulatory badges (`Logo.astro`).
- **Automated System Test Expansion** (`server/src/system.test.ts`):
  - Added Section 30 tests: **192/192 tests passing 100%**.

---

## [v6.2.0] — 2026-09-05
### Added
- **Stripe Per-Bed / Per-Census Metered Billing Engine** (`server/src/billing/stripeEngine.ts`, `server/src/routes/billing.ts`):
  - Dynamic monthly SaaS rate solver based on facility scale ($1.50 - $2.50 / licensed bed / month).
  - Stripe webhook handler processing `invoice.payment_succeeded` and `invoice.payment_failed`.
- **Administrative Dunning Grace System (Zero Clinical Lockout)** (`src/components/Layout.tsx`, `server/src/billing/stripeEngine.ts`):
  - Hard clinical safety invariant: billing lapses **NEVER** halt tray lines or lockout kitchen staff.
  - Amber administrative banner in top navigation alerting executive staff with 14-day grace window.
- **PostgreSQL Multi-Tenant Context & Row-Level Security Middleware** (`server/src/middleware/tenantContext.ts`):
  - Injects `SET LOCAL app.current_facility_id` from JWT or headers for strict tenant isolation across regional enterprise chains.
- **Corporate Hub-and-Spoke Menu & Recipe Syndication Engine** (`server/src/engine/syndication.ts`):
  - Corporate RD publishes master 4-week cycle menus to spoke facilities with automated 15% $/CPD local substitution tolerance checks.
- **Dual-Transport Model Context Protocol (MCP) Server** (`server/src/routes/mcp.ts`):
  - Server-Sent Events (SSE) stream endpoint (`GET /api/mcp/sse` + `POST /api/mcp/messages`) for remote autonomous hospital bots.
- **High-Frequency Real-Time WebSocket Server** (`server/src/index.ts`):
  - Dedicated `/api/ws/kitchen` upgrade handler for zero-latency tray scan confirmations and probe telemetry.
- **Interactive OpenAPI 3.1 & Swagger UI Spec** (`server/src/docs/openapi.json`, `server/src/index.ts`):
  - Complete REST API specification mounted directly at `/api/docs`.
- **System Test Suite Expansion** (`server/src/system.test.ts`):
  - Expanded test coverage to 132/132 automated tests passing (100% success rate).

---

## [v6.1.0] — 2026-09-05
### Added
- **PointClickCare (PCC) Synthetic FHIR R4 Staging Sandbox** (`server/src/integrations/pccSandbox.ts`):
  - Generates authentic FHIR R4 bundles (`Patient`, `NutritionOrder`, `AllergyIntolerance`) for staging tests without live clinic credentials.
  - Bidirectional parser mapping incoming FHIR clinical diet orders, IDDSI modifiers, and allergen profiles into internal reconciliation models.
- **Clinical 'Hold Tray' Active Hard-Lock** (`server/src/routes/kitchen.ts`, `src/features/kitchen/components/TrayAssemblyScanner.tsx`):
  - Enforces `HOLD_TRAY_RD_SIGNOFF` hard-block when an unverified EHR diet, texture, or NPO change is detected in `ehr_reconciliation_queue`.
  - Immediate audio-visual lockout overlay on gloved line cook tablet kiosks halting tray pass until RD reconciliation.
- **Raw ZPL II TCP Network Socket Driver** (`server/src/hardware/thermalPrint.ts`, `server/src/routes/hardware.ts`):
  - Native 203 DPI ZPL II generator (`^XA ... ^XZ`) for Zebra ZD421/ZD620/ZQ521 thermal printers with dynamic QR magnification and high-contrast allergen warning boxes.
  - Direct network printing via TCP port 9100 with automatic fallback to client-side rendering if network printers are offline.
- **Web Bluetooth API Tablet Kiosk GATT Driver** (`src/features/kitchen/WebBluetoothProbe.ts`):
  - Direct zero-driver browser pairing with Bluetooth LE HACCP probes (ThermoWorks, Inkbird, Govee, and Environmental Sensing GATT `0x181A` / `0x1809`).
- **Turnkey SQLite-to-PostgreSQL Migrator & Docker Compose Stack** (`server/src/db/sqliteToPostgres.ts`, `docker-compose.production.yml`):
  - Streaming migration utility for seamless transition from single-facility offline SQLite to multi-facility Enterprise PostgreSQL.
  - Turnkey production Docker Compose configuration with PostgreSQL 16, healthchecks, and NGINX proxy.
- **Automated Test Suite Expansion** (`server/src/system.test.ts`):
  - Expanded test coverage to 124/124 automated tests passing (100% success rate).

---

## [v6.0.0] — 2026-09-02
### Added
- **TypeScript SDK** (`sdk/`): `@shoreline/sdk` npm package — `ShorelineClient` wrapping the REST API with full TypeScript types. Methods: `getResidents`, `getCensus`, `validateRecipe`, `getMrpSplitPo`, `getCmsSurveyBinder`, `getCostPerResidentDay`, `runHealthCheck`. See `docs/SDK_REFERENCE.md`.
- **Webhook Event System** (`server/src/webhooks/`): HMAC-SHA256 signed POST delivery with 3× exponential backoff. Five typed events: `ehr.triage.pending`, `haccp.temp.violation`, `cpd.variance.alert`, `npo.block.triggered`, `mrp.po.generated`. Full REST management routes. See `docs/WEBHOOKS.md`.
- **Thermal Tray Card Print Engine** (`server/src/hardware/thermalPrint.ts`): `ThermalPrintEngine.printTrayCard()` generates structured 4×6 label zone JSON for Zebra ZD421/ZD620/ZQ521 and Brother QL-1110NWB — includes resident name, diet, IDDSI texture, fluid consistency, allergen banner (bold), QR token, and timestamp zones.
- **Bluetooth HACCP Probe Interface** (`server/src/hardware/bluetoothProbe.ts`): `BluetoothProbeManager` — BLE probe scan, deterministic temperature reads, HACCP log entries, and automatic `haccp.temp.violation` webhook on hot-hold < 140°F / cold-hold > 41°F violations.
- **Hardware API Routes** (`server/src/routes/hardware.ts`): `POST /api/hardware/print/tray-card`, `GET /api/hardware/printers`, `GET /api/hardware/probes`, `GET /api/hardware/probes/:id/temperature`, `POST /api/hardware/probes/:id/log-haccp`.
- **CLI `hardware` Command Group**: `shoreline hardware printers | print-tray | probes | probe-temp` — all with `--json` output.
- **New Docs**: `docs/HARDWARE.md`, `docs/WEBHOOKS.md`, `docs/SDK_REFERENCE.md`, `sdk/README.md`.

---

## [v5.1.0] — 2026-09-01
### Added
- **Unified CLI & CulinaryOS Command Line Controller** (`bin/shoreline.js`, `docs/CLI_REFERENCE.md`):
  - Full-coverage CLI binary aliased as both `shoreline` and `culinaryos` with 8 command groups: `residents`, `menu`, `production`, `kitchen`, `purchasing`/`mrp`, `survey`/`reporting`, `mcp`, `doctor`/`health`.
  - `--json` flag for machine-readable output across all commands — powers MCP agent integrations, external SDK calls, and CI/CD pipeline automation.
  - Added `"bin"` entry to `package.json` for global `npm link` installation.
- **Jakob's Law Mobile Bottom Navigation** (`src/components/Layout.tsx`):
  - Fixed sticky bottom tab bar (`md:hidden`) with thumb-zone accessible tabs: Dashboard, Residents, Menu, Kitchen, More.
  - Adheres to `env(safe-area-inset-bottom)` for notched iOS device safety insets.
  - Main viewport adjusted to `pb-24 md:pb-6` to prevent content clipping.
- **1-Click Desktop Install Modal** (`src/components/InstallDesktopModal.tsx`):
  - Non-technical 3-step PWA install guide (Browser Chrome/Edge, iPad/Tablet, Windows Offline ZIP).
  - "Install App" button added to the application header — no IT department required.
- **Platform Blueprint** (`docs/PLATFORM_BLUEPRINT.md`):
  - 20-point aligned architectural decisions matrix from the strategic planning session.
  - Includes hub-and-spoke syndication, IDDSI recipe variant explosion, deterministic clinical substitution matrix, and v6.0 hardware roadmap (Zebra/Brother thermal + Bluetooth HACCP probes).
- **Developer Ecosystem Roadmap Section** (`README.md`):
  - Documents CLI, MCP server, REST API, and v6.0 SDK/Webhook roadmap.
- **Marketing Site Integration Platform Section** (`marketing/src/pages/index.astro`):
  - Added "Developer & Integration Platform" section highlighting the CLI, MCP, and SDK roadmap for technical audiences.

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
