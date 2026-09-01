# Shoreline Care OS (Care OS v5.0 & v6.0 Blueprint)
## Master Strategic & Technical Architecture Blueprint

> **Synthesized:** September 1, 2026  
> **Source:** 20-Point Operational & Strategic Alignment Interview (`/grill-me`)  
> **Platform Version:** 5.0.0 (Production Core) &rarr; 6.0.0 (Hardware & Enterprise Scale)  
> **Status:** Officially Aligned & Approved

---

## Executive Summary & Core Identity

Shoreline Care OS is positioned as **The Open-Core Healthcare Standard for Clinical Nutrition & Dietary Operations**. It delivers an agile, clinician-trusted alternative to bloated legacy systems (e.g. Computrition, CBORD, MealTracker), combining modern consumer-grade UX (Apple HIG & shadcn/ui), strict 100% deterministic clinical safety (zero AI hallucinations), and lowest-cost distributor procurement savings (\$1.50–\$3.00/CPD) for single-facility homes and regional healthcare chains alike.

---

## 20-Point Operational Decisions Matrix

| # | Operational Domain | Aligned Strategy & Technical Implementation |
|---|---|---|
| **1** | **Target Facility Profile** | **Hybrid Deployment Flexibility:** Ready for independent 30–80 bed homes (1-click desktop/PWA install) while scaling seamlessly to multi-facility regional chains and complex medical departments. |
| **2** | **EHR Clinical Ingestion** | **Deterministic RD Clinical Triage Queue:** Inbound PointClickCare/FHIR/CSV changes land in a dedicated inbox where a Registered Dietitian / CDM 1-click approves updates before active tray cards or production batches alter. |
| **3** | **IDDSI 2.0 Texture Engine** | **Deterministic Recipe Variant Explosion:** Automatically computes net demand and explodes base recipes into discrete station prep worksheets with exact liquid broth/binder formulas (30% binder for L4 puree) and Fork Drip / Spoon Tilt testing checklists. |
| **4** | **Multi-Distributor MRP** | **Automated Lowest-Cost Split MRP:** Compares item-level $/unit across Dennis Food Service (via Pepper CSV order guides) and Sysco/US Foods, enforcing vendor minimum drop thresholds (e.g., \$500) and auto-generating optimized vendor purchase orders. |
| **5** | **3-Way Invoice Matching** | **Back-Office AP Batch Reconciliation:** Reconciles delivered invoices in batches against POs and received tickets, detecting price creep, quantity shorts, and generating formal Vendor Credit Memos. |
| **6** | **Cycle Menu & USDA Compliance** | **Dual Matrix Audit & Director Flexibility:** Real-time mathematical verification of USDA micronutrients, protein rotation, chromatic variety, and CMS F809 14-hour dinner-to-breakfast spans, paired with intuitive visual guideline badges. |
| **7** | **Tray Assembly & NPO Blocks** | **Non-Overridable Clinical Hard-Block with Visual Plating Guide:** Scanning/tapping tray tickets checks active census in real-time, strictly halts delivery on NPO orders or allergen conflicts with zero cook override, and displays recipe plating photos with portion scoop colors. |
| **8** | **HACCP Temperature Logs** | **Configurable Guided Corrective Actions:** Supports both mandatory FDA corrective action locking (Reheat 165°F / Rapid Chill / Discard) and shift-end exception documentation based on facility policy. |
| **9** | **CMS-2567 Survey Binder** | **1-Click Complete Master Survey Binder:** Instantly compiles all CMS F-Tags (F800–F814, therapeutic diets, IDDSI compliance, HACCP logs, meal spans) into an indexed, inspection-ready PDF package with timestamped audit trails. |
| **10** | **Recipe Batch Yield Scaling** | **Automated As-Purchased (AP) vs Edible-Portion (EP) Engine:** Deterministically computes gross distributor purchasing quantities from net cooked portion demand, factoring cooking shrinkage and trim loss percentages automatically. |
| **11** | **$/CPD Food Spend Analytics** | **Multi-Mode Financial Analytics:** Supports Real-Time Census-Weighted Daily Recipe CPD, Monthly AP Invoiced CPD, and Category-Split Budgeting (Proteins, Produce, Dairy, Supplements) in Settings. |
| **12** | **Open Core vs SaaS Tiers** | **Robust Free Single-Facility Core + Paid SaaS Automation:** Single-facility operations (census, menus, recipes, tablet kiosk, HACCP) are 100% free and offline-capable; advanced automation (PCC Live Sync, Multi-Distributor Split MRP, CMS-2567 Binder, 3-Way Match) gated via Pro/Enterprise tiers. |
| **13** | **Kitchen Tablet Offline Sync** | **Zero-Latency Offline Transaction Queue:** All tablet actions buffer in local IndexedDB/SQLite storage instantly with zero lag; auto-syncs transactions in chronological sequence as soon as Wi-Fi reconnects. |
| **14** | **Mobile UX & Glove Ergonomics** | **Jakob's Law Thumb-Zone Navigation & High-Contrast Kiosk Mode:** Large $\ge 48\text{px}$ touch targets with instant tactile feedback for cooks with wet nitrile gloves, combined with standard bottom tab bar navigation on mobile devices. |
| **15** | **Therapeutic Diets & Allergies** | **100% Deterministic Clinical Matrix (Zero AI):** Pre-compiled clinical substitution rules (e.g. Gluten-Free &rarr; Cornstarch/Rice Flour blend, Low Sodium &rarr; Citrus Herb seasoning) with non-overridable allergen exclusion filters. |
| **16** | **Corporate Multi-Facility HQ** | **Hub-and-Spoke Menu & Formulary Syndication:** Corporate HQ publishes master cycle menus and contracted vendor catalogs across all buildings, while allowing local dietary directors to make approved substitutions within corporate CPD budgets. |
| **17** | **Security & HIPAA RBAC** | **Strict Clinical RBAC with Vendor PHI Quarantine:** Distributor reps access only catalog/PO data with 100% quarantine from resident health data; Dietary aides access only tray assembly/HACCP; RDs and CDMs retain clinical and menu authority. |
| **18** | **CMS F807 Hydration Tracking** | **1-Tap Mobile Hydration Cart Pass:** Aides log fluid intake percentages (100%, 75%, 50%, Refused) on mobile/tablet during rounds; the system flags residents below 1,500mL/day clinical minimums for CMS F807 compliance. |
| **19** | **v6.0 Hardware Peripherals** | **Direct Thermal Label Printers (Zebra/Brother 4x6) + Bluetooth HACCP Probes:** 1-click driverless thermal tray card printing and instant Bluetooth core temperature logging directly into compliance records. |
| **20** | **12–24 Month Strategic Vision** | **The Open-Core Healthcare Standard:** Becoming the ubiquitous, modern standard for dietary operations in senior care and healthcare food service. |

