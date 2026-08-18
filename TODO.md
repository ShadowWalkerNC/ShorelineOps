# TODO — ShorelineOps Roadmap & Active Work

## ✅ V1 Milestones (Completed)
- [x] **Resident Manager**: Complete profile, diet orders, texture requirements, allergies, beverage flags, supplements, and dining assignments.
- [x] **Weekly Menu Planner**: 4-week cycle menus, choice A/B meal slots, active week flagging, and printable menu views.
- [x] **Recipe Book**: Base recipe management, ingredient lists, prep instructions, and serving scaling.
- [x] **Production Sheets**: Cook worksheets, batch counts, kitchen sheets per meal.
- [x] **Meal Service & Tray Cards**: Tray card generator, resident meal tickets with allergy alerts.
- [x] **Purchasing & Order Guide (V1)**: Distributor-agnostic module with Dennis Food Service as initial reference adapter, item master, par levels, on-hand tracking, suggested order generator, and CSV/print export.
- [x] **Cost & Compliance Reporting (V1)**: Cost per resident day ($ / CPD), meal substitution log, active allergy risk summaries, special diet/texture monitoring, and production variance.
- [x] **HIPAA & SOC 2 Remediation**: 10-minute idle auto-logout, 12-char complex passwords, append-only PostgreSQL audit log immutability triggers, Helmet CSP/HSTS headers.

---

## 🚀 V2 Roadmap — Distributor Ecosystem
- [x] **Distributor Connector Interface**: Generic `DistributorConnector` specification (`getCatalog`, `importOrderGuide`, `exportOrder`).
- [x] **Dennis Food Service Adapter (`DennisConnector`)**: Initial implementation with sample catalog and Dennis-formatted CSV order exports.
- [ ] **Direct Distributor Ordering API**: Automated EDI/API transmission of Purchase Orders directly into distributor order systems.
- [ ] **Real-Time Customer Pricing Sync**: Fetch contract pricing for facilities via customer account IDs.
- [ ] **Live Inventory & Item Availability**: Out-of-stock warnings and automatic substitution suggestions during order creation.
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
