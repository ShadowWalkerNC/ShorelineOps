# ShorelineOps (Shoreline Care Operations)

> **The Open-Source Dietary Operations & Care Coordination Platform for Senior Living Facilities.**  
> Built for Assisted Living, Memory Care, and Skilled Nursing kitchen teams.

---

## 🍽️ What is ShorelineOps?

**ShorelineOps** is a complete software application that runs the daily dietary, food production, and purchasing operations for senior living communities.

In senior living, foodservice is not just cooking—it is **clinical care**. Kitchens must prepare specialized textures for residents with swallowing disorders (dysphagia), eliminate deadly allergens, provide tray cards for meal delivery, balance food budgets, and order supplies from broadline distributors (like **Dennis Food Service**).

ShorelineOps replaces scattered binders, dry-erase boards, and outdated legacy software with a **single, easy-to-use digital system**.

---

## 🌟 What Can You Do with ShorelineOps?

### 1. 📋 Manage Resident Diets & Prevent Allergen Errors
- Maintain digital resident profiles with **therapeutic diet orders** (Low Sodium/NAS, Diabetic/NCS, Renal, Cardiac).
- Track **IDDSI texture modifications** (Regular, Mechanical Soft, Pureed, Minced & Moist, Nectar Thick liquids).
- Auto-flag allergies with **bold visual alerts** so the kitchen never serves the wrong ingredient to an allergic resident.
- Assign residents to specific dining room tables or room tray delivery carts.

### 2. 📱 Kitchen Tablet Mode (Built for Line Cooks & Prep Staff)
- A **touch-optimized, big-button interface** (`/kitchen/tablet`) designed specifically for kitchen iPads or wall-mounted touchscreens:
  - **🍳 Cook Worksheets**: View batch recipes scaled to today's census, track cooking temps (165°F), and check off prep items (`pending` ➔ `prepping` ➔ `completed`).
  - **📋 Digital Tray Card Line**: Step through resident meal tickets one-by-one during meal service with bold red allergy warnings and one-tap cart dispatch.
  - **📦 Quick Par Counter**: Conduct 2-minute morning walk-through inventory counts using simple `+` and `-` buttons without needing a keyboard.

### 3. 🛒 Distributor-Agnostic Purchasing & Dennis Food Service Ordering
- Establish **standing order guides** with minimum par levels and on-hand inventory counts.
- **Automated Suggested Order Generator**: One click calculates exactly what to order (`Par Level - On Hand`).
- **Drag-and-Drop CSV Ingestion**: Drop in Dennis Food Service order guides or catalog updates in seconds.
- **Instant Dennis Order Export**: Download ready-to-send electronic order files formatted specifically for Dennis Food Service.
- **Distributor Partner Portal (`/distributor`)**: Give your distributor sales rep secure access to update item SKUs and contract pricing without exposing resident medical data.

### 4. 📊 Food Cost per Resident Day ($/CPD) & State Compliance
- Track real-time **Food Cost per Resident Day ($/CPD)** and total operating costs (including dietary labor).
- Maintain an audit trail of **meal substitutions** with clinical justifications.
- Generate a one-click **Printable Dietary Compliance Summary** for state health inspection surveys.

### 5. 📅 Cycle Menu Planning & Recipe Book
- Build 4-to-5 week cycle menus with Choice A and Choice B entrees.
- **Smart Recipe Book**: Automatically scans ingredient names to detect allergens (`milk` ➔ `Dairy`, `flour` ➔ `Gluten`, `eggs` ➔ `Eggs`, `peanut/walnut` ➔ `Nuts`).
- Link recipe ingredients directly to distributor catalog SKUs for live cost-per-serving calculations.

---

## 🖥️ Screen-by-Screen Application Tour

| Navigation Section | What It Does | Who Uses It |
|---|---|---|
| 🔵 **Dashboard (`/`)** | Daily overview of resident census, meal tallies, active diet alerts, and fast shortcuts. | Everyone |
| 🟢 **Residents & Diets (`/residents`)** | Manage resident admissions, dietary restrictions, textures, allergies, and table seats. | Dietitians & Care Staff |
| 🔴 **Kitchen Tablet (`/kitchen/tablet`)** | High-contrast touch display for batch cook worksheets, tray card dispatch, and quick inventory steppers. | Line Cooks & Kitchen Staff |
| 🟡 **Menu Planner (`/menu`)** | Multi-week cycle menu calendar with meal slots and alternative options. | Dietary Directors |
| 🟣 **Purchasing & Orders (`/purchasing`)** | Standing order guide par levels, suggested purchase order generator, Dennis CSV sync, and order history. | Dietary Managers |
| 🟣 **Distributor Portal (`/distributor`)** | Vendor self-service portal to update product SKUs, pack sizes, and contract unit prices. | Food Distributor Reps |
| 🟢 **Cost & Compliance (`/reporting`)** | Food cost analytics ($/CPD), substitution logs, allergen safety audits, and state inspection sheets. | Executive Directors & DONs |
| 🟣 **Recipe Book (`/recipes`)** | Master recipe catalog with automatic allergen tagging and batch portion scaling. | Chefs & Dietary Staff |
| ⚪ **Staff & Timecards (`/staff`, `/timecards`)** | Staff schedule directory and punch clock log with kiosk support. | Managers |

---

## 🔒 Healthcare Privacy & Security (HIPAA Ready)

- **10-Minute Idle Auto-Logout**: Protects resident Protected Health Information (PHI) on shared dining and kitchen computers.
- **Append-Only Audit Log**: Database triggers prevent alteration or deletion of audit records for non-repudiation during state compliance surveys.
- **10 Role Access Levels**: Fine-grained permissions separating Super Admins, Registered Dietitians, Dietary Staff, Distributor Partners, and Read-Only users.
- **Vendor PHI Isolation**: Distributor reps can manage catalog pricing without access to resident names, medical charts, or timecards.

---

## 🚀 How to Run & Try ShorelineOps

### Try the Demo in 2 Minutes:
1. Open the application in your browser at **[http://localhost:3000](http://localhost:3000)** (or your deployed URL).
2. Sign in with the evaluation admin account:
   - **Email**: `admin@shoreline.demo`
   - **Password**: `Admin1234!`
3. Test **Kitchen Tablet Mode** (`/kitchen/tablet`), check **Resident Diets** (`/residents`), or generate a suggested order in **Purchasing** (`/purchasing`).

### Self-Hosting / Full Installation:
For full deployment instructions (Node.js, PostgreSQL, or One-Click Docker Compose), see:
- 💻 **[Developer & API Guide](DEVELOPERS.md)** — Complete tech stack, database schemas, and API documentation.
- 💼 **[Commercial Sales & ROI Guide](SALES_PITCH.md)** — Cost savings math ($1.50–$3.00/day), pricing tiers, and ROI breakdown.
- 📄 **[Commercial Services Agreement](COMMERCIAL_AGREEMENT.md)** — Software license agreement and HIPAA Business Associate Agreement (BAA).
- 🎬 **[Live Sales Demo Script](DEMO_SCRIPT.md)** — 5-minute walkthrough script for facility leadership.
- 📥 **[Onboarding Templates](ONBOARDING_TEMPLATES.md)** — CSV/Excel templates for 10-minute census and order guide imports.
- 🚚 **[Distributor Onboarding Guide](DISTRIBUTORS.md)** — Food distributor partner manual for Dennis Food Service.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