---

## System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                            SHORELINE CARE OS v5.0 / v6.0                          |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ CLINICAL LAYER ]           [ CULINARY LAYER ]          [ SUPPLY CHAIN LAYER ]  |
|  - Resident Census (60 beds)  - 4-Week Cycle Menus        - Dennis Food Service   |
|  - Physician Diet Orders      - Station Demand Splitting  - Sysco Broadline EDI   |
|  - IDDSI 2.0 (L4-L7) Textures - AP vs EP Yield Loss       - Lowest-Cost Split MRP |
|  - EHR Clinical Triage Inbox  - Recipe Variant Graphs     - 3-Way Match & Credits |
|  - NPO Non-Overridable Block  - USDA Micronutrient Engine - Dynamic CPD Budget    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ KITCHEN OPERATIONS & ERGONOMICS (Jakob's Law + Gloved Touchscreen) ]           |
|  - High-Contrast Touch Kiosk (>= 48px targets)   - 4x6 Thermal Tray Cards (QR)    |
|  - Zero-Latency Offline IndexedDB Buffer         - HACCP 165°F Guided Logs        |
|  - Mobile Thumb-Zone Navigation                  - CMS F807 Hydration Pass Cart   |
|                                                                                   |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ COMPLIANCE, SECURITY & ENTERPRISE ENGINE ]                                     |
|  - CMS-2567 State Survey Binder (F800 - F814)    - Role-Based Access Control      |
|  - Corporate HQ Multi-Facility Syndication       - Vendor PHI Air-Gap Isolation   |
|  - Open Core HMAC Cryptographic Entitlements     - SQLite / PostgreSQL / Supabase |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```
