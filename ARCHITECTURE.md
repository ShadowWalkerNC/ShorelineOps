# ShorelineOps Architecture & Design Specification

## 1. System Overview

Shoreline is an open-source dietary operations and care coordination platform designed specifically for assisted living, skilled nursing, and senior living foodservice teams.

Its core operational philosophy is **distributor independence and clinical safety**:
1. Facilities should never be locked into a single food distributor ERP.
2. Resident diet orders and allergen safety must drive production, purchasing, and tray delivery.
3. Clinical EHR integrations and distributor ordering are decoupled via standard adapter interfaces.

---

## 2. Architectural Layers

```
┌────────────────────────────────────────────────────────┐
│                   Shoreline UI                         │
│   (React 18 + Vite + TypeScript + CSS Design System)   │
└───────────────────────────┬────────────────────────────┘
                            │ REST / JWT Auth
┌───────────────────────────▼────────────────────────────┐
│                  Shoreline Express API                 │
│         (Node.js + Express + Helmet + RBAC)            │
└──────┬────────────────────┬────────────────────┬───────┘
       │                    │                    │
┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐
│ PostgreSQL  │      │ Distributor │      │  EHR Sync   │
│  (Database) │      │  Connectors │      │ (FHIR spec) │
│             │      │  (Dennis)   │      │             │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## 3. Core Modules (V1)

| Module | Core Responsibilities | Routes / APIs |
|---|---|---|
| **Resident Manager** | Profile, diet orders, texture, allergies, beverages, supplements, dining room/table assignment | `/residents`, `/api/residents` |
| **Menu Planner** | 4-week cycle menus, Choice A/Choice B, active cycle week, weekly print view | `/menu`, `/api/menu` |
| **Recipe Book** | Yields, ingredients, allergen tags, preparation instructions | `/recipes`, `/api/recipes` |
| **Production Sheets** | Batch scaling, cook worksheets, kitchen meal counts | `/production`, `/api/production` |
| **Meal Service** | Dietary tray cards, meal tickets, daily meal logs | `/kitchen/*`, `/api/kitchen` |
| **Purchasing & Guide** | Item master, vendor item mapping, par levels, on-hand count, suggested PO generator, Dennis-ready CSV export | `/purchasing`, `/api/purchasing` |
| **Cost & Compliance** | Cost per resident day ($/CPD), substitution log, allergy audit risk, special diet tracking, production variance | `/reporting`, `/api/reporting` |

---

## 4. Integration Specifications

### 4.1 Distributor Connector (`server/src/integrations/distributor.ts`)
Distributor-agnostic interface supporting:
- `getCatalog()`: Retrieves vendor catalog items, pack sizes, and categories.
- `importOrderGuide(file)`: Parses distributor-provided order guides.
- `exportOrder(order)`: Serializes purchase orders into distributor-compatible formats (CSV/EDI).
- `DennisConnector` (`server/src/integrations/dennis.ts`): First reference adapter for Dennis Food Service.

### 4.2 EHR Connector (`server/src/integrations/ehr.ts`)
Generic clinical interface shaped around HL7 FHIR concepts:
- Inbound: Resident identity, room, ADT (Admit/Discharge/Transfer), diet order changes, texture modifications, allergies, and supplements.
- Meal Safety: Automated cross-validation of upcoming cycle menu items against updated resident diet profiles.

---

## 5. Security & Compliance (HIPAA & SOC 2)

- **Idle Auto-Logout**: 10-minute inactivity timer enforcing automatic session invalidation.
- **Password Strength**: Minimum 12 characters with uppercase, lowercase, numbers, and special symbols.
- **Audit Log Non-Repudiation**: Append-only PostgreSQL triggers preventing `UPDATE` or `DELETE` on the `audit_log` table.
- **Network Security**: Strict Content Security Policy (CSP), HSTS preload, X-Frame-Options Deny, and rate limiting.
