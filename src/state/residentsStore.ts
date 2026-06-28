import { create } from 'zustand'
import type { Resident } from '@/types'
import { residentsApi } from '@/api/residents'

type ResidentsState = {
  residents: Resident[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (r: Omit<Resident, 'id'>) => Promise<void>
  update: (id: string, data: Partial<Resident>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useResidentsStore = create<ResidentsState>((set, get) => ({
  residents: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const residents = await residentsApi.getAll()
      set({ residents, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  add: async (data) => {
    const resident = await residentsApi.create(data)
    set({ residents: [...get().residents, resident] })
  },

  update: async (id, data) => {
    const updated = await residentsApi.update(id, data)
    set({
      residents: get().residents.map((r) => (r.id === id ? updated : r)),
    })
  },

  remove: async (id) => {
    await residentsApi.delete(id)
    set({ residents: get().residents.filter((r) => r.id !== id) })
  },
}))
