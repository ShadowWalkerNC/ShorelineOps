// ============================================================
// STAFF STORE — AES-256-GCM encrypted at rest
// ============================================================
// HIPAA Security Rule §164.312(a)(2)(iv) — Encryption/Decryption
//
// staffProfiles and callOuts are PHI keys — all reads/writes
// go through cs (cryptoStore) which auto-encrypts them.
// Schedule entries contain no PHI and use plain ls.
//
// SECURITY NOTE:
//   getCallOuts() still filters so a staff member can never see
//   their own call-out records — enforced in JS at the store layer.
// ============================================================

import { create } from 'zustand'
import { cs } from '../lib/cryptoStore'
import { ls, LS_KEYS } from '../lib/localStorage'
import { writeAudit } from '../security/auditLog'
import type { StaffProfile, CallOut, ScheduleEntry } from '../types/staff'
import type { UserRole } from '../types/roles'

function uid() { return crypto.randomUUID() }
function now() { return new Date().toISOString() }

interface StaffState {
  profiles:  StaffProfile[]
  callOuts:  CallOut[]
  schedule:  ScheduleEntry[]
  isLoading: boolean
  error:     string | null
  fetch: () => Promise<void>
  addProfile:    (profile: Omit<StaffProfile, 'id' | 'createdAt' | 'updatedAt'>, actorId?: string, actorName?: string) => Promise<void>
  updateProfile: (id: string, updates: Partial<StaffProfile>, actorId?: string, actorName?: string) => Promise<void>
  removeProfile: (id: string, actorId?: string, actorName?: string) => Promise<void>
  addCallOut:    (callOut: Omit<CallOut, 'id' | 'createdAt' | 'updatedAt'>, actorId?: string, actorName?: string) => Promise<void>
  updateCallOut: (id: string, updates: Partial<CallOut>, actorId?: string, actorName?: string) => Promise<void>
  removeCallOut: (id: string, actorId?: string, actorName?: string) => Promise<void>
  getCallOuts: (viewerAuthUserId: string, viewerRole: UserRole) => CallOut[]
  addScheduleEntry:    (entry: ScheduleEntry) => void
  updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => void
  removeScheduleEntry: (id: string) => void
  profileByAuthId: (authUserId: string) => StaffProfile | undefined
}

export const useStaffStore = create<StaffState>((set, get) => ({
  profiles:  [],
  callOuts:  [],
  schedule:  [],
  isLoading: false,
  error:     null,

  fetch: async () => {
    set({ isLoading: true, error: null })
    try {
      const profiles = [...(await cs.get<StaffProfile[]>(LS_KEYS.staffProfiles, []))]
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
      const callOuts = [...(await cs.get<CallOut[]>(LS_KEYS.callOuts, []))]
        .sort((a, b) => b.date.localeCompare(a.date))
      set({ profiles, callOuts, isLoading: false })
    } catch (e) {
      set({ error: 'Failed to load staff data.', isLoading: false })
    }
  },

  addProfile: async (data, actorId, actorName) => {
    const profile: StaffProfile = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    const all = [...(await cs.get<StaffProfile[]>(LS_KEYS.staffProfiles, [])), profile]
    await cs.set(LS_KEYS.staffProfiles, all)
    set(s => ({ profiles: [...s.profiles, profile] }))
    writeAudit({
      action: 'staff.profile.create',
      userId: actorId,
      userName: actorName,
      resourceType: 'staffProfile',
      resourceId: profile.id,
      outcome: 'success',
    })
  },

  updateProfile: async (id, updates, actorId, actorName) => {
    const all = (await cs.get<StaffProfile[]>(LS_KEYS.staffProfiles, [])).map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: now() } : p
    )
    await cs.set(LS_KEYS.staffProfiles, all)
    set(s => ({ profiles: s.profiles.map(p => p.id === id ? { ...p, ...updates, updatedAt: now() } : p) }))
    writeAudit({
      action: 'staff.profile.update',
      userId: actorId,
      userName: actorName,
      resourceType: 'staffProfile',
      resourceId: id,
      outcome: 'success',
    })
  },

  removeProfile: async (id, actorId, actorName) => {
    const all = (await cs.get<StaffProfile[]>(LS_KEYS.staffProfiles, [])).filter(p => p.id !== id)
    await cs.set(LS_KEYS.staffProfiles, all)
    set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
    writeAudit({
      action: 'staff.profile.delete',
      userId: actorId,
      userName: actorName,
      resourceType: 'staffProfile',
      resourceId: id,
      outcome: 'success',
    })
  },

  addCallOut: async (data, actorId, actorName) => {
    const callOut: CallOut = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    const all = [callOut, ...(await cs.get<CallOut[]>(LS_KEYS.callOuts, []))]
    await cs.set(LS_KEYS.callOuts, all)
    set(s => ({ callOuts: [callOut, ...s.callOuts] }))
    writeAudit({
      action: 'staff.callout.create',
      userId: actorId,
      userName: actorName,
      resourceType: 'callOut',
      resourceId: callOut.staffId,
      outcome: 'success',
    })
  },

  updateCallOut: async (id, updates, actorId, actorName) => {
    const all = (await cs.get<CallOut[]>(LS_KEYS.callOuts, [])).map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: now() } : c
    )
    await cs.set(LS_KEYS.callOuts, all)
    set(s => ({ callOuts: s.callOuts.map(c => c.id === id ? { ...c, ...updates, updatedAt: now() } : c) }))
    writeAudit({
      action: 'staff.callout.update',
      userId: actorId,
      userName: actorName,
      resourceType: 'callOut',
      resourceId: id,
      outcome: 'success',
    })
  },

  removeCallOut: async (id, actorId, actorName) => {
    const all = (await cs.get<CallOut[]>(LS_KEYS.callOuts, [])).filter(c => c.id !== id)
    await cs.set(LS_KEYS.callOuts, all)
    set(s => ({ callOuts: s.callOuts.filter(c => c.id !== id) }))
    writeAudit({
      action: 'staff.callout.delete',
      userId: actorId,
      userName: actorName,
      resourceType: 'callOut',
      resourceId: id,
      outcome: 'success',
    })
  },

  getCallOuts: (viewerAuthUserId, viewerRole) => {
    const { callOuts, profiles } = get()
    const isPrivileged = viewerRole === 'admin' || viewerRole === 'manager'
    if (isPrivileged) return callOuts
    const viewerProfile = profiles.find(p => p.authUserId === viewerAuthUserId)
    if (!viewerProfile) return []
    return callOuts.filter(c => c.staffId !== viewerProfile.id)
  },

  addScheduleEntry:    (entry) => set(s => ({ schedule: [...s.schedule, entry] })),
  updateScheduleEntry: (id, updates) => set(s => ({
    schedule: s.schedule.map(e => e.id === id ? { ...e, ...updates } : e),
  })),
  removeScheduleEntry: (id) => set(s => ({ schedule: s.schedule.filter(e => e.id !== id) })),
  profileByAuthId: (authUserId) => get().profiles.find(p => p.authUserId === authUserId),
}))
