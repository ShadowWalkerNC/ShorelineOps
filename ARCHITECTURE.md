# ShorelineOps Architecture & Technical Specification (Care OS v5.0)

## 1. System Overview

**ShorelineOps** is an open-source dietary operations, clinical nutrition, and healthcare foodservice platform designed specifically for assisted living, memory care, skilled nursing, CCRCs, and acute care facilities.

Its core operational principles:
1. **Open Core Architecture**: Core single-facility operational tools (Resident census, cycle menus, standardized batch recipes, tray cards, local timecard kiosk) are 100% free and open source. Commercial enterprise modules (PointClickCare Live Sync, Multi-Distributor Lowest-Cost Split MRP, CMS-2567 Federal Survey Binder, 3-Way Invoice OCR & Credit Memos) are managed under a secure SaaS tier gated via cryptographic HMAC license keys (`SH_PRO_...` / `SH_ENT_...`).
2. **Deterministic Clinical Safety**: Resident diet orders, IDDSI texture requirements (Levels 0–7), and allergen exclusions drive production, purchasing, and tray delivery with deterministic non-overridable safety hard-blocks.
3. **Distributor Independence**: Eliminates vendor lock-in by supporting algorithmic lowest-cost order splitting across Dennis Food Service, Sysco, US Foods, Gordon Food Service, and Performance Food Group.
4. **Kitchen Ergonomics**: Touch targets ($\ge 44\text{px}$) optimized for line cooks wearing wet nitrile gloves under fluorescent lighting during 45-minute tray line rushes.
5. **Multi-Tier Caching & Resilience**: In-memory LRU cache, conditional ETags (`304 Not Modified`), request deduplication, circuit breakers, and hybrid SWR IndexedDB storage for offline tablet performance.

---

## 2. Architectural Layers

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Shoreline Web PWA                                    │
│          (React 18 + Vite + TypeScript + shadcn/ui + Apple HIG + Zustand)              │
│                                                                                        │
│  [Residents & Diets]  [Menu Planner]  [Production]  [Tray Cards]  [Purchasing & MRP]  │
│  [Settings & Wings]   [Vendor Portal] [Reporting]   [SaaS Licensing & FeatureGate]     │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ REST / Bearer JWT (Conditional ETags / 304)
                                            │ Header: X-Shoreline-License-Key
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                                Shoreline Express API                                   │
│    (Node.js + Express + Helmet + requireTier Middleware + LRU Cache + HealerBot)       │
└───────┬─────────────────────┬─────────────────────┬───────────────────┬────────────────┘
        │                     │                     │                   │
