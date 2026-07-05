import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ProductionRow } from '@/types/production'

export interface ProductionSheet {
  id: string
  label: string
  meal: string
  date: string
  rows: ProductionRow[]
  items: unknown[]
  signedOffAt?: string | null
  signedOffBy?: string | null
}

function toSheet(row: Record<string, unknown>): ProductionSheet {
  const rawItems = Array.isArray(row.items) ? (row.items as ProductionRow[]) : []
  return {
    id:          row.id as string,
    label:       row.label as string,
    meal:        row.meal as string,
    date:        row.date as string,
    rows:        rawItems,
    items:       rawItems,
    signedOffAt: row.signed_off_at as string | null,
    signedOffBy: row.signed_off_by as string | null,
  }
}

type ProductionState = {
  sheets: ProductionSheet[]
  loading: boolean
  error: string | null
  fetchSheets: () => Promise<void>
  addSheet: (data: Omit<ProductionSheet, 'id' | 'rows'>) => Promise<void>
  updateSheet: (id: string, data: Partial<ProductionSheet>) => Promise<void>
  updateRow: (sheetId: string, menuItemId: string, patch: Partial<ProductionRow>) => Promise<void>
  signOff: (id: string, by: string) => Promise<void>
  removeSheet: (id: string) => Promise<void>
}

export const useProductionStore = create<ProductionState>((set, get) => ({
  sheets: [],
  loading: false,
  error: null,

  fetchSheets: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('production_sheets').select('*').order('date', { ascending: false })
    if (error) { set({ error: error.message, loading: false }); return }
    set({ sheets: (data ?? []).map(r => toSheet(r as Record<string, unknown>)), loading: false })
  },

  addSheet: async (data) => {
    const { data: row, error } = await supabase
      .from('production_sheets')
      .insert({ label: data.label, meal: data.meal, date: data.date, items: (data.items ?? []) as import('@/lib/database.types').Json })
      .select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: [toSheet(row as Record<string, unknown>), ...s.sheets] }))
  },

  updateSheet: async (id, data) => {
    const patch: Record<string, unknown> = {}
    if (data.label !== undefined) patch.label = data.label
    if (data.meal  !== undefined) patch.meal  = data.meal
    if (data.date  !== undefined) patch.date  = data.date
    if (data.items !== undefined) patch.items = data.items
    if (data.rows  !== undefined) patch.items = data.rows
    const { data: row, error } = await supabase
      .from('production_sheets').update(patch as import('@/lib/database.types').Database['public']['Tables']['production_sheets']['Update']).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? toSheet(row as Record<string, unknown>) : sh) }))
  },

  updateRow: async (sheetId, menuItemId, patch) => {
    // Update a single row inside the JSONB items array, then persist
    const sheet = get().sheets.find(s => s.id === sheetId)
    if (!sheet) return
    const updatedRows = sheet.rows.map(r =>
      r.menuItemId === menuItemId ? { ...r, ...patch } : r
    )
    const { data: row, error } = await supabase
      .from('production_sheets')
      .update({ items: updatedRows as import('@/lib/database.types').Json })
      .eq('id', sheetId).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === sheetId ? toSheet(row as Record<string, unknown>) : sh) }))
  },

  signOff: async (id, by) => {
    const { data: row, error } = await supabase
      .from('production_sheets')
      .update({ signed_off_at: new Date().toISOString(), signed_off_by: by })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? toSheet(row as Record<string, unknown>) : sh) }))
  },

  removeSheet: async (id) => {
    const { error } = await supabase.from('production_sheets').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.filter(sh => sh.id !== id) }))
  },
}))
