/**
 * Residents store — DEMO MODE
 * All data lives in memory. Changes persist for the session but reset on reload.
 */
import { create } from 'zustand'
import type { Resident } from '@/types'
import { SEED_RESIDENTS, uid, now } from '@/demo/seed'

// Deep-clone seed so we mutate our own copy
let _residents: Resident[] = JSON.parse(JSON.stringify(SEED_RESIDENTS))

type ResidentsState = {
  residents: Resident[]
  loading: boolean
  error: string | null
  fetch: (search?: string) => Promise<void>
  add: (data: Omit<Resident, 'id'>) => Promise<void>
  update: (id: string, data: Partial<Resident>) => Promise<void>
  upsert: (id: string | null, data: Omit<Resident, 'id'>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useResidentsStore = create<ResidentsState>((set, get) => ({
  residents: [],
  loading: false,
  error: null,

  fetch: async (search) => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 150))
    const q = search?.toLowerCase() ?? ''
    const results = q
      ? _residents.filter(r => r.name.toLowerCase().includes(q) || r.room.includes(q))
      : [..._residents]
    set({ residents: results, loading: false })
  },

  add: async (data) => {
    const resident: Resident = { ...data, id: uid() }
    _residents = [..._residents, resident]
    set({ residents: [..._residents] })
  },

  update: async (id, data) => {
    _residents = _residents.map(r => r.id === id ? { ...r, ...data } : r)
    set({ residents: [..._residents] })
  },

  upsert: async (id, data) => {
    if (id) await get().update(id, data)
    else    await get().add(data)
  },

  remove: async (id) => {
    _residents = _residents.filter(r => r.id !== id)
    set({ residents: [..._residents] })
  },
}))
