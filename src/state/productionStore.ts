import { create } from 'zustand'
import { api } from '@/api/client'
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
  const rawItems = Array.isArray(row.rows)
    ? (row.rows as ProductionRow[])
    : Array.isArray(row.items)
    ? (row.items as ProductionRow[])
    : []
  return {
    id:          row.id as string,
    label:       (row.label as string) || `${row.day || ''} ${row.slot || ''}`.trim() || 'Production Sheet',
    meal:        (row.meal as string) || (row.slot as string) || 'Dinner',
    date:        (row.date as string) || (row.day as string) || new Date().toISOString().slice(0, 10),
    rows:        rawItems,
    items:       rawItems,
    signedOffAt: (row.signed_off_at as string | null) ?? (row.signedOffAt as string | null) ?? null,
    signedOffBy: (row.signed_off_by as string | null) ?? (row.signedOffBy as string | null) ?? null,
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

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export const useProductionStore = create<ProductionState>((set, get) => ({
  sheets: [],
  loading: false,
  error: null,

  fetchSheets: async () => {
    set({ loading: true, error: null })
    if (!isDemo) {
      try {
        const res = await api.get('/production/sheets')
        if (Array.isArray(res.data)) {
          set({ sheets: res.data.map(toSheet), loading: false })
          return
        }
      } catch (err: any) {
        console.warn('[productionStore] Live API fetch failed, falling back to local adapter:', err?.message)
      }
    }
    const { data, error } = await supabase
      .from('production_sheets').select('*').order('date', { ascending: false })
    if (error) { set({ error: error.message, loading: false }); return }
    set({ sheets: (data ?? []).map((r: any) => toSheet(r as Record<string, unknown>)), loading: false })
  },

  addSheet: async (data) => {
    if (!isDemo) {
      try {
        const res = await api.post('/production/sheets', {
          label: data.label,
          meal: data.meal,
          date: data.date,
          rows: data.items ?? [],
          items: data.items ?? [],
        })
        if (res.data?.id) {
          set(s => ({ sheets: [toSheet(res.data), ...s.sheets] }))
          return
        }
      } catch (err: any) {
        console.warn('[productionStore] Live API add failed, falling back to local adapter:', err?.message)
      }
    }
    const row = { label: data.label, meal: data.meal, date: data.date, items: data.items ?? [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('production_sheets') as any).insert(row).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: [toSheet(r as Record<string, unknown>), ...s.sheets] }))
  },

  updateSheet: async (id, data) => {
    if (!isDemo) {
      try {
        const res = await api.put(`/production/sheets/${id}`, {
          rows: data.rows ?? data.items,
        })
        if (res.data?.id) {
          set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? toSheet(res.data) : sh) }))
          return
        }
      } catch (err: any) {
        console.warn('[productionStore] Live API update failed, falling back to local adapter:', err?.message)
      }
    }
    const patch: Record<string, unknown> = {}
    if (data.label !== undefined) patch.label = data.label
    if (data.meal  !== undefined) patch.meal  = data.meal
    if (data.date  !== undefined) patch.date  = data.date
    if (data.rows  !== undefined) patch.items = data.rows
    if (data.items !== undefined) patch.items = data.items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('production_sheets') as any).update(patch).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? toSheet(r as Record<string, unknown>) : sh) }))
  },

  updateRow: async (sheetId, menuItemId, patch) => {
    const sheet = get().sheets.find(s => s.id === sheetId)
    if (!sheet) return
    const updatedRows = sheet.rows.map(r =>
      r.menuItemId === menuItemId ? { ...r, ...patch } : r
    )
    if (!isDemo) {
      try {
        const res = await api.put(`/production/sheets/${sheetId}`, {
          rows: updatedRows,
        })
        if (res.data?.id) {
          set(s => ({ sheets: s.sheets.map(sh => sh.id === sheetId ? toSheet(res.data) : sh) }))
          return
        }
      } catch (err: any) {
        console.warn('[productionStore] Live API updateRow failed, falling back to local adapter:', err?.message)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('production_sheets') as any)
      .update({ items: updatedRows }).eq('id', sheetId).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === sheetId ? toSheet(r as Record<string, unknown>) : sh) }))
  },

  signOff: async (id, by) => {
    if (!isDemo) {
      try {
        const res = await api.post(`/production/sheets/${id}/signoff`, { staffName: by })
        if (res.data?.id) {
          set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? toSheet(res.data) : sh) }))
          return
        }
      } catch (err: any) {
        console.warn('[productionStore] Live API signOff failed, falling back to local adapter:', err?.message)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error } = await (supabase.from('production_sheets') as any)
      .update({ signed_off_at: new Date().toISOString(), signed_off_by: by })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? toSheet(r as Record<string, unknown>) : sh) }))
  },

  removeSheet: async (id) => {
    if (!isDemo) {
      try {
        await api.delete(`/production/sheets/${id}`)
        set(s => ({ sheets: s.sheets.filter(sh => sh.id !== id) }))
        return
      } catch (err: any) {
        console.warn('[productionStore] Live API delete failed, falling back to local adapter:', err?.message)
      }
    }
    const { error } = await supabase.from('production_sheets').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ sheets: s.sheets.filter(sh => sh.id !== id) }))
  },
}))
