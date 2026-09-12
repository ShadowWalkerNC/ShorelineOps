# Wave C — Kitchen Operations & Cost Transparency

Wave C adds durable food-safety evidence, real production forecasting, recipe
costing with provenance, server-synced settings, kitchen ergonomics, and a
live OpenAPI spec. Everything below is verified against the code in this tree.

## C01 — Durable HACCP Temperature Logging

- **Tables** (`server/src/db/migrate.ts`, migration `023_haccp_temperature_logging`):
  `haccp_equipment` (fridge / freezer / dishwasher / hot-hold, with target
  temps and check frequency) and `haccp_logs` (every temp record).
- **Corrective-action enforcement** (`server/src/routes/hardware.ts`): a
  non-compliant (out-of-range) temperature log **cannot be saved without
  corrective-action text** — the server rejects it (422). Every log records
  check type (`food` / `equipment`), compliance, violation type, probe device,
  and who recorded it.
- **UI** (`src/features/kitchen/TempLogPanel.tsx`): equipment schedule with
  due/overdue status, temp entry, violation flow, and log list. No fabricated
  records — every row comes from the persisted `haccp_logs` table.
- The log evidence feeds the CMS-2567 survey binder export.

## C05 — Production Forecasting & Nightly Usage Rollup

- **Scheduled menu × census** (`server/src/engine/production.ts`,
  `buildScheduledMeals`): production sheets are generated from the real
  scheduled menu multiplied by current census, plus a **census-trend buffer**:
  `buffer = ceil(census × (0.03 + growth))`, where `growth` is the observed
  growth vs. up to 3 prior weeks (no order history → 3% base only). The buffer
  formula is returned with every forecast so the dietitian can explain it.
- **Nightly usage rollup** (`server/src/jobs/nightlyForecast.ts`): a scheduled
  job computes trailing-28-day average daily consumption per order-guide line
  from `inventory_transactions` (only `issue` / `waste` count as usage —
  receipts and count adjustments don't), updating `avg_usage` so purchasing
  order guides reflect what the kitchen actually uses. Lines with no history
  keep their previous value; the rollup never invents a zero.
- Menu items with no matching recipe are skipped and reported so nothing is
  silently dropped.

## C06 — Recipe Costing with Provenance

- **Chain** (`server/src/engine/costing.ts`, `RecipeCostingEngine`):
  vendor catalog → ingredient → recipe → plate (menu slot) → daily cost log
  (`daily_cost_log`) → **$/CPD** (`GET /api/reporting/cpd-breakdown`).
- **Provenance** (`server/src/routes/recipes.ts`): each ingredient line is
  flagged **SKU-matched** (live vendor unit cost wins) or **estimated**
  (ingredient `estimatedCost` fallback). `cost_per_serving` is recomputed and
  persisted on every recipe create/update; `costProvenance` is computed live
  from current vendor-catalog coverage.
- **Reporting** (`src/features/reporting/ReportingPage.tsx`): the CPD
  breakdown shows which slot costs are SKU-matched vs. estimated before
  anything is rolled into the daily cost log (manager-triggered rollup).

## C04 — Server-Synced Facility Settings

- **Table** (`server/src/db/migrate.ts`, migration `024_facility_settings`):
  `facility_settings`, keyed by `(facility_id, key)`.
- **Routes** (`server/src/routes/admin.ts`): `GET /api/admin/facility-settings`
  (any authenticated device can read), `PUT /api/admin/facility-settings`
  (manager+ only, audit-logged). Server is authoritative.
- **Client** (`src/state/settingsStore.ts`, `src/api/admin.ts`): write-through
  save to the server, offline localStorage cache fallback, and an on-page
  sync-state indicator (`synced` / `syncing` / `offline-cached` / `error`)
  with last-synced timestamp.

## C02 — Kitchen Fitness

- **44px touch targets + 14px clinical type floor** on the four kitchen
  workhorse pages (`/kitchen/orders`, `/kitchen/sheet`, `/production`,
  `/kitchen/traycards`) via `.kitchen-fit` in
  `src/features/kitchen/kitchen-fitness.css`.
- **Kitchen-mode toggle** (`src/features/kitchen/KitchenModeContext.tsx`):
  dark, glare-safe, high-contrast, large-type theme with 56px targets,
  persisted per device in localStorage.
- **Clinical safety strip** (`src/features/kitchen/ClinicalSafetyStrip.tsx`):
  read-only header on the kitchen pages showing the current meal service plus
  live counts of residents with recorded allergies and residents flagged NPO.

## C03 — Accessibility Baseline

- Visible focus rings on all interactive UI components
  (`src/components/ui/*` — `focus-visible:ring` styles).
- 16px minimum form input size on kitchen pages (prevents iOS zoom-on-focus).
- High-contrast kitchen-mode theme for glare / low-vision conditions.

## C07 — OpenAPI 3.1 Coverage

- The full REST API spec is served live at **`/api/docs`**
  (`server/src/index.ts`), from `server/src/docs/openapi.json` (117 paths).
- Generated from the Express route definitions by
  `server/scripts/generate-openapi.mjs` — do not edit by hand; run
  `npm run docs:generate` in `server/`.
