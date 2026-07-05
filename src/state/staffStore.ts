// ============================================================
// STAFF STORE — local branch (localStorage only)
// ============================================================
// SECURITY NOTE:
//   getCallOuts() still filters so a staff member can never see
//   their own call-out records — enforced in JS only on this branch.
// ============================================================

import { create } from 'zustand'
import { ls, LS_KEYS } from '@/lib/localStorage'
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
  addProfile:    (profile: Omit<StaffProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateProfile: (id: string, updates: Partial<StaffProfile>) => Promise<void>
  removeProfile: (id: string) => Promise<void>
  addCallOut:    (callOut: Omit<CallOut, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateCallOut: (id: string, updates: Partial<CallOut>) => Promise<void>
  removeCallOut: (id: string) => Promise<void>
  getCallOuts: (viewerAuthUserId: string, viewerRole: UserRole) => CallOut[]
  addScheduleEntry:    (entry: ScheduleEntry) => void
  updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => void
  removeScheduleEntry: (id: string) => void
  profileByAuthId: (authUserId: string) => StaffProfile | undefined
}

export const useStaffStore = create<StaffState>((set, get) => ({
  profiles:  ls.get<StaffProfile[]>(LS_KEYS.staffProfiles, []),
  callOuts:  ls.get<CallOut[]>(LS_KEYS.callOuts, []),
  schedule:  [],
  isLoading: false,
  error:     null,

  fetch: async () => {
    set({ isLoading: true, error: null })
    const profiles = [...ls.get<StaffProfile[]>(LS_KEYS.staffProfiles, [])]
      .sort((a, b) => a.lastName.localeCompare(b.lastName))
    const callOuts = [...ls.get<CallOut[]>(LS_KEYS.callOuts, [])]
      .sort((a, b) => b.date.localeCompare(a.date))
    set({ profiles, callOuts, isLoading: false })
  },

  addProfile: async (data) => {
    const profile: StaffProfile = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    const all = [...ls.get<StaffProfile[]>(LS_KEYS.staffProfiles, []), profile]
    ls.set(LS_KEYS.staffProfiles, all)
    set(s => ({ profiles: [...s.profiles, profile] }))
  },

  updateProfile: async (id, updates) => {
    const all = ls.get<StaffProfile[]>(LS_KEYS.staffProfiles, []).map(p =>
      p.id === id ? { ...p, ...updates, updatedAt: now() } : p
    )
    ls.set(LS_KEYS.staffProfiles, all)
    set(s => ({ profiles: s.profiles.map(p => p.id === id ? { ...p, ...updates, updatedAt: now() } : p) }))
  },

  removeProfile: async (id) => {
    const all = ls.get<StaffProfile[]>(LS_KEYS.staffProfiles, []).filter(p => p.id !== id)
    ls.set(LS_KEYS.staffProfiles, all)
    set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
  },

  addCallOut: async (data) => {
    const callOut: CallOut = { ...data, id: uid(), createdAt: now(), updatedAt: now() }
    const all = [callOut, ...ls.get<CallOut[]>(LS_KEYS.callOuts, [])]
    ls.set(LS_KEYS.callOuts, all)
    set(s => ({ callOuts: [callOut, ...s.callOuts] }))
  },

  updateCallOut: async (id, updates) => {
    const all = ls.get<CallOut[]>(LS_KEYS.callOuts, []).map(c =>
      c.id === id ? { ...c, ...updates, updatedAt: now() } : c
    )
    ls.set(LS_KEYS.callOuts, all)
    set(s => ({ callOuts: s.callOuts.map(c => c.id === id ? { ...c, ...updates, updatedAt: now() } : c) }))
  },

  removeCallOut: async (id) => {
    const all = ls.get<CallOut[]>(LS_KEYS.callOuts, []).filter(c => c.id !== id)
    ls.set(LS_KEYS.callOuts, all)
    set(s => ({ callOuts: s.callOuts.filter(c => c.id !== id) }))
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
