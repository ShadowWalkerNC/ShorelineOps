import { create } from 'zustand'
import type { Resident } from '@/types'
import { residentsApi } from '@/api/residents'

type ResidentsState = {
  residents: Resident[]
  loading: boolean
  error: string | null
  /** Fetch all residents, optionally filtered by a search string (server-side). */
  fetch: (search?: string) => Promise<void>
  add: (data: Omit<Resident, 'id'>) => Promise<void>
  update: (id: string, data: Partial<Resident>) => Promise<void>
  /** If id is null → create, else → update. */
  upsert: (id: string | null, data: Omit<Resident, 'id'>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useResidentsStore = create<ResidentsState>((set, get) => ({
  residents: [],
  loading: false,
  error: null,

  fetch: async (search) => {
    set({ loading: true, error: null })
    try {
      const residents = await residentsApi.getAll(search)
      set({ residents, loading: false })
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ??
        e?.message ??
        'Failed to load residents.'
      set({ error: msg, loading: false })
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

  upsert: async (id, data) => {
    if (id) {
      await get().update(id, data)
    } else {
      await get().add(data)
    }
  },

  remove: async (id) => {
    await residentsApi.delete(id)
    set({ residents: get().residents.filter((r) => r.id !== id) })
  },
}))
