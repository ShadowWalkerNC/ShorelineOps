# ShorelineOps Developer Documentation & API Reference

Welcome to the **ShorelineOps Developer Guide**. This document outlines the technical architecture, development environment setup, database schema, role-based access control system, and integration contracts.

---

## 🛠️ 1. Architecture & Tech Stack

- **Frontend**: React 18, Vite, TypeScript, PWA Service Worker (`vite-plugin-pwa`), CSS Design Tokens.
- **Marketing Site**: Astro 4, Tailwind CSS, Static Site Generation (SSG).
- **Backend API**: Node.js, Express, TypeScript, Helmet (CSP/HSTS), Rate Limiting, JSON Web Tokens (JWT) + Rotation.
- **Database**: PostgreSQL (with automatic SQLite fallback for edge/offline testing), forward-only SQL migrations (`server/src/db/migrate.ts`).
- **Security**: Append-only PostgreSQL audit immutability triggers, 10-minute idle session auto-logout, 12+ char complex passwords.

---

## 📂 2. Directory Structure

```text
ShorelineOps/
├── marketing/                    # Astro + Tailwind Marketing Website
│   ├── src/pages/                # Landing page (/), /distributors, /pricing, /story
│   └── astro.config.mjs          # Astro build configuration
├── src/                          # Frontend Source (React 18 + TS)
│   ├── api/                      # Axios API clients & interceptors
│   ├── components/               # Layout (Color-dot navigation), Protected Route guards, PWA banners
│   ├── features/                 # Modular feature pages
│   │   ├── admin/                # System administration, audit logs, backup
│   │   ├── auth/                 # Login & MFA enrollment
│   │   ├── budget/               # Spending & cost analytics
│   │   ├── communications/       # Shift notes & broadcast messages
│   │   ├── dashboard/            # Facility operational command center
│   │   ├── distributor/          # Distributor partner portal (item master/SKU manager)
│   │   ├── inventory/            # Dry storage, cooler, freezer stock
│   │   ├── kitchen/              # Kitchen Tablet Mode, Daily Cook Sheets, Tray Cards, Tally Entry
│   │   ├── menu/                 # 4-week cycle menu planner
│   │   ├── production/           # Batch counts & cook worksheets
│   │   ├── purchasing/           # Order guides, par levels, suggested POs, Dennis CSV sync
│   │   ├── recipes/              # Recipe book with allergen auto-detection & SKU cost linking
│   │   ├── reporting/            # $/CPD, labor costs, allergy risk, substitutions, survey print
│   │   ├── residents/            # Resident profiles, diet orders, textures, allergies
│   │   ├── setup/                # First-time onboarding wizard & BAA signing
│   │   ├── staff/                # Staff directory, shift profiles, scheduling
│   │   └── timecard/             # Kiosk time punch logs
│   ├── security/                 # AuthContext, tokenManager, idle logout
│   └── types/                    # TypeScript interfaces and role definitions
├── server/                       # Backend Source (Express + TS)
│   ├── src/
│   │   ├── db/                   # Connection pool, migrate.ts, seed.ts
│   │   ├── integrations/         # Distributor (Dennis) & EHR (FHIR) connector adapters
│   │   ├── middleware/           # requireAuth.ts, errorHandler.ts, rateLimiters
│   │   ├── routes/               # Modular Express routers
│   │   └── index.ts              # Server bootstrap, Helmet CSP, root status route
├── ARCHITECTURE.md               # System design & boundary documentation
├── COMMERCIAL_AGREEMENT.md       # Master services agreement template
├── DEMO_SCRIPT.md                # 5-minute live sales demo script
├── DISTRIBUTORS.md               # Distributor partner onboarding guide
├── ONBOARDING_TEMPLATES.md       # Census & order guide import templates
├── README.md                     # GitHub introduction & user manual
├── SALES_PITCH.md                # Commercial pitch deck & ROI model
└── TODO.md                       # Roadmap (V1, V2, V3, V4 milestones)
```

---

## 🔐 3. User Roles & Permission Matrix

Shoreline enforces strict Role-Based Access Control (RBAC). The system defines 10 distinct roles with numerical hierarchy and granular permissions:

| Role Code | Display Label | Rank | Core Permissions |
|---|---|:---:|---|
| `admin` | **Administrator** | `9` | Full root access: User management, facility settings, audit logs, system backups. |
| `manager` | **Facility Manager** | `8` | Operational control: Budget approvals, staff oversight, menu approvals, PO sign-offs. |
| `frontdesk` | **Office Assistant** | `7` | Care coordination: Resident management, communications, punch logs, order creation. |
| `dietitian` | **Registered Dietitian (RD)** | `6` | Clinical nutrition: Diet orders, texture modifications, menu compliance, recipe nutrition. |
| `dietary` | **Dietary Staff** | `5` | Kitchen operations: Tray cards, meal tallies, kitchen sheets, cook worksheets, order guides. |
| `activities` | **Activities Director** | `4` | Resident engagement: Resident directory, activity communications, menu viewing. |
| `server` | **Dining Room Server** | `3` | Meal delivery: Tray cards, resident dining room tallies, production viewing. |
| `staff` | **General Staff** | `2` | Operational view: Resident rosters, daily menus, staff communications. |
| `distributor` | **Distributor Partner** | `1` | Vendor portal: Catalog SKU management, pack sizes, unit pricing (`manage:vendor_catalog`). No PHI access. |
| `readonly` | **Read-Only Auditor** | `0` | Compliance inspection: Read-only access to menus, inventory, and non-sensitive data. |

---

## 🔌 4. Integration Connector Architecture

### 4.1 Distributor Connector Contract (`server/src/integrations/distributor.ts`)
```typescript
export interface DistributorConnector {
  vendorCode: string
  vendorName: string
  getCatalog(): Promise<VendorItem[]>
  importOrderGuide(fileContent: string | Buffer): Promise<OrderGuideEntry[]>
  exportOrder(order: PurchaseOrder): Promise<ExportResult>
  getCustomerPricing?(accountId: string): Promise<CustomerPrice[]>
  getAvailability?(accountId: string): Promise<ItemAvailability[]>
}
```

### 4.2 Dennis Food Service Adapter (`server/src/integrations/dennis.ts`)
Implements `DistributorConnector` for Dennis Food Service:
- Ingests Dennis broadline SKU categories, pack sizes, and units of measure.
- Calculates suggested order quantities based on `Par Level - On Hand`.
- Exports Dennis-ready CSV purchase orders (`vendor,name,sku,pack,uom,qty`).

### 4.3 EHR Clinical Sync Specification (`server/src/integrations/ehr.ts`)
Defines FHIR-aligned data structures for:
- Resident admission, transfer, and discharge (ADT) events.
- Real-time diet order and texture updates (e.g. Regular to Puree / Nectar Thick).
- Automated meal conflict validation engine.

---

## ⚡ 5. Local Development Workflow

### Starting Backend API Server
```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### Starting Frontend Development Server
```bash
# In repository root
npm install
npm run dev
```

### Starting Astro Marketing Website
```bash
cd marketing
npm install
npm run dev
```

### Running Production Builds & Type Checking
```bash
# Frontend typecheck & Vite build
npm run build

# Backend typecheck & compilation
cd server && npm run build

# Marketing site static build
cd marketing && npm run build
```
