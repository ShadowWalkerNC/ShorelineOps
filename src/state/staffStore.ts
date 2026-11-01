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
import { api } from '@/api/client'
import { supabase } from '@/lib/supabase'
import type { StaffProfile, CallOut, ScheduleEntry } from '../types/staff'
import type { UserRole } from '../types/roles'

// ── Row mappers ──────────────────────────────────────────────────────────────

function toProfile(row: Record<string, unknown>): StaffProfile {
  return {
    id:              (row.id as string) ?? '',
    authUserId:      ((row.auth_user_id ?? row.authUserId) as string) ?? '',
    employeeNumber:  ((row.employee_number ?? row.employeeNumber) as string) ?? '',
    firstName:       ((row.first_name ?? row.firstName) as string) ?? '',
    lastName:        ((row.last_name ?? row.lastName) as string) ?? '',
    preferredName:   (row.preferred_name ?? row.preferredName) as string | undefined,
    role:            ((row.role as UserRole) ?? 'staff'),
    department:      ((row.department as StaffProfile['department']) ?? 'Dietary'),
    position:        ((row.position as string) ?? ''),
    hireDate:        ((row.hire_date ?? row.hireDate) as string) ?? '',
    status:          ((row.status as StaffProfile['status']) ?? 'Active'),
    fullTime:        Boolean(row.full_time ?? row.fullTime ?? false),
    phone:           (row.phone as string) || undefined,
    email:           (row.email as string) || undefined,
    emergencyContact: (row.emergency_contact ?? row.emergencyContact) as StaffProfile['emergencyContact'] | undefined,
    certifications:  ((row.certifications as StaffProfile['certifications']) ?? []),
    managerNotes:    (row.manager_notes ?? row.managerNotes) as string | undefined,
    createdAt:       ((row.created_at ?? row.createdAt) as string) ?? new Date().toISOString(),
    updatedAt:       ((row.updated_at ?? row.updatedAt) as string) ?? new Date().toISOString(),
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
    id:               (row.id as string) ?? '',
    staffId:          ((row.staff_id ?? row.staffId) as string) ?? '',
    filedById:        ((row.filed_by_id ?? row.filedById) as string) ?? '',
    date:             ((row.date as string) ?? ''),
    shift:            ((row.shift as CallOut['shift']) ?? 'Morning'),
    reason:           ((row.reason as CallOut['reason']) ?? 'Other'),
    notes:            (row.notes as string) || undefined,
    followUpRequired: Boolean(row.follow_up_required ?? row.followUpRequired ?? false),
    followUpNotes:    (row.follow_up_notes ?? row.followUpNotes) as string | undefined,
    wasCovered:       Boolean(row.was_covered ?? row.wasCovered ?? (row.coverage_status === 'Covered')),
    coveredById:      ((row.covered_by_id ?? row.coveredById ?? row.replacement_staff_id) as string) || undefined,
    createdAt:        ((row.created_at ?? row.createdAt) as string) ?? new Date().toISOString(),
    updatedAt:        ((row.updated_at ?? row.updatedAt) as string) ?? new Date().toISOString(),
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

// ── Shift Types & Mapper ─────────────────────────────────────────────────────

export type ShiftWindow = 'Morning' | 'Midday' | 'Evening'

export interface Shift {
  id: string
  staffId: string
  staffName: string
  date: string // YYYY-MM-DD
  shift: ShiftWindow
  position: string
  station?: string
  callOut: boolean
  callOutReason?: string
  notes?: string
  coverageStatus?: string
  createdAt: string
  updatedAt: string
}

export interface CreateShiftInput {
  staffId?: string
  staffName?: string
  date: string
  shift: ShiftWindow
  position?: string
  station?: string
  callOut?: boolean
  callOutReason?: string
  notes?: string
  coverageStatus?: string
}

function toShift(row: Record<string, unknown>): Shift {
  const staffName = ((row.staff_name ?? row.staffName) as string) ||
    `${(row.preferred_name ?? row.first_name ?? '') as string} ${(row.last_name ?? '') as string}`.trim() ||
    ((row.staff_id ?? row.staffId) as string) || 'Dietary Staff'
  const date = ((row.shift_date ?? row.date) as string) || new Date().toISOString().slice(0, 10)
  const rawShift = String(row.shift_window ?? row.shift ?? 'Morning')
  let shiftWindow: ShiftWindow = 'Morning'
  if (/^midday$/i.test(rawShift)) shiftWindow = 'Midday'
  else if (/^evening$/i.test(rawShift)) shiftWindow = 'Evening'

  const isCallOut = Boolean(row.call_out ?? row.callOut ?? row.call_out_id)
  return {
    id: (row.id as string) ?? crypto.randomUUID(),
    staffId: ((row.staff_id ?? row.staffId) as string) ?? '',
    staffName,
    date,
    shift: shiftWindow,
    position: ((row.position as string) ?? 'Dietary Aide'),
    station: (row.station as string) || undefined,
    callOut: isCallOut,
    callOutReason: ((row.call_out_reason ?? row.callOutReason ?? row.reason) as string) || undefined,
    notes: ((row.call_out_notes ?? row.notes) as string) || undefined,
    coverageStatus: ((row.call_out_coverage_status ?? row.coverage_status ?? row.coverageStatus) as string) || (isCallOut ? 'Uncovered' : undefined),
    createdAt: ((row.created_at ?? row.createdAt) as string) ?? new Date().toISOString(),
    updatedAt: ((row.updated_at ?? row.updatedAt) as string) ?? new Date().toISOString(),
  }
}

function getInitialDemoShifts(): Shift[] {
  const today = new Date()
  const shifts: Shift[] = []
  const demoCrew = [
    { staffId: 'D001', staffName: 'Marcus Vance', position: 'Executive Chef', shift: 'Morning' as ShiftWindow, station: 'Hot Line' },
    { staffId: 'D002', staffName: 'Carlos Mendez', position: 'Lead Cook', shift: 'Morning' as ShiftWindow, station: 'Hot Line' },
    { staffId: 'D003', staffName: 'Priya Nair', position: 'Cook', shift: 'Evening' as ShiftWindow, station: 'Special Diets' },
    { staffId: 'D004', staffName: 'Tom Baker', position: 'Prep Cook', shift: 'Midday' as ShiftWindow, station: 'Cold Prep' },
    { staffId: 'D005', staffName: 'Jordan Ellis', position: 'Dietary Aide', shift: 'Morning' as ShiftWindow, station: 'Tray Assembly' },
    { staffId: 'D006', staffName: 'Sam Okafor', position: 'Dietary Aide', shift: 'Evening' as ShiftWindow, station: 'Dish Room' },
  ]

  for (let offset = -2; offset <= 4; offset++) {
    const d = new Date(today)
    d.setDate(today.getDate() + offset)
    const dateStr = d.toISOString().slice(0, 10)

    demoCrew.slice(0, 4).forEach((crew, idx) => {
      const isCallOut = offset === 0 && idx === 2
      shifts.push({
        id: `demo-shift-${dateStr}-${crew.staffId}`,
        staffId: crew.staffId,
        staffName: crew.staffName,
        date: dateStr,
        shift: crew.shift,
        position: crew.position,
        station: crew.station,
        callOut: isCallOut,
        callOutReason: isCallOut ? 'Sick' : undefined,
        notes: isCallOut ? 'Coverage requested for dinner service' : undefined,
        coverageStatus: isCallOut ? 'Uncovered' : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })
  }
  return shifts
}

// ── State interface ──────────────────────────────────────────────────────────

export interface StaffState {
  profiles:      StaffProfile[]
  callOuts:      CallOut[]
  schedule:      ScheduleEntry[]
  shifts:        Shift[]
  isLoading:     boolean
  shiftsLoading: boolean
  error:         string | null
  shiftsError:   string | null

  fetch:               () => Promise<void>
  addProfile:          (data: Omit<StaffProfile, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateProfile:       (id: string, data: Partial<StaffProfile>) => Promise<void>
  removeProfile:       (id: string) => Promise<void>

  addCallOut:          (data: Omit<CallOut, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateCallOut:       (id: string, data: Partial<CallOut>) => Promise<void>
  removeCallOut:       (id: string) => Promise<void>

  getCallOuts:         (viewerAuthUserId: string, viewerRole: UserRole) => CallOut[]

  addScheduleEntry:    (entry: ScheduleEntry) => void
  updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => void
  removeScheduleEntry: (id: string) => void

  fetchShifts:         (params?: { date?: string; from?: string; to?: string; staffId?: string }) => Promise<void>
  createShift:         (input: CreateShiftInput) => Promise<Shift | null>
  updateShift:         (id: string, updates: Partial<Shift>) => Promise<Shift | null>
  deleteShift:         (id: string) => Promise<boolean>
  toggleCallOut:       (id: string, reason?: string, notes?: string) => Promise<Shift | null>

  profileByAuthId: (authUserId: string) => StaffProfile | undefined
}

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

export const useStaffStore = create<StaffState>((set, get) => ({
  profiles:      [],
  callOuts:      [],
  schedule:      [],
  shifts:        getInitialDemoShifts(),
  isLoading:     false,
  shiftsLoading: false,
  error:         null,
  shiftsError:   null,

  fetch: async () => {
    set({ isLoading: true, error: null })
    if (!isDemo) {
      try {
        const [profilesRes, callOutsRes, shiftsRes] = await Promise.all([
          api.get('/admin/staff'),
          api.get('/admin/call-outs'),
          api.get('/admin/shifts'),
        ])
        if (Array.isArray(profilesRes.data) && Array.isArray(callOutsRes.data)) {
          const fetchedShifts = Array.isArray(shiftsRes.data?.shifts)
            ? shiftsRes.data.shifts.map(toShift)
            : []
          set({
            profiles: profilesRes.data.map(toProfile),
            callOuts: callOutsRes.data.map(toCallOut),
            shifts: fetchedShifts.length > 0 ? fetchedShifts : getInitialDemoShifts(),
            isLoading: false,
          })
          return
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API fetch failed, falling back to local adapter:', err?.message)
      }
    }
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
    if (!isDemo) {
      try {
        const res = await api.post('/admin/staff', data)
        if (res.data?.id) {
          set(s => ({ profiles: [...s.profiles, toProfile(res.data)] }))
          return
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API addProfile failed, falling back to local adapter:', err?.message)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('staff_profiles') as any)
      .insert(profileToRow(data as Partial<StaffProfile>)).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ profiles: [...s.profiles, toProfile(row as Record<string, unknown>)] }))
  },

  updateProfile: async (id, updates) => {
    if (!isDemo) {
      try {
        const res = await api.put(`/admin/staff/${id}`, updates)
        if (res.data?.id) {
          set(s => ({ profiles: s.profiles.map(p => p.id === id ? toProfile(res.data) : p) }))
          return
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API updateProfile failed, falling back to local adapter:', err?.message)
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('staff_profiles') as any)
      .update({ ...profileToRow(updates), updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw new Error(error.message)
    set(s => ({ profiles: s.profiles.map(p => p.id === id ? toProfile(row as Record<string, unknown>) : p) }))
  },

  removeProfile: async (id) => {
    if (!isDemo) {
      try {
        await api.delete(`/admin/staff/${id}`)
        set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
        return
      } catch (err: any) {
        console.warn('[staffStore] Live API removeProfile failed, falling back to local adapter:', err?.message)
      }
    }
    const { error } = await supabase.from('staff_profiles').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s => ({ profiles: s.profiles.filter(p => p.id !== id) }))
  },

  addCallOut: async (data) => {
    if (!isDemo) {
      try {
        const res = await api.post('/admin/call-outs', data)
        if (res.data?.id) {
          set(s => ({ callOuts: [toCallOut(res.data), ...s.callOuts] }))
          return
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API addCallOut failed, falling back to local adapter:', err?.message)
      }
    }
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
    if (!isDemo) {
      try {
        await api.delete(`/admin/call-outs/${id}`)
        set(s => ({ callOuts: s.callOuts.filter(c => c.id !== id) }))
        return
      } catch (err: any) {
        console.warn('[staffStore] Live API removeCallOut failed, falling back to local adapter:', err?.message)
      }
    }
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

  fetchShifts: async (params) => {
    set({ shiftsLoading: true, shiftsError: null })
    if (!isDemo) {
      try {
        const qs = new URLSearchParams()
        if (params?.date)    qs.set('date', params.date)
        if (params?.from)    qs.set('from', params.from)
        if (params?.to)      qs.set('to', params.to)
        if (params?.staffId) qs.set('staff_id', params.staffId)
        const path = `/admin/shifts${qs.toString() ? '?' + qs.toString() : ''}`
        const res = await api.get(path)
        if (Array.isArray(res.data?.shifts)) {
          set({
            shifts: res.data.shifts.map(toShift),
            shiftsLoading: false,
          })
          return
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API fetchShifts failed, falling back to local adapter:', err?.message)
      }
    }
    // Fallback: filter local shifts by date / staffId if provided
    set(s => {
      let filtered = s.shifts
      if (params?.date) filtered = filtered.filter(x => x.date === params.date)
      if (params?.from) filtered = filtered.filter(x => x.date >= params.from!)
      if (params?.to)   filtered = filtered.filter(x => x.date <= params.to!)
      if (params?.staffId) filtered = filtered.filter(x => x.staffId === params.staffId)
      return { shiftsLoading: false }
    })
  },

  createShift: async (input) => {
    set({ shiftsLoading: true, shiftsError: null })
    if (!isDemo) {
      try {
        const res = await api.post('/admin/shifts', {
          staff_id: input.staffId,
          staff_name: input.staffName,
          shift_date: input.date,
          shift_window: input.shift,
          position: input.position,
          station: input.station,
          call_out: input.callOut,
          call_out_reason: input.callOutReason,
          notes: input.notes,
          coverage_status: input.coverageStatus,
        })
        if (res.data?.id) {
          const created = toShift(res.data)
          set(s => ({
            shifts: [...s.shifts.filter(x => x.id !== created.id), created],
            shiftsLoading: false,
          }))
          return created
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API createShift failed, falling back to local adapter:', err?.message)
      }
    }
    const newShift: Shift = {
      id: crypto.randomUUID(),
      staffId: input.staffId || crypto.randomUUID(),
      staffName: input.staffName || 'Dietary Staff',
      date: input.date,
      shift: input.shift,
      position: input.position || 'Dietary Aide',
      station: input.station || '',
      callOut: Boolean(input.callOut),
      callOutReason: input.callOutReason,
      notes: input.notes,
      coverageStatus: input.callOut ? (input.coverageStatus || 'Uncovered') : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set(s => ({
      shifts: [...s.shifts.filter(x => !(x.staffId === newShift.staffId && x.date === newShift.date && x.shift === newShift.shift)), newShift],
      shiftsLoading: false,
    }))
    return newShift
  },

  updateShift: async (id, updates) => {
    set({ shiftsLoading: true, shiftsError: null })
    if (!isDemo) {
      try {
        const res = await api.put(`/admin/shifts/${id}`, {
          staff_id: updates.staffId,
          staff_name: updates.staffName,
          shift_date: updates.date,
          shift_window: updates.shift,
          position: updates.position,
          station: updates.station,
          call_out: updates.callOut,
          call_out_reason: updates.callOutReason,
          notes: updates.notes,
          coverage_status: updates.coverageStatus,
        })
        if (res.data?.id) {
          const updated = toShift(res.data)
          set(s => ({
            shifts: s.shifts.map(x => x.id === id ? updated : x),
            shiftsLoading: false,
          }))
          return updated
        }
      } catch (err: any) {
        console.warn('[staffStore] Live API updateShift failed, falling back to local adapter:', err?.message)
      }
    }
    let updatedShift: Shift | null = null
    set(s => {
      const list = s.shifts.map(x => {
        if (x.id !== id) return x
        updatedShift = {
          ...x,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
        return updatedShift
      })
      return { shifts: list, shiftsLoading: false }
    })
    return updatedShift
  },

  deleteShift: async (id) => {
    set({ shiftsLoading: true, shiftsError: null })
    if (!isDemo) {
      try {
        await api.delete(`/admin/shifts/${id}`)
        set(s => ({
          shifts: s.shifts.filter(x => x.id !== id),
          shiftsLoading: false,
        }))
        return true
      } catch (err: any) {
        console.warn('[staffStore] Live API deleteShift failed, falling back to local adapter:', err?.message)
      }
    }
    set(s => ({
      shifts: s.shifts.filter(x => x.id !== id),
      shiftsLoading: false,
    }))
    return true
  },

  toggleCallOut: async (id, reason, notes) => {
    const current = get().shifts.find(s => s.id === id)
    if (!current) return null
    const nextCallOut = !current.callOut
    return get().updateShift(id, {
      callOut: nextCallOut,
      callOutReason: nextCallOut ? (reason || 'Sick') : undefined,
      notes: nextCallOut ? (notes || current.notes) : current.notes,
      coverageStatus: nextCallOut ? (current.coverageStatus || 'Uncovered') : undefined,
    })
  },

  profileByAuthId: (authUserId) =>
    get().profiles.find(p => p.authUserId === authUserId),
}))
