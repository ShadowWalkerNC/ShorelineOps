import { create } from 'zustand'
import { api } from '@/api/client'
import { supabase } from '@/lib/supabase'

// ============================================================
// INVENTORY STORE — server-backed (B09)
// ------------------------------------------------------------
// All five inventory tabs read/write the Shoreline API
// (/api/inventory): items CRUD, the append-only transaction
// ledger, waste log, and count-sheet sessions. The only local
// state left is the truck-order draft flow (retired in B11) and
// pure UI prefs. A one-time import pulls legacy
// `shoreline_db_inventory` localStorage rows onto the server.
// ============================================================

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

export interface InventoryTransaction {
  id: string
  itemId: string | null
  itemName: string | null
  type: 'receipt' | 'issue' | 'waste' | 'count_adjust'
  qty: number
  unit: string
  userId: string | null
  note: string
  meta: Record<string, any>
  createdAt: string
}

export interface InventoryTrends {
  days: number
  wasteEvents: number
  wasteCost: number
  receipts: number
  issues: number
  wasteByReason: Record<string, { count: number; cost: number }>
  wasteByMeal: Record<string, { count: number; cost: number }>
  stockByCategory: { category: string; items: number; low: number; value: number }[]
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
  // ledger + trends
  transactions: InventoryTransaction[]
  trends:       InventoryTrends | null
  loading: boolean
  error: string | null
  // actions – stock
  fetch: (search?: string) => Promise<void>
  addItem:    (data: Omit<StockItem, 'id'>) => Promise<void>
  updateItem: (id: string, data: Partial<StockItem>) => Promise<void>
  remove:     (id: string) => Promise<void>
  // actions – waste
  addWasteEntry:    (data: Omit<WasteEntry, 'id'>) => Promise<void>
  // actions – counts
  addCount:    (data: Omit<InventoryCount, 'id'>) => Promise<void>
  updateCount: (id: string, data: Partial<InventoryCount>) => Promise<void>
  // one-time legacy localStorage → server import
  importLegacy: () => Promise<number>
  // helpers
  getLowParItems:  () => StockItem[]
  getZeroItems:    () => StockItem[]
}

const IMPORT_FLAG = 'shoreline_inventory_imported_v1'
const LEGACY_KEY  = 'shoreline_db_inventory'

function toStock(row: any): StockItem {
  return {
    id:         row.id,
    item:       row.name ?? row.item,
    category:   (row.category ?? 'Other') as InventoryCategory,
    qty:        Number(row.onHand ?? row.on_hand ?? row.quantity ?? row.qty ?? 0),
    unit:       row.unit ?? '',
    min:        Number(row.parLevel ?? row.par_level ?? row.min ?? 0),
    reorderQty: row.reorderQty != null ? Number(row.reorderQty) : undefined,
    cost:       row.unitCost != null ? Number(row.unitCost)
              : row.unit_cost != null ? Number(row.unit_cost)
              : row.cost != null ? Number(row.cost) : undefined,
    vendor:     row.vendor ?? undefined,
    notes:      row.notes ?? undefined,
  }
}

const WASTE_REASON_SET = new Set(['Overproduction', 'Plate Waste', 'Expired', 'Contamination', 'Other'])

function toWaste(t: InventoryTransaction): WasteEntry {
  const m = t.meta ?? {}
  const reason = WASTE_REASON_SET.has(m.reason) ? m.reason as WasteReason : 'Other'
  const meal = (['Breakfast', 'Lunch', 'Dinner', 'N/A'] as const).includes(m.meal) ? m.meal : 'N/A'
  return {
    id:       t.id,
    date:     typeof m.date === 'string' && m.date ? m.date : (t.createdAt ?? '').slice(0, 10),
    item:     typeof m.itemName === 'string' && m.itemName ? m.itemName : (t.itemName ?? ''),
    qty:      Math.abs(t.qty),
    unit:     t.unit,
    reason,
    meal,
    loggedBy: typeof m.loggedBy === 'string' ? m.loggedBy : '',
    cost:     m.cost != null ? Number(m.cost) : undefined,
  }
}

