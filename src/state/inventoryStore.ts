import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'

export const INVENTORY_CATEGORIES = [
  'Dry Goods', 'Canned Goods', 'Frozen', 'Dairy', 'Produce',
  'Meat & Seafood', 'Beverages', 'Cleaning Supplies', 'Paper Goods', 'Other',
] as const
export type InventoryCategory = typeof INVENTORY_CATEGORIES[number]

export interface StockItem {
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

export type WasteReason = 'Overproduction' | 'Plate Waste' | 'Expired' | 'Contamination' | 'Other'

export interface WasteEntry {
  id: string
  date: string
  item: string
  qty: number
  unit: string
  reason: WasteReason
  meal: 'Breakfast' | 'Lunch' | 'Dinner' | 'N/A'
  loggedBy: string
  cost?: number
}

export interface CountItem {
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

export interface InventoryCount {
  id: string
  countDate: string
  submittedById: string
  status: CountStatus
  items: CountItem[]
  notes: string
  submittedAt?: string
  approvedById?: string
}

export interface OrderLineItem {
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

export type OrderStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Submitted' | 'Received' | 'Partial'

export interface TruckOrder {
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

export interface InventoryState {
  stockItems:   StockItem[]
  items:        StockItem[]
  wasteEntries: WasteEntry[]
  counts:       InventoryCount[]
  truckOrders:  TruckOrder[]
  loading: boolean
  error: string | null
  fetch: (search?: string) => Promise<void>
  addItem:    (data: Omit<StockItem, 'id'>) => Promise<void>
  updateItem: (id: string, data: Partial<StockItem>) => Promise<void>
  remove:     (id: string) => Promise<void>
  addWasteEntry:    (data: Omit<WasteEntry, 'id'>) => void
  removeWasteEntry: (id: string) => void
  addCount:    (data: Omit<InventoryCount, 'id'>) => void
  updateCount: (id: string, data: Partial<InventoryCount>) => void
  addOrder:    (data: Omit<TruckOrder, 'id'>) => TruckOrder
  updateOrder: (id: string, data: Partial<TruckOrder>) => void
  getLowParItems: () => StockItem[]
  getZeroItems:   () => StockItem[]
}

function uid() { return crypto.randomUUID() }

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stockItems:   ls.get<StockItem[]>(LS_KEYS.stockItems, []),
  items:        ls.get<StockItem[]>(LS_KEYS.stockItems, []),
  wasteEntries: ls.get<WasteEntry[]>(LS_KEYS.wasteEntries, []),
  counts:       ls.get<InventoryCount[]>(LS_KEYS.counts, []),
  truckOrders:  ls.get<TruckOrder[]>(LS_KEYS.truckOrders, []),
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const stock = [...ls.get<StockItem[]>(LS_KEYS.stockItems, [])]
      .sort((a, b) => a.item.localeCompare(b.item))
    set({ stockItems: stock, items: stock, loading: false })
  },

  addItem: async (data) => {
    const item: StockItem = { ...data, id: uid() }
    const all = [...ls.get<StockItem[]>(LS_KEYS.stockItems, []), item]
      .sort((a, b) => a.item.localeCompare(b.item))
    ls.set(LS_KEYS.stockItems, all)
    set({ stockItems: all, items: all })
  },

  updateItem: async (id, data) => {
    const all = ls.get<StockItem[]>(LS_KEYS.stockItems, []).map(i =>
      i.id === id ? { ...i, ...data } : i
    )
    ls.set(LS_KEYS.stockItems, all)
    set({ stockItems: all, items: all })
  },

  remove: async (id) => {
    const all = ls.get<StockItem[]>(LS_KEYS.stockItems, []).filter(i => i.id !== id)
    ls.set(LS_KEYS.stockItems, all)
    set({ stockItems: all, items: all })
  },

  addWasteEntry: (data) => {
    const entry: WasteEntry = { ...data, id: uid() }
    const all = [...ls.get<WasteEntry[]>(LS_KEYS.wasteEntries, []), entry]
    ls.set(LS_KEYS.wasteEntries, all)
    set({ wasteEntries: all })
  },

  removeWasteEntry: (id) => {
    const all = ls.get<WasteEntry[]>(LS_KEYS.wasteEntries, []).filter(e => e.id !== id)
    ls.set(LS_KEYS.wasteEntries, all)
    set({ wasteEntries: all })
  },

  addCount: (data) => {
    const count: InventoryCount = { ...data, id: uid() }
    const all = [...ls.get<InventoryCount[]>(LS_KEYS.counts, []), count]
    ls.set(LS_KEYS.counts, all)
    set({ counts: all })
  },

  updateCount: (id, data) => {
    const all = ls.get<InventoryCount[]>(LS_KEYS.counts, []).map(c =>
      c.id === id ? { ...c, ...data } : c
    )
    ls.set(LS_KEYS.counts, all)
    set({ counts: all })
  },

  addOrder: (data) => {
    const order: TruckOrder = { ...data, id: uid() }
    const all = [...ls.get<TruckOrder[]>(LS_KEYS.truckOrders, []), order]
    ls.set(LS_KEYS.truckOrders, all)
    set({ truckOrders: all })
    return order
  },

  updateOrder: (id, data) => {
    const all = ls.get<TruckOrder[]>(LS_KEYS.truckOrders, []).map(o =>
      o.id === id ? { ...o, ...data } : o
    )
    ls.set(LS_KEYS.truckOrders, all)
    set({ truckOrders: all })
  },

  getLowParItems: () => get().stockItems.filter(i => i.qty < i.min && i.min > 0),
  getZeroItems:   () => get().stockItems.filter(i => i.qty <= 0),
}))
