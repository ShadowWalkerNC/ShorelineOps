import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export interface InventoryItem {
  id: string
  item: string
  category?: string | null
  quantity: number
  unit?: string | null
  parLevel?: number | null
  notes?: string | null
}

function toItem(row: Record<string, unknown>): InventoryItem {
  return {
    id:       row.id as string,
    item:     row.item as string,
    category: (row.category as string | null) ?? null,
    quantity: Number(row.quantity ?? 0),
    unit:     (row.unit as string | null) ?? null,
    parLevel: row.par_level != null ? Number(row.par_level) : null,
    notes:    (row.notes as string | null) ?? null,
  }
}

function toInsert(data: Partial<InventoryItem>): Database['public']['Tables']['inventory']['Insert'] {
  return {
    item:      data.item ?? '',
    ...(data.category !== undefined && { category:  data.category }),
    ...(data.quantity !== undefined && { quantity:  data.quantity }),
    ...(data.unit     !== undefined && { unit:      data.unit }),
    ...(data.parLevel !== undefined && { par_level: data.parLevel }),
    ...(data.notes    !== undefined && { notes:     data.notes }),
  }
}

function toUpdate(data: Partial<InventoryItem>): Database['public']['Tables']['inventory']['Update'] {
  return {
    ...(data.item     !== undefined && { item:      data.item }),
    ...(data.category !== undefined && { category:  data.category }),
    ...(data.quantity !== undefined && { quantity:  data.quantity }),
    ...(data.unit     !== undefined && { unit:      data.unit }),
    ...(data.parLevel !== undefined && { par_level: data.parLevel }),
    ...(data.notes    !== undefined && { notes:     data.notes }),
  }
}

type InventoryState = {
  items: InventoryItem[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (data: Omit<InventoryItem, 'id'>) => Promise<void>
  update: (id: string, data: Partial<InventoryItem>) => Promise<void>
  remove: (id: string) => Promise<void>
  getLowParItems: () => InventoryItem[]
  getZeroItems: () => InventoryItem[]
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase.from('inventory').select('*').order('item')
    if (error) { set({ error: error.message, loading: false }); return }
    set({ items: (data ?? []).map(r => toItem(r as Record<string, unknown>)), loading: false })
  },

  add: async (data) => {
    const { data: row, error } = await supabase
      .from('inventory').insert(toInsert(data as Partial<InventoryItem>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: [...s.items, toItem(row as Record<string, unknown>)].sort((a, b) => a.item.localeCompare(b.item)) }))
  },

  update: async (id, data) => {
    const { data: row, error } = await supabase
      .from('inventory').update(toUpdate(data)).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.map(i => i.id === id ? toItem(row as Record<string, unknown>) : i) }))
  },

  remove: async (id) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },

  getLowParItems: () => get().items.filter(i =>
    i.parLevel != null && i.parLevel > 0 && i.quantity < i.parLevel && i.quantity > 0
  ),
  getZeroItems: () => get().items.filter(i => i.quantity <= 0),
}))
