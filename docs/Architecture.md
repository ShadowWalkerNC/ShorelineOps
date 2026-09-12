# System Architecture

ShorelineOps is architected as a modular, high-reliability platform that bridges clinical healthcare records with back-of-house commercial kitchen operations.

```
+-------------------------------------------------------------------------+
|                           PRESENTATION LAYER                            |
|  React 18 PWA • Apple HIG UI Kit • Vite • Tailwind • Zustand • WebAudio  |
+------------------------------------+------------------------------------+
                                     | REST / JSON (JWT + RBAC)
+------------------------------------v------------------------------------+
|                             API & ROUTING                               |
|  Express.js • Helmet Security • Rate Limiting • In-Memory Cache (LRU)  |
+------------------+-------------------+-------------------+--------------+
                   |                   |                   |
+------------------v----+ +------------v------+ +----------v--------------+
|    CLINICAL SAFETY    | | PRODUCTION & MRP  | |  FINANCIAL & COMPLIANCE |
| • SafetyEvaluator     | | • ProductionEngine| | • InvoicingEngine       |
| • QR-Token Verifier   | | • MrpForecast     | | • CmsSurveyEngine       |
| • IDDSI Matrix        | | • Unit Conversion | | • Audit Immutability    |
+------------------+----+ +------------+------+ +----------+--------------+
                   |                   |                   |
+------------------v-------------------v-------------------v--------------+
|                             DATA STORE                                  |
|  PostgreSQL 15 (Foreign Keys, Cascade Deletes, Append-Only Triggers)   |
+-------------------------------------------------------------------------+
```

## Core Design Principles
1. **Clinical Non-Negotiability**: Resident safety hard-blocks execute deterministically before any meal ticket or production batch can be dispatched.
2. **Zero-Trust Kitchen Offline Resilience**: Line cooks on mobile tablets can verify tray tokens and consult batch scale worksheets even during network drops.
3. **Distributor-Agnostic Cost Optimization**: Raw ingredient demand explodes across vendor catalogs to guarantee the lowest cost per resident day.

## Database schema management (A02/A03)

- Canonical migration path: `server/src/db/migrate.ts` → `runMigrations()`. Legacy competing schema files (`server/src/db/schema.sql`, `server/src/db/migrations/001_initial_schema.sql`, `supabase/schema.sql`) were removed in Wave A and do not exist anywhere the server can read; the canonical schema is `server/src/db/*` (migrations under `server/src/db/migrations/`).
- Migrations are append-only: existing migration bodies are never edited; gaps are healed with new migrations (e.g. `016_purchasing_reporting_backfill`, which creates the 8 tables defined in `010`/`011`/`012` but never created in databases where those migrations were already marked applied: `vendor_items`, `facility_item_maps`, `order_guides`, `purchase_orders`, `purchase_order_lines`, `daily_cost_log`, `recipe_nutrients`, `menu_item_recipes`).
- `server/shoreline.db` (checked-in dev DB) is regenerated from a fresh `runMigrations()` + canonical `server/src/db/seed.ts` so it matches the schema definition exactly.
- Boot-time drift guard: after migrations, `assertSchemaIntegrity()` (same file) verifies all 28 expected tables exist; any missing table fails closed — the server refuses to start and names the missing tables.
