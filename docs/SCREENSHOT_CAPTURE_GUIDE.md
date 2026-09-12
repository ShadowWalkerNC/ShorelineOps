# ShorelineOps — Official Screenshot Capture & Asset Guide

> **Purpose:** Step-by-step instructions to capture high-resolution, pixel-perfect real screenshots of the ShorelineOps platform for documentation, marketing, sales decks, and investor presentations.

---

## 🖥️ Recommended Browser & Display Setup
- **Resolution**: 1920 × 1080 (1080p) or 2560 × 1440 (1440p)
- **Browser**: Google Chrome or Safari (Clean window with no bookmarks bar)
- **Theme**: Light Mode / High-Contrast Mode for maximum legibility in print and docs
- **Local Dev URL**: `http://localhost:5173` (or live `https://shoreline-demo.onrender.com`)

---

## 📸 The 6 High-Impact Screenshots to Capture

### 1. Executive Culinary & Clinical Dashboard
- **Route**: `/` (`http://localhost:5173/`)
- **What to Display**:
  - Full screen showing the top summary cards: Active Resident Census (`74/80`), Food Cost per Resident Day gauge (`$8.42/CPD`), IDDSI texture donut chart, and real-time clinical allergen alerts banner.
- **Filename**: `docs/screenshots/dashboard_overview.jpg`

### 2. Multi-Distributor Lowest-Cost Split MRP
- **Route**: `/purchasing` (`http://localhost:5173/purchasing`)
- **What to Display**:
  - Show the 3-distributor price comparison matrix (Dennis Food Service vs Sysco vs US Foods).
  - Highlight the green savings badge (`Save $2.45 per resident day`) and the split purchase order proposal table.
- **Filename**: `docs/screenshots/split_mrp_purchasing.jpg`

### 3. 4-Week Seasonal Cycle Menu Planner
- **Route**: `/menu` (`http://localhost:5173/menu`)
- **What to Display**:
  - The 7-day calendar grid showing Breakfast, Lunch, and Dinner slots with Choice A and Choice B alternates and the side recipe drawer.
- **Filename**: `docs/screenshots/menu_cycle_planner.jpg`

### 4. Clinical Residents Roster & IDDSI Dysphagia Orders
- **Route**: `/residents` (`http://localhost:5173/residents`)
- **What to Display**:
  - Resident census table showing therapeutic diet orders (NAS, NCS, Renal), IDDSI Level 4 Pureed badges, bold red allergen warnings, and the RD Triage Queue tab.
- **Filename**: `docs/screenshots/residents_iddsi_triage.jpg`

### 5. CMS-2567 Digital Survey Ready Binder
- **Route**: `/reporting` (`http://localhost:5173/reporting`)
- **What to Display**:
  - The 1-click CMS-2567 digital survey binder crosswalk covering Federal F-Tags (F800 through F814) with 100% compliance checks.
- **Filename**: `docs/screenshots/cms_survey_binder.jpg`

### 6. Facility Profile & Clinical Standards Settings
- **Route**: `/settings` (`http://localhost:5173/settings`)
- **What to Display**:
  - The 5-tab settings console showing Facility Profile, Residential Wings & Dining Rooms, and CPD budget solver.
- **Filename**: `docs/screenshots/facility_settings.jpg`

---

## 📂 Where to Place the Captured Images
Save or copy your captured screenshots directly into:
```
ShorelineOps/docs/screenshots/
```
The `README.md` and documentation will immediately render them in full resolution.
