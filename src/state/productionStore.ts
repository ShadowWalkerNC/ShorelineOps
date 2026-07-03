/**
 * Production store — DEMO MODE
 * All data lives in memory. Changes persist for the session but reset on reload.
 */
import { create } from 'zustand'
import type { ProductionSheet, ProductionRow } from '../types/production'
import type { DayOfWeek, MealSlot } from '../types/menu'
import { SEED_PRODUCTION_SHEETS, uid, now } from '@/demo/seed'

let _sheets: ProductionSheet[] = JSON.parse(JSON.stringify(SEED_PRODUCTION_SHEETS))

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
    await new Promise(r => setTimeout(r, 150))
    const results = weekId ? _sheets.filter(s => s.menuWeekId === weekId) : [..._sheets]
    set({ sheets: results, loading: false })
  },

  loadSheet: async (weekId, day, slot) => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 100))
    const sheet = _sheets.find(s => s.menuWeekId === weekId && s.day === day && s.slot === slot) ?? null
    set({ activeSheet: sheet, loading: false })
  },

  updateRow: async (sheetId, menuItemId, patch) => {
    _sheets = _sheets.map(s => {
      if (s.id !== sheetId) return s
      const rows = s.rows.map(r => r.menuItemId === menuItemId ? { ...r, ...patch } : r)
      return { ...s, rows, updatedAt: now() }
    })
    const updated = _sheets.find(s => s.id === sheetId) ?? null
    set({ sheets: [..._sheets], activeSheet: updated })
  },

  signOff: async (sheetId, staffName) => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 200))
    _sheets = _sheets.map(s =>
      s.id === sheetId ? { ...s, signedOffBy: staffName, signedOffAt: now(), updatedAt: now() } : s
    )
    const updated = _sheets.find(s => s.id === sheetId) ?? null
    set({ sheets: [..._sheets], activeSheet: updated, loading: false })
  },

  setActiveSheet: (sheet) => set({ activeSheet: sheet }),
  clearError: () => set({ error: null }),
}))
