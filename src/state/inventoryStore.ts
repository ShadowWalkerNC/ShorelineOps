// ============================================================
// INVENTORY STORE
// ============================================================
// Single source of truth for all inventory data:
//   - stockItems   → on-hand quantities & par levels
//   - wasteEntries → logged food / supply waste
//   - truckOrders  → vendor orders with approval workflow
//   - counts       → zero-balance physical counts
//
// All data is seeded from constants on first fetch().
// Dashboard, NotificationBell, and InventoryPage all read
// from this store so edits persist across navigation.
//
// Production migration:
//   Replace fetch() with Supabase queries.
//   Mutations → supabase.from('inventory_items').upsert(...)
// ============================================================

import { create } from 'zustand'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InventoryCategory =
  | 'Proteins'
  | 'Produce'
  | 'Dairy'
  | 'Dry Goods'
  | 'Dietary / Special'
  | 'Beverages'
  | 'Paper & Supplies'

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'Proteins', 'Produce', 'Dairy', 'Dry Goods',
  'Dietary / Special', 'Beverages', 'Paper & Supplies',
]

export type StockItem = {
  id: string
  item: string
  category: InventoryCategory
  qty: number
  unit: string
  min: number
  reorderQty?: number
  cost?: number
  vendor?: string
  notes?: string
}

export type WasteReason = 'Expired' | 'Overproduction' | 'Contamination' | 'Plate Waste' | 'Other'
export type WasteMeal   = 'Breakfast' | 'Lunch' | 'Dinner' | 'N/A'

export type WasteEntry = {
  id: string
  date: string
  item: string
  qty: number
  unit: string
  reason: WasteReason
  meal: WasteMeal
  loggedBy: string
  cost?: number
}

export type CountItem = {
  id: string
  itemId: string
  itemName: string
  unit: string
  expected: number
  counted: number | ''
  variance: number
  note: string
}

export type CountStatus = 'Draft' | 'Submitted' | 'Approved' | 'Discrepancy'

export type InventoryCount = {
  id: string
  countDate: string
  submittedById: string
  status: CountStatus
  items: CountItem[]
  notes: string
  submittedAt?: string
}

export type OrderLineItem = {
  itemId: string
  itemName: string
  unit: string
  currentQty: number
  parLevel: number
  orderedQty: number
  receivedQty: number | ''
  unitCost: number
  vendor: string
  note: string
}

export type OrderStatus =
  | 'Draft'
  | 'Pending Approval'
  | 'Approved'
  | 'Submitted'
  | 'Received'
  | 'Partial'

export type TruckOrder = {
  id: string
  vendorName: string
  deliveryDate: string
  cutoffDate: string
  status: OrderStatus
  items: OrderLineItem[]
  notes: string
  createdAt: string
  submittedById?: string
  receivedById?: string
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }
const TODAY = new Date().toISOString().slice(0, 10)
const D = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10)

