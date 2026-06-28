import { api } from './client'
import type { Resident } from '@/types'

export const residentsApi = {
  getAll: () => api.get<Resident[]>('/residents'),
  getById: (id: string) => api.get<Resident>(`/residents/${id}`),
  create: (data: Omit<Resident, 'id'>) => api.post<Resident>('/residents', data),
  update: (id: string, data: Partial<Resident>) =>
    api.put<Resident>(`/residents/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/residents/${id}`),
}
