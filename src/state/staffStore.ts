// ============================================================
// STAFF STORE
// ============================================================
// Manages staff profiles, call-outs, and schedule entries.
//
// SECURITY NOTE:
//   getCallOuts(viewerAuthUserId, viewerRole) filters call-outs
//   so a staff member can NEVER see records filed against
//   themselves. Enforce this at Postgres RLS level as well.
// ============================================================

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { StaffProfile, CallOut, ScheduleEntry } from '../types/staff'
import type { UserRole } from '../types/roles'

// ── Row mappers ──────────────────────────────────────────────────────────────

function toProfile(row: Record<string, unknown>): StaffProfile {
  return {
    id:              row.id             as string,
    authUserId:      (row.auth_user_id  as string) ?? '',
    employeeNumber:  (row.employee_number as string) ?? '',
    firstName:       (row.first_name    as string) ?? '',
    lastName:        (row.last_name     as string) ?? '',
    preferredName:   row.preferred_name as string | undefined,
    role:            (row.role          as UserRole) ?? 'staff',
    department:      (row.department    as StaffProfile['department']) ?? 'Dietary',
    position:        (row.position      as string) ?? '',
    hireDate:        (row.hire_date     as string) ?? '',
    status:          (row.status        as StaffProfile['status']) ?? 'Active',
    fullTime:        Boolean(row.full_time ?? false),
    phone:           row.phone          as string | undefined,
    email:           row.email          as string | undefined,
    emergencyContact: row.emergency_contact as StaffProfile['emergencyContact'] | undefined,
    certifications:  (row.certifications as StaffProfile['certifications']) ?? [],
    managerNotes:    row.manager_notes  as string | undefined,
    createdAt:       (row.created_at    as string) ?? new Date().toISOString(),
    updatedAt:       (row.updated_at    as string) ?? new Date().toISOString(),
  }
}

function profileToRow(data: Partial<StaffProfile>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (data.authUserId      !== undefined) r.auth_user_id      = data.authUserId
  if (data.employeeNumber  !== undefined) r.employee_number   = data.employeeNumber
  if (data.firstName       !== undefined) r.first_name        = data.firstName
  if (data.lastName        !== undefined) r.last_name         = data.lastName
  if (data.preferredName   !== undefined) r.preferred_name    = data.preferredName
  if (data.role            !== undefined) r.role              = data.role
  if (data.department      !== undefined) r.department        = data.department
  if (data.position        !== undefined) r.position          = data.position
  if (data.hireDate        !== undefined) r.hire_date         = data.hireDate
  if (data.status          !== undefined) r.status            = data.status
  if (data.fullTime        !== undefined) r.full_time         = data.fullTime
  if (data.phone           !== undefined) r.phone             = data.phone
  if (data.email           !== undefined) r.email             = data.email
  if (data.emergencyContact !== undefined) r.emergency_contact = data.emergencyContact
  if (data.certifications  !== undefined) r.certifications    = data.certifications
  if (data.managerNotes    !== undefined) r.manager_notes     = data.managerNotes
  return r
}

function toCallOut(row: Record<string, unknown>): CallOut {
  return {
    id:               row.id               as string,
    staffId:          (row.staff_id        as string) ?? '',
    filedById:        (row.filed_by_id     as string) ?? '',
    date:             (row.date            as string) ?? '',
    shift:            (row.shift           as CallOut['shift']) ?? 'Morning',
    reason:           (row.reason          as CallOut['reason']) ?? 'Other',
    notes:            row.notes            as string | undefined,
    followUpRequired: Boolean(row.follow_up_required ?? false),
    followUpNotes:    row.follow_up_notes  as string | undefined,
    wasCovered:       Boolean(row.was_covered ?? false),
    coveredById:      row.covered_by_id    as string | undefined,
    createdAt:        (row.created_at      as string) ?? new Date().toISOString(),
    updatedAt:        (row.updated_at      as string) ?? new Date().toISOString(),
  }
}

function callOutToRow(data: Partial<CallOut>): Record<string, unknown> {
  const r: Record<string, unknown> = {}
  if (data.staffId          !== undefined) r.staff_id           = data.staffId
  if (data.filedById        !== undefined) r.filed_by_id        = data.filedById
  if (data.date             !== undefined) r.date               = data.date
  if (data.shift            !== undefined) r.shift              = data.shift
  if (data.reason           !== undefined) r.reason             = data.reason
  if (data.notes            !== undefined) r.notes              = data.notes
  if (data.followUpRequired !== undefined) r.follow_up_required = data.followUpRequired
  if (data.followUpNotes    !== undefined) r.follow_up_notes    = data.followUpNotes
  if (data.wasCovered       !== undefined) r.was_covered        = data.wasCovered
  if (data.coveredById      !== undefined) r.covered_by_id      = data.coveredById
  return r
}

// ── Store ────────────────────────────────────────────────────────────────────

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

  /**
   * Returns call-outs filtered by viewer identity.
   * A staff member (role < manager) can NEVER see their own call-outs.
   * Enforce at Postgres RLS level as well.
   */
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
      const [profilesRes, callOutsRes] = await Promise.all([
        supabase.from('staff_profiles').select('*').order('last_name'),
        supabase.from('call_outs').select('*').order('date', { ascending: false }),
      ])
      if (profilesRes.error) throw new Error(profilesRes.error.message)
      if (callOutsRes.error) throw new Error(callOutsRes.error.message)
      set({
        profiles:  (profilesRes.data ?? []).map((r: any) => toProfile(r as Record<string, unknown>)),
        callOuts:  (callOutsRes.data  ?? []).map((r: any) => toCallOut(r as Record<string, unknown>)),
        isLoading: false,
      })
    } catch (e: unknown) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  addProfile: async (data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('staff_profiles') as any)
      .insert(profileToRow(data as Partial<StaffProfile>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ profiles: [...s.profiles, toProfile(row as Record<string, unknown>)] }))
  },

  updateProfile: async (id, updates) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('staff_profiles') as any)
      .update({ ...profileToRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ profiles: s.profiles.map(p => p.id === id ? toProfile(row as Record<string, unknown>) : p) }))
  },

  removeProfile: async (id) => {
    const { error } = await supabase.from('staff_profiles').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
  },

  addCallOut: async (data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('call_outs') as any)
      .insert(callOutToRow(data as Partial<CallOut>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ callOuts: [toCallOut(row as Record<string, unknown>), ...s.callOuts] }))
  },

  updateCallOut: async (id, updates) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('call_outs') as any)
      .update({ ...callOutToRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ callOuts: s.callOuts.map(c => c.id === id ? toCallOut(row as Record<string, unknown>) : c) }))
  },

  removeCallOut: async (id) => {
    const { error } = await supabase.from('call_outs').delete().eq('id', id)
    if (error) throw new Error(error.message)
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

  addScheduleEntry: (entry) =>
    set(s => ({ schedule: [...s.schedule, entry] })),

  updateScheduleEntry: (id, updates) =>
    set(s => ({
      schedule: s.schedule.map(e => e.id === id ? { ...e, ...updates } : e),
    })),

  removeScheduleEntry: (id) =>
    set(s => ({ schedule: s.schedule.filter(e => e.id !== id) })),

  profileByAuthId: (authUserId) =>
    get().profiles.find(p => p.authUserId === authUserId),
}))