const SEED_STOCK: StockItem[] = [
  { id:'s1',  item:'Chicken Breast (frozen)',   category:'Proteins',          qty:40,  unit:'lbs',     min:20, reorderQty:30,  cost:3.80, vendor:'Sysco' },
  { id:'s2',  item:'Salmon Fillet (frozen)',     category:'Proteins',          qty:12,  unit:'lbs',     min:10, reorderQty:15,  cost:6.50, vendor:'Sysco' },
  { id:'s3',  item:'Ground Turkey',             category:'Proteins',          qty:8,   unit:'lbs',     min:10, reorderQty:15,  cost:4.20, vendor:'Sysco' },
  { id:'s4',  item:'Beef Chuck Roast',          category:'Proteins',          qty:20,  unit:'lbs',     min:15, reorderQty:20,  cost:5.60, vendor:'Sysco' },
  { id:'s5',  item:'Pork Loin Chops',           category:'Proteins',          qty:6,   unit:'lbs',     min:10, reorderQty:12,  cost:4.80, vendor:'Sysco' },
  { id:'s6',  item:'Russet Potatoes',           category:'Produce',           qty:50,  unit:'lbs',     min:30, reorderQty:40,  cost:0.60, vendor:'Sysco' },
  { id:'s7',  item:'Green Beans (frozen)',       category:'Produce',           qty:20,  unit:'lbs',     min:15, reorderQty:20,  cost:1.40, vendor:'Sysco' },
  { id:'s8',  item:'Broccoli (frozen)',          category:'Produce',           qty:15,  unit:'lbs',     min:10, reorderQty:15,  cost:1.60, vendor:'Sysco' },
  { id:'s9',  item:'Carrots (fresh)',            category:'Produce',           qty:10,  unit:'lbs',     min:8,  reorderQty:10,  cost:0.80, vendor:'Sysco' },
  { id:'s10', item:'Bananas',                   category:'Produce',           qty:30,  unit:'each',    min:20, reorderQty:30,  cost:0.25, vendor:'Sysco' },
  { id:'s11', item:'Whole Milk',                category:'Dairy',             qty:8,   unit:'gallons', min:6,  reorderQty:8,   cost:4.10, vendor:'Sysco' },
  { id:'s12', item:'Butter (unsalted)',          category:'Dairy',             qty:6,   unit:'lbs',     min:4,  reorderQty:6,   cost:3.50, vendor:'Sysco' },
  { id:'s13', item:'Cheddar Cheese (shredded)', category:'Dairy',             qty:5,   unit:'lbs',     min:3,  reorderQty:5,   cost:5.20, vendor:'Sysco' },
  { id:'s14', item:'Lactose-Free Milk',         category:'Dairy',             qty:4,   unit:'cartons', min:6,  reorderQty:8,   cost:3.00, vendor:'Sysco', notes:'Low — reorder' },
  { id:'s15', item:'Rolled Oats',               category:'Dry Goods',         qty:20,  unit:'lbs',     min:10, reorderQty:15,  cost:1.20, vendor:'Sysco' },
  { id:'s16', item:'Egg Noodles',               category:'Dry Goods',         qty:10,  unit:'lbs',     min:8,  reorderQty:12,  cost:1.80, vendor:'Sysco' },
  { id:'s17', item:'Brown Rice',                category:'Dry Goods',         qty:15,  unit:'lbs',     min:10, reorderQty:15,  cost:1.50, vendor:'Sysco' },
  { id:'s18', item:'Mac & Cheese (bulk)',        category:'Dry Goods',         qty:6,   unit:'lbs',     min:5,  reorderQty:8,   cost:2.20, vendor:'Sysco' },
  { id:'s19', item:'Gluten-Free Bread',          category:'Dietary / Special', qty:1,   unit:'loaves',  min:3,  reorderQty:6,   cost:6.50, vendor:'Sysco', notes:'LOW — gluten-free residents' },
  { id:'s20', item:'Ensure Original (Vanilla)',  category:'Dietary / Special', qty:24,  unit:'cans',    min:12, reorderQty:24,  cost:2.80, vendor:'Sysco' },
  { id:'s21', item:'Ensure Plus (Chocolate)',    category:'Dietary / Special', qty:6,   unit:'cans',    min:12, reorderQty:24,  cost:3.10, vendor:'Sysco', notes:'Below par' },
  { id:'s22', item:'Simply Thick (Nectar)',      category:'Dietary / Special', qty:2,   unit:'bottles', min:3,  reorderQty:4,   cost:18.00,vendor:'Sysco', notes:'LOW — thickened liquid residents' },
  { id:'s23', item:'Simply Thick (Honey)',       category:'Dietary / Special', qty:3,   unit:'bottles', min:2,  reorderQty:4,   cost:18.00,vendor:'Sysco' },
  { id:'s24', item:'Sugar-Free Syrup',           category:'Dietary / Special', qty:3,   unit:'bottles', min:2,  reorderQty:4,   cost:4.50, vendor:'Sysco' },
  { id:'s25', item:'No-Added-Salt Seasoning',    category:'Dietary / Special', qty:4,   unit:'jars',    min:2,  reorderQty:4,   cost:3.80, vendor:'Sysco' },
  { id:'s26', item:'Orange Juice (gallon)',      category:'Beverages',         qty:10,  unit:'gallons', min:6,  reorderQty:8,   cost:5.20, vendor:'Sysco' },
  { id:'s27', item:'Apple Juice (gallon)',       category:'Beverages',         qty:8,   unit:'gallons', min:6,  reorderQty:8,   cost:4.80, vendor:'Sysco' },
  { id:'s28', item:'Decaf Coffee (ground)',      category:'Beverages',         qty:6,   unit:'lbs',     min:4,  reorderQty:6,   cost:9.00, vendor:'Sysco' },
  { id:'s29', item:'Hot Tea Bags',              category:'Beverages',         qty:200, unit:'bags',    min:100,reorderQty:150, cost:0.05, vendor:'Sysco' },
  { id:'s30', item:'Hot Chocolate Mix',         category:'Beverages',         qty:3,   unit:'lbs',     min:2,  reorderQty:3,   cost:5.00, vendor:'Sysco' },
  { id:'s31', item:'Tray Liners',               category:'Paper & Supplies',  qty:500, unit:'sheets',  min:200,reorderQty:300, cost:0.04, vendor:'Sysco' },
  { id:'s32', item:'Disposable Cups (8 oz)',    category:'Paper & Supplies',  qty:300, unit:'each',    min:200,reorderQty:300, cost:0.06, vendor:'Sysco' },
  { id:'s33', item:'Napkins',                   category:'Paper & Supplies',  qty:1000,unit:'each',    min:500,reorderQty:500, cost:0.02, vendor:'Sysco' },
]

