# ShorelineOps Architecture & Technical Specification

## 1. System Overview

**ShorelineOps** is an open-source dietary operations and healthcare foodservice coordination platform designed specifically for assisted living, memory care, and skilled nursing communities.

Its core operational philosophy is **distributor independence and clinical safety**:
1. Facilities should never be locked into a single food distributor ERP.
2. Resident diet orders, IDDSI texture requirements, and allergen exclusions drive production, purchasing, and tray delivery.
3. Clinical EHR integrations and distributor ordering are decoupled via standard adapter interfaces.

---

## 2. Architectural Layers

```
┌──────────────────────────────────────────────────────────────────┐
│                          Shoreline UI                            │
│  (React 18 + Vite + TypeScript + PWA + Clean Dot Navigation)     │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ REST / Bearer JWT
┌─────────────────────────────────▼────────────────────────────────┐
│                      Shoreline Express API                       │
│    (Node.js + Express + Helmet + 10-Tier RBAC + Audit Triggers)  │
└──────┬──────────────────────────┬────────────────────────┬───────┘
       │                          │                        │
┌──────▼──────┐            ┌──────▼──────┐          ┌──────▼──────┐
│ PostgreSQL  │            │ Distributor │          │  EHR Sync   │
│  (Database) │            │  Connectors │          │ (FHIR spec) │
│             │            │  (Dennis)   │          │             │
└─────────────┘            └─────────────┘          └─────────────┘
```

---

## 3. Core Modules & Route Map

| Module | Core Responsibilities | Routes / APIs | Primary Users |
|---|---|---|---|
| **Resident Manager** | Profile, diet orders (NAS, NCS, Renal), IDDSI textures, allergies, beverages, dining room table assignments | `/residents`, `/api/residents` | Dietitians, RDs, DONs |
| **Kitchen Tablet Mode** | Touch worksheets, batch yield scaling, temp logs (165°F), tray line dispatch, quick par count steppers | `/kitchen/tablet`, `/api/kitchen` | Line Cooks & Prep Staff |
| **Menu Planner** | 4-week cycle menus, Choice A/Choice B, active cycle week, weekly print view | `/menu`, `/api/menu` | Dietary Directors |
| **Recipe Book** | Master recipe catalog with automatic keyword allergen auto-detection and vendor SKU cost linking | `/recipes`, `/api/recipes` | Chefs & Kitchen Staff |
| **Daily Cook Sheets** | Real-time meal tallies, modifiers, alternatives, and production worksheets | `/kitchen/sheet`, `/api/kitchen/sheet` | Line Cooks |
| **Production Sheets** | Prep scaling, planned vs. cooked volume variance | `/production`, `/api/production` | Cooks & Managers |
| **Tray Cards & Service** | High-contrast resident meal tickets with red allergen alert banners | `/kitchen/traycards`, `/api/kitchen` | Dietary Servers |
| **Purchasing & Guide** | Item master, vendor item mapping, par levels, on-hand count, suggested PO generator, Dennis CSV export | `/purchasing`, `/api/purchasing` | Dietary Managers |
| **Distributor Portal** | Vendor portal for distributor sales reps to update SKUs and contract pricing without PHI access | `/distributor`, `/api/distributor` | Food Distributor Reps |
| **Cost & Compliance** | Food cost ($/CPD), total dietary operating cost (food + labor), substitution log, and 1-click survey print sheet | `/reporting`, `/api/reporting` | Administrators & Inspectors |

---

## 4. Integration Specifications

### 4.1 Distributor Connector (`server/src/integrations/distributor.ts`)
Distributor-agnostic interface supporting:
- `getCatalog()`: Retrieves vendor catalog items, pack sizes, and categories.
- `importOrderGuide(file)`: Parses distributor-provided order guides (CSV / Excel).
- `calculateSuggestedOrder(parLevels, onHand)`: Derives recommended reorder quantities (`Par - On Hand`).
- `exportOrder(order)`: Serializes purchase orders into distributor-compatible formats (Dennis CSV / EDI).
- `DennisConnector` (`server/src/integrations/dennis.ts`): Reference adapter for Dennis Food Service.

### 4.2 EHR Connector (`server/src/integrations/ehr.ts`)
Generic clinical interface shaped around HL7 FHIR concepts:
- Inbound: Resident identity, room, ADT (Admit/Discharge/Transfer), diet order changes, texture modifications, allergies, and supplements.
- Meal Safety: Automated cross-validation of upcoming cycle menu items against updated resident diet profiles.

---

## 5. Security & Technical Safeguards (HIPAA Aligned)

- **10-Minute Idle Auto-Logout**: Automatic session invalidation protecting resident Protected Health Information (PHI) on shared workstations (`AuthContext.tsx`).
- **Password Hardening**: Minimum 12 characters requiring uppercase, lowercase, numbers, and special symbols.
- **Audit Log Immutability**: Append-only PostgreSQL triggers (`trg_prevent_audit_log_update` and `trg_prevent_audit_log_delete`) preventing modification of audit records.
- **Distributor PHI Isolation**: Distributor partner accounts are cryptographically restricted from viewing resident clinical records or dietary orders.
- **Network Security**: Strict Content Security Policy (CSP), HSTS preload, X-Frame-Options Deny, and rate limiting via Helmet.
