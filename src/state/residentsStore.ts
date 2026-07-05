/**
 * ============================================================
 * RESIDENTS STORE — AES-256-GCM encrypted at rest
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(iv) — Encryption/Decryption
 *
 * All reads/writes for LS_KEYS.residents go through cs (cryptoStore)
 * which auto-encrypts PHI keys with AES-256-GCM.
 * Non-PHI keys (e.g. LS_KEYS.menuItems) still use ls.
 * ============================================================
 */
import { create } from 'zustand'
import { cs } from '../lib/cryptoStore'
import { ls, LS_KEYS } from '../lib/localStorage'
import { writeAudit } from '../security/auditLog'
import type { Resident } from '../types'

function uid() { return crypto.randomUUID() }

type ResidentsState = {
  residents: Resident[]
  loading: boolean
  error: string | null
  fetch: (search?: string) => Promise<void>
  add: (data: Omit<Resident, 'id'>, actorId?: string, actorName?: string) => Promise<void>
  update: (id: string, data: Partial<Resident>, actorId?: string, actorName?: string) => Promise<void>
  upsert: (id: string | null, data: Omit<Resident, 'id'>, actorId?: string, actorName?: string) => Promise<void>
  remove: (id: string, actorId?: string, actorName?: string) => Promise<void>
}

export const useResidentsStore = create<ResidentsState>((set, get) => ({
  residents: [],
  loading: false,
  error: null,

  fetch: async (search) => {
    set({ loading: true, error: null })
    try {
      let all = await cs.get<Resident[]>(LS_KEYS.residents, [])
      if (search) {
        const q = search.toLowerCase()
        all = all.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.room.toLowerCase().includes(q)
        )
      }
      all = [...all].sort((a, b) => a.name.localeCompare(b.name))
      set({ residents: all, loading: false })
    } catch (e) {
      set({ error: 'Failed to load residents.', loading: false })
    }
  },

  add: async (data, actorId, actorName) => {
    const resident: Resident = { ...data, id: uid() }
    const all = [...(await cs.get<Resident[]>(LS_KEYS.residents, [])), resident]
    await cs.set(LS_KEYS.residents, all)
    set(s => ({ residents: [...s.residents, resident] }))
    writeAudit({
      action: 'resident.create',
      userId: actorId,
      userName: actorName,
      resourceType: 'resident',
      resourceId: resident.id,
      outcome: 'success',
    })
  },

  update: async (id, data, actorId, actorName) => {
    const all = (await cs.get<Resident[]>(LS_KEYS.residents, [])).map(r =>
      r.id === id ? { ...r, ...data } : r
    )
    await cs.set(LS_KEYS.residents, all)
    set(s => ({ residents: s.residents.map(r => r.id === id ? { ...r, ...data } : r) }))
    writeAudit({
      action: 'resident.update',
      userId: actorId,
      userName: actorName,
      resourceType: 'resident',
      resourceId: id,
      outcome: 'success',
    })
  },

  upsert: async (id, data, actorId, actorName) => {
    if (id) await get().update(id, data, actorId, actorName)
    else    await get().add(data, actorId, actorName)
  },

  remove: async (id, actorId, actorName) => {
    const all = (await cs.get<Resident[]>(LS_KEYS.residents, [])).filter(r => r.id !== id)
    await cs.set(LS_KEYS.residents, all)
    set(s => ({ residents: s.residents.filter(r => r.id !== id) }))
    writeAudit({
      action: 'resident.delete',
      userId: actorId,
      userName: actorName,
      resourceType: 'resident',
      resourceId: id,
      outcome: 'success',
    })
  },
}))
