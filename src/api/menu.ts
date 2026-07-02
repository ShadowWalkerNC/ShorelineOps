import { api } from './client'
import type { MenuWeek, MenuItem } from '@/types'

export const menuApi = {
  // ── Weeks ──────────────────────────────────────────────────────────────────
  getWeeks: async (): Promise<MenuWeek[]> => {
    const { data } = await api.get<MenuWeek[]>('/menu/weeks')
    return data
  },

  getWeek: async (id: string): Promise<MenuWeek> => {
    const { data } = await api.get<MenuWeek>(`/menu/weeks/${id}`)
    return data
  },

  createWeek: async (payload: Omit<MenuWeek, 'id' | 'createdAt' | 'updatedAt'>): Promise<MenuWeek> => {
    const { data } = await api.post<MenuWeek>('/menu/weeks', payload)
    return data
  },

  updateWeek: async (id: string, payload: Partial<MenuWeek>): Promise<MenuWeek> => {
    const { data } = await api.put<MenuWeek>(`/menu/weeks/${id}`, payload)
    return data
  },

  deleteWeek: async (id: string): Promise<void> => {
    await api.delete(`/menu/weeks/${id}`)
  },

  setActiveWeek: async (id: string): Promise<MenuWeek> => {
    const { data } = await api.post<MenuWeek>(`/menu/weeks/${id}/activate`)
    return data
  },

  // ── Items (master item library) ─────────────────────────────────────────────
  getItems: async (): Promise<MenuItem[]> => {
    const { data } = await api.get<MenuItem[]>('/menu/items')
    return data
  },

  createItem: async (payload: Omit<MenuItem, 'id'>): Promise<MenuItem> => {
    const { data } = await api.post<MenuItem>('/menu/items', payload)
    return data
  },

  updateItem: async (id: string, payload: Partial<MenuItem>): Promise<MenuItem> => {
    const { data } = await api.put<MenuItem>(`/menu/items/${id}`, payload)
    return data
  },

  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/menu/items/${id}`)
  },
}