function toCount(c: any): InventoryCount {
  return {
    id:            c.id,
    countDate:     c.countDate,
    submittedById: c.submittedById ?? '',
    status:        c.status as CountStatus,
    items: (c.items ?? []).map((i: any, idx: number) => ({
      id:       `${c.id}-line-${idx}`,
      itemId:   i.itemId ?? '',
      itemName: i.itemName ?? '',
      unit:     i.unit ?? '',
      expected: Number(i.expected ?? 0),
      counted:  i.counted === '' ? '' : Number(i.counted ?? 0),
      variance: Number(i.variance ?? 0),
      note:     i.note ?? '',
    })),
    notes:       c.notes ?? '',
    submittedAt: c.submittedAt ?? undefined,
    approvedById: c.approvedById ?? undefined,
  }
}

function setError(set: (p: Partial<InventoryState>) => void, op: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  set({ error: `${op}: ${message}`, loading: false })
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  stockItems: [], items: [], wasteEntries: [], counts: [],
  transactions: [], trends: null,
  loading: false, error: null,

  fetch: async (search?: string) => {
    set({ loading: true, error: null })
    if (import.meta.env.VITE_DEMO_MODE === 'true') {
      try {
        const { data } = await supabase.from('inventory').select('*')
        const stock = (data ?? []).map(toStock)
        set({
          stockItems: stock,
          items: stock,
          transactions: [],
          wasteEntries: [],
          counts: [],
          trends: null,
          loading: false,
        })
        return
      } catch {
        // Fallback to API if supabase adapter fails
      }
    }
    try {
      const [itemsRes, txRes, countsRes, trendsRes] = await Promise.all([
        api.get<any[]>('/inventory/items', { params: search ? { search } : {} }),
        api.get<InventoryTransaction[]>('/inventory/transactions', { params: { limit: 1000 } }),
        api.get<any[]>('/inventory/counts'),
        api.get<InventoryTrends>('/inventory/trends'),
      ])
      const stock = (itemsRes.data ?? []).map(toStock)
      const transactions = txRes.data ?? []
      const wasteEntries = transactions
        .filter(t => t.type === 'waste')
        .map(toWaste)
      set({
        stockItems: stock,
        items: stock,
        transactions,
        wasteEntries,
        counts: (countsRes.data ?? []).map(toCount),
        trends: trendsRes.data ?? null,
        loading: false,
      })
    } catch (err) {
      try {
        // Fallback to local supabase adapter if server is unreachable
        const { data } = await supabase.from('inventory').select('*')
        const stock = (data ?? []).map(toStock)
        set({
          stockItems: stock,
          items: stock,
          transactions: [],
          wasteEntries: [],
          counts: [],
          trends: null,
          loading: false,
        })
      } catch {
        setError(set, 'Failed to load inventory', err)
      }
    }
  },

  addItem: async (data) => {
    try {
      const { data: row } = await api.post('/inventory/items', {
        name: data.item, category: data.category,
        unit: data.unit, parLevel: data.min, onHand: data.qty,
        unitCost: data.cost ?? null,
        vendor: data.vendor ?? '', notes: data.notes ?? '',
      })
      const item = toStock(row)
      set(s => {
        const next = [...s.stockItems, item].sort((a, b) => a.item.localeCompare(b.item))
        return { stockItems: next, items: next }
      })
    } catch (err) {
      setError(set, 'Failed to add item', err)
      throw err
    }
  },

  updateItem: async (id, data) => {
    try {
      const current = get().stockItems.find(i => i.id === id)
      // A quantity change is a stock movement — it goes through the
      // append-only ledger as a count_adjust transaction.
      if (current && data.qty !== undefined && Number(data.qty) !== current.qty) {
        const delta = Number(data.qty) - current.qty
        await api.post('/inventory/transactions', {
          itemId: id,
          type: 'count_adjust',
          qty: delta,
          unit: current.unit,
          note: JSON.stringify({ text: 'Manual stock adjustment (Stock tab)' }),
        })
      }
      const patch: Record<string, unknown> = {}
      if (data.item     !== undefined) patch.name     = data.item
      if (data.category !== undefined) patch.category = data.category
      if (data.unit     !== undefined) patch.unit     = data.unit
      if (data.min      !== undefined) patch.parLevel = data.min
      if (data.cost     !== undefined) patch.unitCost = data.cost
      if (data.vendor   !== undefined) patch.vendor   = data.vendor
      if (data.notes    !== undefined) patch.notes    = data.notes
      if (Object.keys(patch).length > 0) {
        await api.patch(`/inventory/items/${id}`, patch)
      }
      // Re-read server state so two tablets always converge.
      await get().fetch()
    } catch (err) {
      setError(set, 'Failed to update item', err)
      throw err
    }
  },

  remove: async (id) => {
    try {
      await api.delete(`/inventory/items/${id}`)
      set(s => {
        const next = s.stockItems.filter(i => i.id !== id)
        return { stockItems: next, items: next }
      })
    } catch (err) {
      setError(set, 'Failed to remove item', err)
      throw err
    }
  },

  // Waste — server-side ledger (append-only; no deletes by design)
  addWasteEntry: async (data) => {
    try {
      const match = get().stockItems.find(
        i => i.item.trim().toLowerCase() === data.item.trim().toLowerCase()
      )
      await api.post('/inventory/transactions', {
        itemId: match?.id ?? null,
        type: 'waste',
        qty: Math.abs(data.qty),
        unit: data.unit,
        note: JSON.stringify({
          itemName: data.item,
          reason: data.reason,
          meal: data.meal,
          date: data.date,
          loggedBy: data.loggedBy,
          cost: data.cost ?? null,
        }),
      })
      await get().fetch()
    } catch (err) {
      setError(set, 'Failed to log waste', err)
      throw err
    }
  },

  // Counts — server-side sessions; variances post as ledger adjustments
  addCount: async (data) => {
    try {
      await api.post('/inventory/counts', {
        countDate: data.countDate,
        submittedById: data.submittedById,
        status: data.status,
        items: data.items.map(i => ({
          itemId: i.itemId, itemName: i.itemName, unit: i.unit,
          expected: i.expected, counted: i.counted, variance: i.variance,
          note: i.note ?? '',
        })),
        notes: data.notes ?? '',
        submittedAt: data.submittedAt ?? new Date().toISOString(),
      })
      await get().fetch()
    } catch (err) {
      setError(set, 'Failed to submit count', err)
      throw err
    }
  },
  updateCount: async (id, data) => {
    try {
      const patch: Record<string, unknown> = {}
      if (data.status      !== undefined) patch.status     = data.status
      if (data.approvedById !== undefined) patch.approvedBy = data.approvedById
      if (data.notes        !== undefined) patch.notes      = data.notes
      await api.patch(`/inventory/counts/${id}`, patch)
      await get().fetch()
    } catch (err) {
      setError(set, 'Failed to update count', err)
      throw err
    }
  },

  // One-time cutover: import this device's legacy localStorage inventory rows
  // (written by the old supabase-emulator data layer) onto the server, then
  // never look at them again.
  importLegacy: async () => {
    try {
      if (typeof window === 'undefined') return 0
      if (window.localStorage.getItem(IMPORT_FLAG)) return 0
      const raw = window.localStorage.getItem(LEGACY_KEY)
      if (!raw) {
        window.localStorage.setItem(IMPORT_FLAG, '1')
        return 0
      }
      let rows: any[] = []
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) rows = parsed
      } catch { /* not importable — ignore */ }
      let imported = 0
      for (const r of rows) {
        try {
          await api.post('/inventory/items', {
            name: String(r.item ?? r.name ?? '').slice(0, 200),
            category: String(r.category ?? 'Other').slice(0, 64),
            unit: String(r.unit ?? 'each').slice(0, 32),
            parLevel: Number(r.par_level ?? r.parLevel ?? r.min ?? 0) || 0,
            onHand: Math.max(0, Number(r.on_hand ?? r.onHand ?? r.quantity ?? r.qty ?? 0) || 0),
            unitCost: r.unit_cost != null ? Number(r.unit_cost)
              : r.unitCost != null ? Number(r.unitCost)
              : r.cost != null ? Number(r.cost) : null,
            vendor: String(r.vendor ?? '').slice(0, 120),
            notes: String(r.notes ?? '').slice(0, 2000),
          })
          imported += 1
        } catch { /* skip rows that fail validation; keep importing the rest */ }
      }
      window.localStorage.setItem(IMPORT_FLAG, '1')
      return imported
    } catch (err) {
      setError(set, 'Legacy import failed', err)
      return 0
    }
  },

  getLowParItems: () => get().stockItems.filter(i => i.qty < i.min && i.min > 0),
  getZeroItems:   () => get().stockItems.filter(i => i.qty <= 0),
}))
