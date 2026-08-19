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

## 🚀 V2 Roadmap — Distributor Ecosystem
- [x] **Distributor Connector Interface**: Generic `DistributorConnector` specification (`getCatalog`, `importOrderGuide`, `calculateSuggestedOrder`, `exportOrder`).
- [x] **Dennis Food Service Adapter (`DennisConnector`)**: Implementation with broadline catalog sync and Dennis-formatted CSV order exports.
- [ ] **Direct Distributor Ordering API**: Automated EDI / API transmission of Purchase Orders directly into distributor order systems.
- [ ] **Real-Time Customer Pricing Sync**: Fetch dynamic contract pricing for facilities via customer account IDs.
- [ ] **Live Inventory & Item Availability**: Out-of-stock warnings and automatic broadline substitution suggestions during order creation.
- [ ] **Multi-Distributor Support**: Additional adapters for Sysco, US Foods, and Gordon Food Service.

---

## 🏥 V3 Roadmap — Clinical EHR Integration
- [x] **Generic EHR Connector Specification (`EhrConnector`)**: FHIR-shaped models for resident census, diet order changes, texture updates, and meal validation.
- [ ] **PointClickCare / MatrixCare Inbound Sync**: Automated ADT (Admit, Discharge, Transfer) ingestion.
- [ ] **Dynamic Meal Validation**: Automated detection of menu item conflicts when a resident's diet order changes (e.g. Regular to NCS + Nectar Thick).
- [ ] **Nutritional Analysis Engine**: Micronutrient and macronutrient compliance calculation per therapeutic diet order.

---

## 🌐 V4 Roadmap — Monorepo Restructuring & Ecosystem
- [ ] Transition single-app structure to monorepo (`apps/shoreline-web`, `apps/shoreline-api`, `packages/domain`, `packages/db`, `packages/integrations`).
- [ ] Open marketplace for third-party distributor and nutrition extensions.
