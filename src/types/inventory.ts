// ============================================================
// INVENTORY — FULL TYPE SYSTEM
// ============================================================
// Covers: item catalog, physical counts (zero-balance sheets),
// truck orders, vendor pricing, price history, storage locations,
// and location-level settings (truck day, count day, budget).
//
// Flow:
//   Receive truck → update currentQty
//   Menu planned → deduct projected usage from currentQty
//   Count day → InventoryCount submitted → variance flagged
//   Low par → auto-suggest TruckOrderItem quantities
// ============================================================

// ── Enumerations ─────────────────────────────────────────────────────────────
export const INVENTORY_CATEGORIES = [
  'Protein',
  'Produce',
  'Dairy',
  'Dry Goods',
  'Frozen',
  'Beverages',
  'Condiments',
  'Cleaning',
  'Paper Goods',
  'Other',
] as const
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]

export const INVENTORY_UNITS = [
  'each',
  'case',
  'lb',
  'oz',
  'gallon',
  'quart',
  'liter',
  'bag',
  'box',
  'can',
  'jar',
  'bottle',
  'pack',
  'tray',
  'flat',
] as const
export type InventoryUnit = typeof INVENTORY_UNITS[number]

export const STORAGE_LOCATIONS = [
  'Walk-in Cooler',
  'Walk-in Freezer',
  'Dry Storage',
  'Reach-in Cooler',
  'Reach-in Freezer',
  'Pantry',
  'Dry Storage Rack',
] as const
export type StorageLocation = typeof STORAGE_LOCATIONS[number]

// ── Inventory Item Catalog ────────────────────────────────────────────────────
export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  unit: InventoryUnit
  /** Current on-hand quantity in the given unit */
  currentQty: number
  /** Minimum qty before a reorder should be triggered */
  parLevel: number
  /** Suggested order quantity when below par */
  reorderQty: number
  /** Primary vendor / distributor name */
  vendor: string
  /** Vendor's SKU / product code */
  vendorSku?: string
  /** Current cost per unit — synced from latest PriceRecord */
  unitCost: number
  /** Historical price changes for trend tracking */
  priceHistory: PriceRecord[]
  /**
   * Recipe ingredient names this item maps to.
   * Enables: menu → recipe → ingredient → inventory deduction chain.
   */
  linkedIngredients: string[]
  storageLocation: StorageLocation
  /** Pack size description, e.g. "6 x 10 lb bags per case" */
  packSize?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Records a price change event for trend analysis and truck order costing */
export interface PriceRecord {
  date: string              // YYYY-MM-DD
  unitCost: number
  changedById: string       // staff/auth user ID
  note?: string             // e.g. "Q3 vendor price increase"
}

// ── Physical Inventory Count (Zero-Balance Sheet) ─────────────────────────────
/**
 * Represents one full inventory count cycle.
 * Demo: submitted Sunday night before Tuesday truck.
 * Admin can configure countDayOfWeek and truckDayOfWeek per location.
 */
export interface InventoryCount {
  id: string
  locationId: string
  /** Date the count was conducted */
  countDate: string         // YYYY-MM-DD
  submittedById: string
  submittedAt?: string
  status: InventoryCountStatus
  approvedById?: string
  approvedAt?: string
  items: InventoryCountItem[]
  /** Overall notes for the count — discrepancies, missing items, etc. */
  notes?: string
  createdAt: string
}

export type InventoryCountStatus =
  | 'Draft'         // being filled out
  | 'Submitted'     // sent for manager review
  | 'Approved'      // manager signed off
  | 'Discrepancy'   // variance exceeds threshold — needs investigation

export interface InventoryCountItem {
  inventoryItemId: string
  itemName: string          // snapshot name at time of count
  unit: InventoryUnit
  /** Qty the system expects based on last approved count + receives - usage */
  expectedQty: number
  /** Qty physically counted by staff */
  countedQty: number
  /** countedQty - expectedQty — negative = shrinkage/loss */
  variance: number
  note?: string
}

// ── Truck Orders ──────────────────────────────────────────────────────────────
export interface TruckOrder {
  id: string
  vendorName: string
  /** Date the delivery is expected */
  deliveryDate: string      // YYYY-MM-DD
  /** Order must be submitted by this date/time */
  cutoffDate: string        // YYYY-MM-DD
  status: TruckOrderStatus
  items: TruckOrderItem[]
  /** Calculated: sum of all lineTotal values */
  totalCost: number
  /** Notes visible to all kitchen staff */
  notes?: string
  submittedById?: string
  submittedAt?: string
  receivedById?: string
  receivedAt?: string
  createdAt: string
  updatedAt: string
}

export type TruckOrderStatus =
  | 'Draft'         // being built
  | 'Pending Approval' // submitted, awaiting manager OK
  | 'Approved'      // approved, ready to send to vendor
  | 'Submitted'     // sent to vendor
  | 'Received'      // delivery received and checked in
  | 'Partial'       // delivery received but items missing/shorted

export interface TruckOrderItem {
  inventoryItemId: string
  itemName: string          // snapshot
  unit: InventoryUnit
  /** Qty ordered from vendor */
  orderedQty: number
  /** Qty actually received — filled in on delivery */
  receivedQty?: number
  /** Price per unit at time of order */
  unitCost: number
  /** orderedQty × unitCost */
  lineTotal: number
  note?: string
}

// ── Vendor ────────────────────────────────────────────────────────────────────
export interface VendorContact {
  id: string
  name: string
  rep?: string
  phone?: string
  email?: string
  accountNumber?: string
  notes?: string
}

// ── Location Settings ─────────────────────────────────────────────────────────
/**
 * Per-location admin configuration.
 * Demo defaults: truck = Wednesday (3), count = Sunday (0), deadline = 22:00.
 */
export interface LocationSettings {
  id: string
  name: string
  /** 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat */
  truckDayOfWeek: number
  /** Day staff must submit inventory count */
  inventoryCountDayOfWeek: number
  /** Hour (0-23) by which count must be submitted on count day */
  countDeadlineHour: number
  /** USD per resident per day — drives budget calculations */
  budgetPerResidentPerDay: number
  vendors: VendorContact[]
}
