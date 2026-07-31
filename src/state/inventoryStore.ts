import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── State ─────────────────────────────────────────────────────────────────────
export interface InventoryState {
  // stock
  stockItems:   StockItem[]
  items:        StockItem[]   // alias kept for NotificationBell compat
  // waste
  wasteEntries: WasteEntry[]
  // counts
  counts:       InventoryCount[]
  // orders
  truckOrders:  TruckOrder[]
  loading: boolean
  error: string | null
  // actions – stock
  fetch: (search?: string) => Promise<void>
  addItem:    (data: Omit<StockItem, 'id'>) => Promise<void>
  updateItem: (id: string, data: Partial<StockItem>) => Promise<void>
  remove:     (id: string) => Promise<void>
  // actions – waste
  addWasteEntry:    (data: Omit<WasteEntry, 'id'>) => void
  removeWasteEntry: (id: string) => void
  // actions – counts
  addCount:    (data: Omit<InventoryCount, 'id'>) => void
  updateCount: (id: string, data: Partial<InventoryCount>) => void
  // actions – orders
  addOrder:    (data: Omit<TruckOrder, 'id'>) => TruckOrder
  updateOrder: (id: string, data: Partial<TruckOrder>) => void
  // helpers
  getLowParItems:  () => StockItem[]
  getZeroItems:    () => StockItem[]
}

function uid() { return Math.random().toString(36).slice(2, 10) }

function toStock(row: Record<string, unknown>): StockItem {
  return {
    id:         row.id as string,
    item:       row.item as string,
    category:   ((row.category as string) ?? 'Other') as InventoryCategory,
    qty:        Number(row.quantity ?? row.qty ?? 0),
    unit:       (row.unit as string) ?? '',
    min:        Number(row.par_level ?? row.min ?? 0),
    reorderQty: row.reorder_qty != null ? Number(row.reorder_qty) : undefined,
    cost:       row.cost        != null ? Number(row.cost)        : undefined,
    vendor:     (row.vendor as string | null) ?? undefined,
    notes:      (row.notes  as string | null) ?? undefined,
  }
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stockItems: [], items: [], wasteEntries: [], counts: [], truckOrders: [],
  loading: false, error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.from('inventory').select('*').order('item')
    if (error) { set({ error: error.message, loading: false }); return }
    const stock = (data ?? []).map((r: any) => toStock(r as Record<string, unknown>))
    set({ stockItems: stock, items: stock, loading: false })
  },

  addItem: async (data) => {
    const row = {
      item: data.item, category: data.category,
      quantity: data.qty, unit: data.unit, par_level: data.min,
      ...(data.reorderQty !== undefined && { reorder_qty: data.reorderQty }),
      ...(data.cost       !== undefined && { cost:        data.cost }),
      ...(data.vendor     !== undefined && { vendor:      data.vendor }),
      ...(data.notes      !== undefined && { notes:       data.notes }),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('inventory') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    const item = toStock(r as Record<string, unknown>)
    set(s => { const next = [...s.stockItems, item].sort((a, b) => a.item.localeCompare(b.item)); return { stockItems: next, items: next } })
  },

  updateItem: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.item       !== undefined) patch.item       = data.item
    if (data.category   !== undefined) patch.category   = data.category
    if (data.qty        !== undefined) patch.quantity   = data.qty
    if (data.unit       !== undefined) patch.unit       = data.unit
    if (data.min        !== undefined) patch.par_level  = data.min
    if (data.reorderQty !== undefined) patch.reorder_qty = data.reorderQty
    if (data.cost       !== undefined) patch.cost       = data.cost
    if (data.vendor     !== undefined) patch.vendor     = data.vendor
    if (data.notes      !== undefined) patch.notes      = data.notes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('inventory') as any).update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    const updated = toStock(r as Record<string, unknown>)
    set(s => { const next = s.stockItems.map(i => i.id === id ? updated : i); return { stockItems: next, items: next } })
  },

  remove: async (id) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => { const next = s.stockItems.filter(i => i.id !== id); return { stockItems: next, items: next } })
  },

  // Waste — local only (no DB table yet)
  addWasteEntry: (data) => {
    const entry: WasteEntry = { ...data, id: uid() }
    set(s => ({ wasteEntries: [...s.wasteEntries, entry] }))
  },
  removeWasteEntry: (id) => set(s => ({ wasteEntries: s.wasteEntries.filter(e => e.id !== id) })),

  // Counts — local only
  addCount: (data) => {
    const count: InventoryCount = { ...data, id: uid() }
    set(s => ({ counts: [...s.counts, count] }))
  },
  updateCount: (id, data) => set(s => ({
    counts: s.counts.map(c => c.id === id ? { ...c, ...data } : c)
  })),

  // Truck orders — local only
  addOrder: (data) => {
    const order: TruckOrder = { ...data, id: uid() }
    set(s => ({ truckOrders: [...s.truckOrders, order] }))
    return order
  },
  updateOrder: (id, data) => set(s => ({
    truckOrders: s.truckOrders.map(o => o.id === id ? { ...o, ...data } : o)
  })),

  getLowParItems: () => get().stockItems.filter(i => i.qty < i.min && i.min > 0),
  getZeroItems:   () => get().stockItems.filter(i => i.qty <= 0),
}))