┌───────▼──────┐      ┌───────▼──────┐      ┌───────▼──────┐    ┌───────▼──────┐
│  Database    │      │ Distributor  │      │  EHR Sync    │    │ USDA Central │
│ • SQLite/    │      │  Connectors  │      │ (FHIR & PCC) │    │  (Nutrition) │
│   PostgreSQL │      │ • Dennis EDI │      │ • PointClick │    │ • 8,000+     │
│ • Audit Logs │      │ • Sysco REST │      │   Care OAuth │    │   Ingredient │
│ • Par Guides │      │ • US Foods   │      │ • RD Triage  │    │   Database   │
└──────────────┘      └──────────────┘      └──────────────┘    └──────────────┘
```

---

## 3. Core Modules & Route Map

| Module | Core Responsibilities | Routes / APIs | Primary Users |
|---|---|---|---|
| **Resident Manager** | Census roster, therapeutic diets (NAS, NCS, Renal), IDDSI textures (Pureed, Minced), allergies, table seating | `/residents`, `/api/residents` | Dietitians, DONs, RDs |
| **PointClickCare EHR Queue** | Inbound ADT transfers and physician diet updates gated by RD triage queue | `/residents`, `/api/ehr/census` | Registered Dietitians |
| **Kitchen Tablet Kiosk** | Large-touch worksheets, batch yield scaling, temp logs (165°F), tray line dispatch, quick par counting | `/kitchen/tablet`, `/api/kitchen` | Line Cooks & Prep Staff |
| **Menu Cycle Planner** | 4-week cycle menus, Choice A/B, active week, nutritional audit, recipe drawer | `/menu`, `/api/menu` | Dietary Directors |
| **Batch Recipe Book** | Master recipe catalog with Big 9 allergen detection, USDA nutrition analysis, and ingredient cost scaling | `/recipes`, `/api/recipes` | Chefs & Kitchen Staff |
| **Material Requirements (MRP)** | Multi-level Bill of Materials explosion × resident census into vendor case pack orders | `/purchasing`, `/api/purchasing/mrp-order` | Dietary Managers |
| **Lowest-Cost Split MRP** | Multi-distributor price comparison (Dennis, Sysco, US Foods) routing orders to lowest-cost vendor | `/purchasing`, `/api/purchasing/orders` | Dietary Directors |
| **3-Way Invoice Match & Memos** | PO vs Dock Receiving vs Invoiced price/quantity variance detection and automated vendor credit claim generation | `/purchasing`, `/api/purchasing/invoices/match` | Dietary Managers & AP |
| **CMS-2567 Federal Survey Binder** | 1-click digital inspection binder covering Federal F-Tags (F800–F814) and F809 14-hour rule | `/reporting`, `/api/reporting/cms-survey-export` | Executive Dir & CDM |
| **Corporate HQ Multi-Facility Portal** | Centralized senior living chain oversight, master cycle menu syndication, and cross-facility $/CPD spend benchmarks | `/enterprise`, `/api/enterprise` | Corporate VP of Dining / Executive Chef |
| **Distributor Partner Portal** | Direct vendor portal for Dennis & Sysco sales reps to manage SKUs, pack sizes, and contract rates | `/distributor`, `/api/purchasing/items` | Distributor Reps |
| **Facility & Operations Settings** | Facility profile, wings, dining rooms, meal schedule times, CPD target budget, and SaaS license key | `/settings`, `/api/settings` | Administrators |
| **Admin & HealerBot** | Staff scheduling, user accounts, automated self-healing diagnostic bot, and audit logs | `/admin`, `/api/admin` | System Admins |

---

## 4. UI/UX Design System: shadcn/ui + Apple HIG

The user interface implements **shadcn/ui** primitives combined with Apple Human Interface Guidelines:
- **Component Primitives** (`src/components/ui/`): Accessible Radix UI wrappers (`Button`, `Card`, `Badge`, `Dialog`, `Tabs`, `Input`, `Select`, `Switch`, `Separator`, `Avatar`).
- **Canvas Colors**: Neutral light canvas (`#f5f5f7`) and dark mode canvas (`#000000` / `bg-slate-950`).
- **Frosted Glass Vibrancy**: Sticky headers and floating cards utilize `backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80`.
- **System Typography**: Apple SF Pro / system font stack (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display"`).
- **Touch Ergonomics**: All critical kitchen action buttons meet or exceed the $44\text{px} \times 44\text{px}$ touch target guideline.

---

## 5. Security, HIPAA Technical Safeguards & Open Core Licensing

- **Authentication & RBAC**: Stateless JWT bearer tokens with Argon2/bcrypt password hashing (enforcing 12+ character complexity, upper, lower, digit, special symbol).
- **Role Hierarchy**: `cook` $\to$ `aide` $\to$ `dietitian` $\to$ `manager` $\to$ `admin`.
- **Open Core Entitlement Engine**:
  - Client: `src/security/license.ts` validates HMAC signatures on license tokens (`SH_PRO_...` / `SH_ENT_...`) and exposes `satisfiesTier()`.
  - UI Gate: `src/components/FeatureGate.tsx` wraps proprietary features with frosted glass upgrade cards in Community Core mode.
  - Server Gate: `server/src/middleware/requireTier.ts` intercepts protected REST endpoints returning `402 LICENSE_TIER_REQUIRED`.
- **HIPAA Technical Safeguards**: Audit logs are immutable and archived with 7-year (2,555 days) retention tracking. PHI is stripped from distributor portal views.

---

## 6. Autonomous Operations Consultant Engine

- **Agent Persona**: `dietary_operations_consultant` acting as Certified Dietary Manager (CDM, CFPP) and Healthcare Operations Consultant.
- **Audit Engine**: `scripts/operations_consultant_audit.js` runs automated operational audits across clinical safety, kitchen ergonomics, supply chain, CMS survey readiness, and open core licensing.
- **Daily Log**: Master report generated at `docs/DAILY_OPERATIONS_AUDIT.md`.
- **Recurring Schedule**: Standing background cron (`0 9 * * *` - Daily at 9:00 AM) runs proactive research and audits.
