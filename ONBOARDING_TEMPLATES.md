# ShorelineOps Facility Onboarding & Data Import Templates

This document provides standardized spreadsheet formats (CSV / Excel) to onboard new senior living facilities into ShorelineOps in under 10 minutes.

---

## 1. Resident Census & Diet Order Template (`residents_import.csv`)

Copy and paste this format into Excel or CSV to batch-import resident clinical profiles:

```csv
First Name,Last Name,Room,Status,Diet Order,Texture,Portion,Allergies,Beverages,Serving Location,Table
Margaret,Holloway,101,Active,NAS / Low Sodium,Regular,Regular,Gluten;Wheat,Milk;Water,Dining Room,Table 1
Arthur,Pendelton,112-B,Active,Diabetic / NCS,Pureed,Small,Shellfish;Tree Nuts,Thickened Nectar;Apple Juice,Dining Room,Table 2
Harold,Finch,108-A,Active,Regular,Ground / Minced,Regular,Peanuts,Unsweetened Tea,Dining Room,Table 3
Eleanor,Vance,104-A,Active,Regular,Regular,Regular,None,Decaf Coffee;Water,Room Delivery,Tray
Walter,Bishop,204-B,Active,Renal Diet,Regular,Large,None,Cranberry Juice;Water,Dining Room,Table 4
```

### Column Reference:
- **Status**: `Active`, `Hospital`, `LOA` (Leave of Absence), `Discharged`
- **Diet Order**: `Regular`, `NAS` (No Added Salt), `NCS` (No Concentrated Sweets / Diabetic), `Renal`, `Cardiac`, `Low Fat`, `Vegetarian`
- **Texture**: `Regular`, `Mechanical Soft`, `Ground / Minced`, `Pureed`, `Cut-Up`
- **Allergies**: Semicolon-separated list (e.g. `Shellfish;Peanuts;Dairy;Gluten;Soy;Eggs;Seeds`)
- **Beverages**: Semicolon-separated list (e.g. `Water;Thickened Nectar;Coffee;Milk;Juice`)

---

## 2. Dennis Food Service / Broadline Order Guide Template (`order_guide_import.csv`)

Copy and paste your distributor's item list into this format for 1-click drag-and-drop ingestion:

```csv
SKU,Description,Brand,Category,Pack Size,UOM,Unit Cost,Par Level,On Hand
DNS-1001,Peaches Diced in 100% Juice,Dennis Select,Canned Fruits,6/#10 cans,case,48.50,5,2
DNS-1002,Orange Juice Thickened Nectar,Thick & Easy,Thickened Beverages,12/32oz,case,32.75,4,1
DNS-1003,Pureed Green Beans,Puree Supreme,Pureed Foods,24/4oz,case,29.90,3,1
DNS-1004,Chicken Breast Boneless Skinless 4oz,Dennis Farms,Poultry & Meat,40/4oz,case,64.20,6,3
DNS-1005,Mashed Potatoes Instant Flakes,Basic American,Starches,6/5.5lb,case,41.10,4,2
DNS-1006,Liquid Whole Eggs with Citric,Dennis Select,Dairy & Eggs,15/2lb,case,52.80,5,4
DNS-1007,Skim Milk Half Pint Cartons,Oakhurst,Dairy & Eggs,50/8oz,case,24.50,8,3
DNS-1008,Ensure Plus Vanilla Nutrition Shake,Abbott Nutrition,Supplements,24/8oz,case,46.00,6,2
```

### Ingestion Instructions:
1. Navigate to **`Purchasing & Orders`** (`/purchasing`).
2. Click **`📥 Import Dennis CSV Guide`**.
3. Drag and drop this CSV file directly into the dropzone.
4. Review the auto-detected columns in the live preview table and click **Commit Items**.

---

## 3. Facility Physical Layout Checklist

Before launching a facility's instance in the `/setup` wizard, collect the following details from the Executive Director:

- **Facility Legal Name & Type**: (e.g., Assisted Living, Memory Care, SNF, CCRC)
- **Wings / Care Units**: (e.g., `East Wing`, `West Wing`, `Memory Care Haven`, `Short-Stay Rehab`)
- **Dining Rooms & Service Areas**: (e.g., `Main Dining Room`, `Courtyard Cafe`, `Memory Care Dining`, `Room Tray Delivery`)
- **Primary Administrator**: (Full Name, Work Email, Secure Password)
- **Designated BAA Signee**: (Executive Director or Compliance Officer Name)
