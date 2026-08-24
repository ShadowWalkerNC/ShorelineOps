# ShorelineOps — Open Core & Licensing Architecture

This document details the **Open Core** architecture of ShorelineOps, separating the **Free Self-Hosted Community Core** from the **Commercial Pro & Enterprise SaaS Editions**.

---

## 1. Editions & Feature Matrix

| Capability | Free Community Core (Open Source) | Pro Cloud SaaS ($199/mo) | Enterprise Care Network SaaS ($399/mo) |
|---|:---:|:---:|:---:|
| **License Type** | AGPL-3.0 / Apache-2.0 | Commercial SaaS License | Commercial SaaS License |
| **Hosting Model** | Self-Hosted (Docker / Node / SQLite / Postgres) | Managed Cloud / Hybrid | Managed Cloud / Dedicated VPC |
| **Resident Census & Diet Orders** | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Cycle Menu Planner (4-Week)** | ✅ Included | ✅ Included | ✅ Included |
| **Batch Recipe Book & Scaler** | ✅ Included | ✅ Included | ✅ Included |
| **Tray Card Generator & Table Kiosk** | ✅ Included | ✅ Included | ✅ Included |
| **Timecard Punch Clock & Roster** | ✅ Included | ✅ Included | ✅ Included |
| **USDA Nutrition Solver** | ❌ (Manual Input) | ✅ Real-time USDA FoodData API | ✅ Real-time USDA FoodData API |
| **Multi-Distributor Split MRP Optimizer** | ❌ | ✅ Algorithmic Lowest-Cost PO | ✅ Algorithmic Lowest-Cost PO |
| **Multi-User Cloud Sync & Backups** | ❌ (Local DB) | ✅ Automated Nightly Cloud Sync | ✅ Continuous Geo-Redundant Sync |
| **PointClickCare / MatrixCare 2-Way Sync** | ❌ | ❌ | ✅ Live OAuth Bi-directional Sync |
| **CMS-2567 Federal Survey Digital Binder** | ❌ | ❌ | ✅ 1-Click F-Tag Audit Crosswalk |
| **3-Way Invoice Match & Credit Memos** | ❌ | ❌ | ✅ Automated OCR Variance & Memos |
| **Multi-Facility Chain Consolidation** | ❌ | ❌ | ✅ Cross-Facility MRP & Portals |

---

## 2. Technical Separation & Security Guardrails

### A. Free Community Core (`COMMUNITY`)
- Located in the open GitHub repository.
- Contains all single-facility operational tools: Census management, cycle menus, standardized recipes, HACCP food temps, tray card printing, and timecard kiosk.
- Persists data to a local offline SQLite database or self-hosted Supabase/PostgreSQL instance.
- Operates without any license key requirement.

### B. Pro & Enterprise SaaS Tiers (`PRO` & `ENTERPRISE`)
- Enterprise connectors (PointClickCare OAuth bridge, distributor EDI pipelines, CMS-2567 crosswalk engines) require a cryptographically signed HMAC license key (`SH_PRO_...` or `SH_ENT_...`) or connection to Shoreline Cloud SaaS.
- **Client Guardrail**: `<FeatureGate requiredTier="enterprise">` presents a Cupertino upgrade card with value metrics, tier comparisons, and a license key activation input.
- **Backend Guardrail**: `requireTier('enterprise')` middleware gates high-value REST/GraphQL endpoints, returning `402 LICENSE_TIER_REQUIRED` if accessed without an active SaaS entitlement.

### C. Live Demo Sandbox Mode (`DEMO`)
- Deployed at `https://shoreline-demo.onrender.com`.
- Automatically initializes with pre-populated multi-facility datasets and unlocks all enterprise features in a simulated sandbox for client evaluations and test facility demos.

---

## 3. License Key Management

To activate an instance:
1. Obtain a license key from the [ShorelineOps SaaS Portal](https://shoreline-marketing.onrender.com/pricing).
2. Enter the key via:
   - Environment variable: `SHORELINE_LICENSE_KEY=SH_ENT_...`
   - Admin Console: Navigate to **Admin Console** → **SaaS Licensing & Entitlements** → **Activate Key**.
3. The instance validates the signature and immediately unlocks the corresponding features.
