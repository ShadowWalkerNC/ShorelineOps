import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'
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

function uid() { return crypto.randomUUID() }

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
  sheets:  ls.get<ProductionSheet[]>(LS_KEYS.productions, []),
  loading: false,
  error:   null,

  fetchSheets: async () => {
    set({ loading: true, error: null })
    const sheets = [...ls.get<ProductionSheet[]>(LS_KEYS.productions, [])]
      .sort((a, b) => b.date.localeCompare(a.date))
    set({ sheets, loading: false })
  },

  addSheet: async (data) => {
    const sheet: ProductionSheet = {
      ...data, id: uid(),
      rows: (data.items ?? []) as ProductionRow[],
    }
    const all = [sheet, ...ls.get<ProductionSheet[]>(LS_KEYS.productions, [])]
    ls.set(LS_KEYS.productions, all)
    set(s => ({ sheets: [sheet, ...s.sheets] }))
  },

  updateSheet: async (id, data) => {
    const all = ls.get<ProductionSheet[]>(LS_KEYS.productions, []).map(sh =>
      sh.id === id ? { ...sh, ...data } : sh
    )
    ls.set(LS_KEYS.productions, all)
    set(s => ({ sheets: s.sheets.map(sh => sh.id === id ? { ...sh, ...data } : sh) }))
  },

  updateRow: async (sheetId, menuItemId, patch) => {
    const sheet = get().sheets.find(s => s.id === sheetId)
    if (!sheet) return
    const rows = sheet.rows.map(r =>
      r.menuItemId === menuItemId ? { ...r, ...patch } : r
    )
    await get().updateSheet(sheetId, { rows, items: rows })
  },

  signOff: async (id, by) => {
    await get().updateSheet(id, {
      signedOffAt: new Date().toISOString(),
      signedOffBy: by,
    })
  },

  removeSheet: async (id) => {
    const all = ls.get<ProductionSheet[]>(LS_KEYS.productions, []).filter(sh => sh.id !== id)
    ls.set(LS_KEYS.productions, all)
    set(s => ({ sheets: s.sheets.filter(sh => sh.id !== id) }))
  },
}))
