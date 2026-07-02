/**
 * Residents API client.
 * All methods unwrap the Axios response so callers receive plain values.
 */
import { api } from './client'
import type { Resident } from '@/types'

export const residentsApi = {
  getAll: async (search?: string): Promise<Resident[]> => {
    const params = search ? { q: search } : {}
    const { data } = await api.get<Resident[]>('/residents', { params })
    return data
  },

  getById: async (id: string): Promise<Resident> => {
    const { data } = await api.get<Resident>(`/residents/${id}`)
    return data
  },

  create: async (payload: Omit<Resident, 'id'>): Promise<Resident> => {
    const { data } = await api.post<Resident>('/residents', payload)
    return data
  },

  update: async (id: string, payload: Partial<Resident>): Promise<Resident> => {
    const { data } = await api.put<Resident>(`/residents/${id}`, payload)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/residents/${id}`)
  },
}
