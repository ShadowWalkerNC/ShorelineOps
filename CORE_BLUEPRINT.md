# ShorelineOps Core Blueprint: Lean Dietary Operations & Clinical Kitchen Intelligence

> **Mission**: Eliminate corporate dietary bloat, excessive management layers, and rigid software lock-in.  
> Run a safe, compliant, high-quality healthcare kitchen with just a **Chef and an Assistant**.

---

## 1. 👥 The Lean Kitchen Model: How 2 People Run the Entire Dietary Department

In traditional corporate senior living, facilities employ a bloated hierarchy:
- 1 Dietary Director / Manager ($65k–$85k)
- 1 Dietary Supervisor / Lead ($45k)
- 2–3 Full-Time Dietary Aides ($35k ea)
- Cooks & Dishwashers

**ShorelineOps eliminates the administrative bloat so you only need:**
1. **The Chef / Lead Cook**: Handles daily prep, production scaling on the tablet, and 1-click Dennis food ordering.
2. **The Assistant / Cook Aide**: Handles plating/tray line verification, dishwashing, and dining room delivery.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        HOW SHORELINE REPLACES 3 FULL-TIME JOBS                         │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Former Corporate Role   │ What They Did (Manual)     │ How Shoreline Automates It      │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ **Dietary Manager**     │ Calculating par levels,    │ **Suggested Order Generator**   │
│                         │ building distributor POs,  │ (`Par - On Hand`) + Dennis CSV  │
│                         │ logging $/CPD food costs.  │ export does this in 30 seconds. │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ **Dietary Supervisor**  │ Writing daily cook sheets, │ **Kitchen Tablet Mode** scales  │
│                         │ batch math, checking temp  │ recipe yields to live census    │
│                         │ logs on clipboards.        │ automatically with 1 tap.       │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ **Dietary Office Aide** │ Hand-writing tray cards,   │ **Digital Tray Line & Printing**│
│                         │ transcribing diet orders   │ auto-syncs with nursing changes │
│                         │ from nursing paper notes.  │ with bold red allergen alerts.  │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

---

## 2. 🍽️ Healthcare Meal Structure & Nutrition Standards (CMS / State Rules)

In healthcare and senior living (Assisted Living, Memory Care, SNF), meals must follow the **CMS 3-Meal & Snack Regulation** (maximum 14 hours between dinner and breakfast):

### Standard Senior Living Meal Architecture:
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MEAL          │ REQUIRED COMPONENTS (CMS / State Title 22 Guidelines)                  │
├───────────────┼────────────────────────────────────────────────────────────────────────┤
│ **Breakfast** │ • 2-3 oz Protein (Eggs, Sausage, Cottage Cheese)                       │
│               │ • 1-2 Servings Grain/Starch (Oatmeal, Pancakes, Toast)                 │
│               │ • 1/2 Cup Fruit or 4 oz 100% Juice                                     │
│               │ • 8 oz Milk (Whole/Skim) or Hot Beverage (Coffee/Tea)                  │
├───────────────┼────────────────────────────────────────────────────────────────────────┤
│ **Lunch**     │ • 3-4 oz High-Biological Protein (Chicken Breast, Roast Beef, Fish)    │
│ *(Main Meal)* │ • 1/2 Cup Starch (Mashed Potatoes, Brown Rice, Pasta)                  │
│               │ • 1/2 Cup Cooked Vegetable (Green Beans, Carrots, Broccoli)            │
│               │ • Bread & Butter                                                       │
│               │ • Dessert (Pudding, Fruit, Cake / Sugar-Free NCS Alternative)          │
│               │ • 8 oz Beverage (Water, Milk, Juice, Thickened Liquid)                 │
├───────────────┼────────────────────────────────────────────────────────────────────────┤
│ **Dinner**    │ • 2-3 oz Protein (Soup & Half Sandwich, Casserole, Quiche)             │
│ *(Lighter)*   │ • 1/2 Cup Vegetable or Side Salad                                      │
│               │ • Fresh Fruit or Light Dessert                                         │
│               │ • 8 oz Beverage                                                        │
├───────────────┼────────────────────────────────────────────────────────────────────────┤
│ **Snacks**    │ • Afternoon & Evening: Graham crackers, juice, fruit cup, or shake     │
└───────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 💵 Food Spend vs. Dry Goods vs. Chemicals ($/CPD Breakdown)

