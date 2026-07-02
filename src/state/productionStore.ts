import { create } from 'zustand'
import { productionApi } from '../api/production'
import type { ProductionSheet, ProductionRow } from '../types/production'
import type { DayOfWeek, MealSlot } from '../types/menu'

interface ProductionState {
  sheets: ProductionSheet[]
  activeSheet: ProductionSheet | null
  loading: boolean
  error: string | null

  fetchSheets: (weekId?: string) => Promise<void>
  loadSheet: (weekId: string, day: DayOfWeek, slot: MealSlot) => Promise<void>
  updateRow: (sheetId: string, menuItemId: string, patch: Partial<ProductionRow>) => Promise<void>
  signOff: (sheetId: string, staffName: string) => Promise<void>
  setActiveSheet: (sheet: ProductionSheet | null) => void
  clearError: () => void
}

export const useProductionStore = create<ProductionState>((set, get) => ({
  sheets: [],
  activeSheet: null,
  loading: false,
  error: null,

  fetchSheets: async (weekId) => {
    set({ loading: true, error: null })
    try {
      const sheets = await productionApi.getSheets(weekId)
      set({ sheets, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load sheets' })
    }
  },

  loadSheet: async (weekId, day, slot) => {
    set({ loading: true, error: null })
    try {
      const sheet = await productionApi.getSheet(weekId, day, slot)
      set({ activeSheet: sheet, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load sheet' })
    }
  },

  updateRow: async (sheetId, menuItemId, patch) => {
    const { activeSheet } = get()
    if (!activeSheet || activeSheet.id !== sheetId) return
    const rows = activeSheet.rows.map(r =>
      r.menuItemId === menuItemId ? { ...r, ...patch } : r
    )
    const updated = { ...activeSheet, rows }
    set({ activeSheet: updated })
    try {
      const saved = await productionApi.updateSheet(sheetId, { rows })
      set({ activeSheet: saved })
    } catch (e: any) {
      set({ error: e?.message ?? 'Failed to save row' })
    }
  },

  signOff: async (sheetId, staffName) => {
    set({ loading: true, error: null })
    try {
      const sheet = await productionApi.signOff(sheetId, staffName)
      set({ activeSheet: sheet, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Sign-off failed' })
    }
  },

  setActiveSheet: (sheet) => set({ activeSheet: sheet }),
  clearError: () => set({ error: null }),
}))
