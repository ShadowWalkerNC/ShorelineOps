# Distributor Partner Onboarding & Integration Guide

Welcome to the **Shoreline Operations Platform (ShorelineOps)** Distributor Onboarding Program. 

ShorelineOps is an open-source, distributor-agnostic dietary operations platform designed for assisted living and skilled nursing facilities. This guide explains how food distributors (such as **Dennis Food Service**) integrate catalog data, maintain order guides, and receive purchase orders from healthcare facilities using Shoreline.

---

## 🌟 Why Partner with Facilities on ShorelineOps?

1. **Clean, Structured Electronic Orders**: Eliminate illegible handwritten orders and phone miscommunications. Facilities generate verified, par-checked purchase orders mapped directly to your vendor SKUs.
2. **Reduced Food Waste & Returns**: Built-in portion scaling, resident census tracking, and allergy verification ensure facilities order the exact quantities and pack sizes required.
3. **Dedicated Distributor Partner Portal**: Distributors receive direct portal access (`/distributor`) to manage broadline SKUs, pack sizes, and contract unit pricing.
4. **Distributor Independence**: Shoreline does not lock facilities into one proprietary ERP; instead, it provides clean, standardized adapters (Dennis, broadline CSV, and EDI).

---

## 🚀 Onboarding Steps for Food Distributors

### Step 1: Assigning Distributor Access
During facility onboarding or vendor setup, the facility administrator creates a dedicated **Distributor Partner (`distributor`)** account for your sales/account team.

- **Role**: `distributor` (Distributor Partner)
- **Permissions**:
  - `manage:vendor_catalog`: Add, edit, or discontinue product SKUs, brand names, pack sizes, and pricing.
  - `view:vendor_catalog`: Inspect active catalog mappings.
- **Security**: The distributor account has strictly scoped access and **cannot view resident Protected Health Information (PHI)**, timecards, or internal medical records.

---

### Step 2: Ingesting Your Product Catalog (Item Master)

Distributors can populate product catalogs in Shoreline via three methods:

#### Option A: Direct Distributor Portal UI (`/distributor`)
Your catalog coordinator logs into the portal and clicks **"+ Add New Product SKU"**:
- **Distributor SKU / Item #**: e.g., `DNS-1001`
- **Description**: `Peaches Diced in 100% Juice`
- **Brand**: `Dennis Select`
- **Category**: `Canned Fruits`
- **Pack Size & UOM**: `6/#10 cans` / `case`
- **Contract Unit Price**: `$48.50`

#### Option B: Bulk CSV Template Import
You can supply your order guide or broadline catalog in standard CSV format:
```csv
vendor_sku,name,brand,pack_size,uom,category,unit_cost
DNS-1001,"Peaches Diced in 100% Juice","Dennis Select","6/#10 cans",case,"Canned Fruits",48.50
DNS-1002,"Orange Juice Thickened Nectar","Thick & Easy","12/32oz",case,"Thickened Beverages",32.75
DNS-1003,"Pureed Green Beans","Puree Supreme","24/4oz",case,"Pureed Foods",29.90
DNS-1004,"Chicken Breast Boneless Skinless 4oz","Dennis Farms","40/4oz",case,"Poultry & Meat",64.20
```

#### Option C: Automated API / Adapter (`server/src/integrations/`)
If your organization provides an automated pricing or catalog feed, Shoreline's `DistributorConnector` interface (`DennisConnector`) can ingest daily or weekly SKU and price updates.

---

### Step 3: Order Guide & Par Level Setup

The facility's dietary manager or registered dietitian maps daily recipe ingredients to your preferred distributor SKUs:
1. Shoreline compares upcoming menu requirements and on-hand kitchen inventory against agreed Par Levels.
2. When inventory falls below par, Shoreline automatically calculates the suggested order quantity.

---

### Step 4: Receiving Facility Purchase Orders

When the facility dietary manager approves the order:
1. **Dennis-Ready CSV Export**: Formatted with exact vendor name, item description, distributor SKU, pack size, UOM, and order quantity.
2. **Printable Purchase Sheet**: Clear paper worksheet for sales reps or delivery drivers.
3. **Electronic Transmission (V2 EDI/API)**: Directly injected into your online ordering platform.

**Example Dennis CSV Order Output:**
```csv
vendor,name,sku,pack,uom,qty
"Dennis Food Service","Peaches Diced in Juice","DNS-1001","6/#10 cans","case",3
"Dennis Food Service","Orange Juice Thickened Nectar","DNS-1002","12/32oz","case",2
"Dennis Food Service","Pureed Green Beans","DNS-1003","24/4oz","case",1
```

---

## 🔒 Security, Compliance & Role-Based Isolation

- **PHI Protection**: Healthcare privacy regulations (HIPAA §164.312) prohibit third-party vendor access to resident health records. Distributor partner accounts are cryptographically restricted to catalog and order guide endpoints.
- **Audit Logging**: Every SKU creation, price update, and order export is recorded in the append-only `audit_log` table.
- **Session Protection**: Automatic idle logouts occur after 10 minutes of inactivity.

---

## 📞 Support & Technical Inquiries
For technical questions regarding API connectors, custom EDI mapping, or catalog uploads, contact the ShorelineOps integration team or refer to `ARCHITECTURE.md` in the repository.
