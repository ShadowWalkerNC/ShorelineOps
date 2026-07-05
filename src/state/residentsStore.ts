import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'
import type { Resident } from '@/types'

function uid() { return crypto.randomUUID() }

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
    let all = ls.get<Resident[]>(LS_KEYS.residents, [])
    if (search) {
      const q = search.toLowerCase()
      all = all.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.room.toLowerCase().includes(q)
      )
    }
    all = [...all].sort((a, b) => a.name.localeCompare(b.name))
    set({ residents: all, loading: false })
  },

  add: async (data) => {
    const resident: Resident = { ...data, id: uid() }
    const all = [...ls.get<Resident[]>(LS_KEYS.residents, []), resident]
    ls.set(LS_KEYS.residents, all)
    set(s => ({ residents: [...s.residents, resident] }))
  },

  update: async (id, data) => {
    const all = ls.get<Resident[]>(LS_KEYS.residents, []).map(r =>
      r.id === id ? { ...r, ...data } : r
    )
    ls.set(LS_KEYS.residents, all)
    set(s => ({ residents: s.residents.map(r => r.id === id ? { ...r, ...data } : r) }))
  },

  upsert: async (id, data) => {
    if (id) await get().update(id, data)
    else    await get().add(data)
  },

  remove: async (id) => {
    const all = ls.get<Resident[]>(LS_KEYS.residents, []).filter(r => r.id !== id)
    ls.set(LS_KEYS.residents, all)
    set(s => ({ residents: s.residents.filter(r => r.id !== id) }))
  },
}))