const SEED_WASTE: WasteEntry[] = [
  { id:'w1', date:TODAY, item:'Grilled Chicken Breast', qty:4,   unit:'portions', reason:'Overproduction', meal:'Lunch',  loggedBy:'Kitchen Staff', cost:15.20 },
  { id:'w2', date:TODAY, item:'Mashed Potatoes',        qty:6,   unit:'portions', reason:'Plate Waste',    meal:'Dinner', loggedBy:'Kitchen Staff', cost: 4.80 },
  { id:'w3', date:D(2),  item:'Salmon Fillet',          qty:2,   unit:'portions', reason:'Overproduction', meal:'Dinner', loggedBy:'Cook',          cost:13.00 },
  { id:'w4', date:D(3),  item:'Whole Milk',             qty:0.5, unit:'gallons',  reason:'Expired',        meal:'N/A',    loggedBy:'Cook',          cost: 2.05 },
  { id:'w5', date:D(4),  item:'Green Beans',            qty:3,   unit:'lbs',      reason:'Overproduction', meal:'Lunch',  loggedBy:'Kitchen Staff', cost: 4.20 },
]

// ── Store interface ────────────────────────────────────────────────────────────

interface InventoryState {
  stockItems:    StockItem[]
  wasteEntries:  WasteEntry[]
  truckOrders:   TruckOrder[]
  counts:        InventoryCount[]
  loading:       boolean
  seeded:        boolean

  fetch: () => Promise<void>

  // Stock
  updateItem:  (id: string, patch: Partial<StockItem>) => void
  addItem:     (item: Omit<StockItem, 'id'>) => void
  removeItem:  (id: string) => void

  // Waste
  addWasteEntry:    (entry: Omit<WasteEntry, 'id'>) => void
  removeWasteEntry: (id: string) => void

  // Truck Orders
  addOrder:    (order: Omit<TruckOrder, 'id' | 'createdAt'>) => TruckOrder
  updateOrder: (id: string, patch: Partial<TruckOrder>) => void

  // Inventory Counts
  addCount:    (count: Omit<InventoryCount, 'id'>) => void
  updateCount: (id: string, patch: Partial<InventoryCount>) => void

  // Derived helpers (call as getters, not selectors, to keep it simple)
  getLowParItems: () => StockItem[]
  getZeroItems:   () => StockItem[]
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stockItems:   [],
  wasteEntries: [],
  truckOrders:  [],
  counts:       [],
  loading:      false,
  seeded:       false,

  fetch: async () => {
    if (get().seeded) return          // only seed once per session
    set({ loading: true })
    await new Promise(r => setTimeout(r, 60))
    set({
      stockItems:   SEED_STOCK.map(i => ({ ...i })),
      wasteEntries: SEED_WASTE.map(e => ({ ...e })),
      truckOrders:  [],
      counts:       [],
      loading: false,
      seeded:  true,
    })
  },

  // ── Stock ──────────────────────────────────────────────────────────────────
  updateItem: (id, patch) =>
    set(s => ({ stockItems: s.stockItems.map(i => i.id === id ? { ...i, ...patch } : i) })),

  addItem: (item) =>
    set(s => ({ stockItems: [...s.stockItems, { ...item, id: uid() }] })),

  removeItem: (id) =>
    set(s => ({ stockItems: s.stockItems.filter(i => i.id !== id) })),

  // ── Waste ──────────────────────────────────────────────────────────────────
  addWasteEntry: (entry) =>
    set(s => ({ wasteEntries: [{ ...entry, id: uid() }, ...s.wasteEntries] })),

  removeWasteEntry: (id) =>
    set(s => ({ wasteEntries: s.wasteEntries.filter(e => e.id !== id) })),

  // ── Truck Orders ───────────────────────────────────────────────────────────
  addOrder: (order) => {
    const full: TruckOrder = { ...order, id: uid(), createdAt: new Date().toISOString() }
    set(s => ({ truckOrders: [full, ...s.truckOrders] }))
    return full
  },

  updateOrder: (id, patch) =>
    set(s => ({ truckOrders: s.truckOrders.map(o => o.id === id ? { ...o, ...patch } : o) })),

  // ── Inventory Counts ───────────────────────────────────────────────────────
  addCount: (count) =>
    set(s => ({ counts: [{ ...count, id: uid() }, ...s.counts] })),

  updateCount: (id, patch) =>
    set(s => ({ counts: s.counts.map(c => c.id === id ? { ...c, ...patch } : c) })),

  // ── Derived ────────────────────────────────────────────────────────────────
  getLowParItems: () => get().stockItems.filter(i => i.qty < i.min),
  getZeroItems:   () => get().stockItems.filter(i => i.qty === 0),
}))
