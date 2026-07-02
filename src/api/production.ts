import api from './client'
import type { ProductionSheet } from '../types/production'
import type { DayOfWeek, MealSlot } from '../types/menu'

export const productionApi = {
  /** Fetch all sheets (optionally filtered by week) */
  getSheets: (weekId?: string) =>
    api.get<ProductionSheet[]>('/production/sheets', { params: weekId ? { weekId } : {} }).then(r => r.data),

  /** Fetch or auto-generate a single sheet */
  getSheet: (weekId: string, day: DayOfWeek, slot: MealSlot) =>
    api.get<ProductionSheet>(`/production/sheets/generate`, { params: { weekId, day, slot } }).then(r => r.data),

  /** Save edits to an existing sheet */
  updateSheet: (id: string, data: Partial<ProductionSheet>) =>
    api.put<ProductionSheet>(`/production/sheets/${id}`, data).then(r => r.data),

  /** Sign off */
  signOff: (id: string, staffName: string) =>
    api.post<ProductionSheet>(`/production/sheets/${id}/signoff`, { staffName }).then(r => r.data),

  /** Delete a sheet (rarely used — allows regeneration) */
  deleteSheet: (id: string) =>
    api.delete(`/production/sheets/${id}`).then(r => r.data),
}