Target Cost Per Resident Day (**$8.50 – $11.50 / resident-day** for a standard 60-bed assisted living facility):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ CATEGORY               │ % OF BUDGET │ COST / RESIDENT DAY ($/CPD) │ EXAMPLE (60 BEDS) │
├────────────────────────┼─────────────┼─────────────────────────────┼───────────────────┤
│ **Perishable Food**    │ 60%         │ $5.50 – $6.50 / day         │ $360.00 / day     │
│ (Meats, Dairy, Produce)│             │                             │                   │
├────────────────────────┼─────────────┼─────────────────────────────┼───────────────────┤
│ **Dry Grocery / Canned**│ 25%        │ $2.25 – $2.75 / day         │ $150.00 / day     │
│ (Flour, Grains, Sauces)│             │                             │                   │
├────────────────────────┼─────────────┼─────────────────────────────┼───────────────────┤
│ **Paper & Dry Goods**  │ 10%         │ $0.90 – $1.20 / day         │ $60.00 / day      │
│ (Napkins, Cups, Gloves)│             │                             │                   │
├────────────────────────┼─────────────┼─────────────────────────────┼───────────────────┤
│ **Sanitation/Chemicals**│ 5%         │ $0.45 – $0.60 / day         │ $30.00 / day      │
│ (Dish detergent, Sanitizer)          │                             │                   │
├────────────────────────┼─────────────┼─────────────────────────────┼───────────────────┤
│ **TOTAL DAILY BUDGET** │ **100%**    │ **$9.10 – $11.05 / day**    │ **$600.00 / day** │
└────────────────────────┴─────────────┴─────────────────────────────┴───────────────────┘
```

---

## 4. 🏥 Clinical Dietary Workflow: How Nurses & Dietitians Enter Orders

Nurses and Dietitians have a dedicated fast-entry screen (`/residents/:id`) that requires zero complex training:

1. **Diet Order**: Select from therapeutic dropdown (Regular, NAS / Low Sodium, Diabetic / NCS, Renal, Cardiac).
2. **Texture (IDDSI Level)**: Select from standardized textures:
   - Regular (Level 7)
   - Soft & Bite-Sized (Level 6)
   - Minced & Moist (Level 5)
   - Pureed (Level 4)
3. **Liquid Consistency**: Regular Thin, Nectar-Thick (Mildly Thick), Honey-Thick (Moderately Thick), Pudding-Thick.
4. **Allergies & Dislikes**: Checkbox tags (Gluten, Dairy, Peanuts, Tree Nuts, Eggs, Shellfish, Soy, Seeds).
5. **Instant Kitchen Propagation**: When a nurse hits "Save", the Kitchen Tablet Mode (`/kitchen/tablet`) and Printable Tray Cards (`/kitchen/traycards`) update immediately with bold red safety alerts.

---

## 5. 🤖 Gemini AI Integration (High-Value Pro Features)

You can plug in the **Google Gemini API** (`@google/genai`) to provide smart kitchen superpowers:

1. **AI Menu Recipe Nutrition & Allergen Scanner**:
   - Paste any raw recipe text or photo of a distributor spec sheet ➔ Gemini extracts ingredients, detects hidden allergens (e.g. whey ➔ dairy, soy lecithin), and calculates estimated calories/sodium/protein.
2. **AI Therapeutic Diet Substitution Assistant**:
   - When a resident on a pureed or renal diet is admitted, Gemini suggests safe menu alternatives in real time (e.g., *"Replace broccoli with pureed carrots and replace ham with roasted turkey for low-sodium renal compliance"*).
3. **AI Distributor Invoice Reconciliation**:
   - Snap a photo or upload a Dennis PDF delivery invoice ➔ Gemini extracts item quantities and compares against the purchase order to flag price creep or shorted items.

---

## 6. 🔒 Keeping HIPAA Compliance Simple & Bulletproof

Healthcare software does not need complex bloat to be HIPAA compliant. Shoreline implements the 4 essential technical safeguards:

1. **10-Minute Idle Auto-Logout**: If a kitchen tablet or nursing computer is left unattended, the screen automatically locks.
2. **Append-Only Immutable Audit Log**: Database triggers prevent deleting or editing history so inspectors can see who changed what and when.
3. **Role-Based Access (Distributor Isolation)**: Dennis Food Service sales reps can only see catalog SKUs and prices—they have zero access to resident names or medical charts.
4. **Encryption**: TLS 1.3 in transit and AES-256 for PostgreSQL databases.

---

## ☁️ 7. Hosting Model: Free Self-Hosted vs. Your Paid Managed SaaS

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TWO DEPLOYMENT MODES                                   │
├──────────────────────────────────────────┬─────────────────────────────────────────────┤
│ 🆓 FREE SELF-HOSTED (Open Source)        │ 💎 YOUR PAID MANAGED SAAS ($199–$399/mo)    │
├──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ • Facility downloads Docker Compose.     │ • You host the app in the cloud (AWS/Render)│
│ • Facility manages their own server.     │ • Automated daily encrypted backups.        │
│ • No support or custom vendor setup.     │ • You set up their Dennis order guide.      │
│ • Great for tech-savvy IT departments.   │ • Priority phone/email support.             │
│                                          │ • Turnkey BAA compliance coverage.          │
│                                          │ • Gemini AI recipe & invoice scanner.       │
└──────────────────────────────────────────┴─────────────────────────────────────────────┘
```
