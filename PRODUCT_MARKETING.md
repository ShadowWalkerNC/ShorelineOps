# Shoreline Operations Platform (ShorelineOps)
### Open-Source Dietary Operations & Care Coordination for Assisted Living & Skilled Nursing

---

## 🍽️ The Problem in Senior Living Foodservice Today

Assisted living and skilled nursing facilities operate under severe margin pressure, stringent regulatory compliance mandates, and high dietary complexity:

- **Distributor Lock-in**: Traditional enterprise dietary systems lock facilities into proprietary ordering ecosystems with limited vendor choices and opaque pricing.
- **Dietary Safety & Allergen Risks**: Texture modifications (Mechanical Soft, Pureed, Nectar Thick) and allergen exclusions require seamless communication between clinical nursing and kitchen production.
- **Uncontrolled Food Costs**: Kitchens struggle to calculate accurate **Food Cost per Resident Day ($ / CPD)** or balance recipe yields against census counts.
- **Complex Onboarding**: Legacy healthcare software requires months of training and prohibitive licensing fees.

---

## 💡 The Solution: ShorelineOps

Shoreline is an open-source, HIPAA/SOC 2-ready dietary management and care coordination platform. It bridges the gap between **clinical resident needs, menu planning, kitchen production, and distributor purchasing**—without locking your facility into a single food distributor.

```
                  ┌──────────────────────────────┐
                  │    Clinical Diet Orders      │
                  │ (Allergies, Textures, Needs) │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Weekly Menu    │───▶│ Kitchen & Cook   │───▶│   Tray Cards &   │
│   Cycle Plans    │    │ Worksheets / Prep│    │   Meal Tickets   │
└──────────────────┘    └────────┬─────────┘    └──────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   Purchasing & Order Guide   │
                  │ (Par Levels, On-Hand, SKUs)  │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │  Distributor-Agnostic Export │
                  │  (Dennis, Broadline, CSV/EDI)│
                  └──────────────────────────────┘
```

---

## 🌟 Core Value Propositions

### 1. Distributor-Agnostic Purchasing
- Model order guides, track on-hand counts, and establish par levels for every item.
- Automatically generate suggested purchase orders when kitchen inventory drops below par.
- Export standardized purchase sheets and Dennis-ready electronic CSV orders.
- Provide your distributor sales representative with direct, secure portal access (`/distributor`) to maintain item SKUs and contract pricing without viewing resident medical data.

### 2. Clinical Dietary & Tray Safety
- Full resident dietary profiles: textures (Regular, Minced, Puree), therapeutic diets (NAS, NCS, Renal), fluid restrictions, and beverage preferences.
- Generate high-contrast, printable dietary tray cards with visual allergy alert badges.
- Record and audit meal substitutions with clinical justifications.

### 3. Food Cost & Compliance Reporting
- Real-time **Food Cost per Resident Day ($ / CPD)** dashboards.
- Daily menu cost estimation and production variance reporting (planned vs. actual cooked servings).
- One-click print-ready Dietary Compliance Summary for state health inspections.

### 4. Built for Healthcare Security & Compliance
- **HIPAA & SOC 2 Ready**: 10-minute idle session auto-logouts, append-only PostgreSQL audit immutability triggers, and strict Content Security Policy headers.
- **Granular RBAC**: 10 distinct role tiers ranging from Super Administrator and Registered Dietitian (RD) to Kitchen Staff and Distributor Partners.
- **Instant Onboarding Wizard**: Automated facility setup wizard (`/setup`) to configure wings, dining rooms, initial admin accounts, and sign the Business Associate Agreement (BAA).

---

## 👥 Who Uses ShorelineOps?

- **Executive Directors & Facility Managers**: Gain complete transparency into food spend, labor logs, and compliance status.
- **Registered Dietitians (RDs)**: Authorize therapeutic diet orders, approve cycle menus, and audit allergen safety.
- **Dietary Managers & Chefs**: Scale recipe batches, print cook worksheets, and manage kitchen order tallies.
- **Food Distributors**: Integrate product catalogs, update pricing, and receive structured electronic purchase orders.

---

## 🚀 Get Started in Minutes

Experience ShorelineOps with our interactive demo or deploy the full stack to your private infrastructure:

- **Live Demo Credentials**: One standard admin account (`admin@shoreline.demo` / `Admin1234!`) for evaluation.
- **Production Deployment**: Follow the step-by-step instructions in [`README.md`](README.md) and [`DEVELOPERS.md`](DEVELOPERS.md).
- **Distributor Partners**: See [`DISTRIBUTORS.md`](DISTRIBUTORS.md) for catalog integration guidelines.
