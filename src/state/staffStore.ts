// ============================================================
// STAFF STORE
// ============================================================
// Manages staff profiles, call-outs, and schedule entries.
//
// SECURITY NOTE:
//   getCallOuts(viewerId, viewerRole) filters call-outs so a
//   staff member can NEVER see records filed against themselves.
//   In production, enforce this at Postgres RLS level as well.
//
// Production migration:
//   Replace fetch() body with Supabase queries.
//   State shape and selectors remain identical.
// ============================================================

import { create } from 'zustand'
import type { StaffProfile, CallOut, ScheduleEntry } from '../types/staff'
import type { UserRole } from '../types/roles'

// ── Seed Data ────────────────────────────────────────────────────────────────
const SEED_STAFF: StaffProfile[] = [
  {
    id: 'staff-1',
    authUserId: 'demo-admin-1',
    employeeNumber: 'EMP-001',
    firstName: 'Alex',
    lastName: 'Rivera',
    role: 'admin',
    department: 'Administration',
    position: 'Executive Director',
    hireDate: '2020-01-15',
    status: 'Active',
    fullTime: true,
    phone: '555-100-0001',
    email: 'admin@shoreline.demo',
    certifications: [
      { id: 'cert-1', name: 'ServSafe Food Manager', issuedDate: '2023-03-01', expiresDate: '2028-03-01' },
    ],
    createdAt: '2020-01-15T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'staff-2',
    authUserId: 'demo-manager-1',
    employeeNumber: 'EMP-002',
    firstName: 'Morgan',
    lastName: 'Ellis',
    role: 'manager',
    department: 'Dietary',
    position: 'Dietary Manager',
    hireDate: '2021-06-01',
    status: 'Active',
    fullTime: true,
    phone: '555-100-0002',
    email: 'manager@shoreline.demo',
    certifications: [
      { id: 'cert-2', name: 'ServSafe Food Manager', issuedDate: '2022-05-10', expiresDate: '2027-05-10' },
      { id: 'cert-3', name: 'CPR / AED', issuedDate: '2023-01-20', expiresDate: '2025-01-20' },
    ],
    createdAt: '2021-06-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'staff-3',
    authUserId: 'demo-dietary-1',
    employeeNumber: 'EMP-003',
    firstName: 'Jamie',
    lastName: 'Torres',
    role: 'dietary',
    department: 'Dietary',
    position: 'Head Cook',
    hireDate: '2022-03-14',
    status: 'Active',
    fullTime: true,
    phone: '555-100-0003',
    email: 'dietary@shoreline.demo',
    certifications: [
      { id: 'cert-4', name: 'ServSafe Food Handler', issuedDate: '2022-03-01', expiresDate: '2025-03-01' },
    ],
    createdAt: '2022-03-14T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'staff-4',
    authUserId: 'demo-activities-1',
    employeeNumber: 'EMP-004',
    firstName: 'Casey',
    lastName: 'Nguyen',
    role: 'activities',
    department: 'Activities',
    position: 'Activities Director',
    hireDate: '2021-09-01',
    status: 'Active',
    fullTime: true,
    phone: '555-100-0004',
    email: 'activities@shoreline.demo',
    certifications: [],
    createdAt: '2021-09-01T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'staff-5',
    authUserId: 'demo-server-1',
    employeeNumber: 'EMP-005',
    firstName: 'Jordan',
    lastName: 'Lee',
    role: 'server',
    department: 'Dietary',
    position: 'Dining Room Server',
    hireDate: '2023-05-20',
    status: 'Active',
    fullTime: false,
    phone: '555-100-0005',
    email: 'server@shoreline.demo',
    certifications: [
      { id: 'cert-5', name: 'ServSafe Food Handler', issuedDate: '2023-05-01', expiresDate: '2026-05-01' },
    ],
    createdAt: '2023-05-20T08:00:00Z',
    updatedAt: '2024-01-01T08:00:00Z',
  },
  {
    id: 'staff-6',
    authUserId: 'demo-staff-1',
    employeeNumber: 'EMP-006',
    firstName: 'Sam',
    lastName: 'Washington',
    role: 'staff',
    department: 'Dietary',
    position: 'Dietary Aide',
    hireDate: '2024-02-01',
    status: 'Active',
    fullTime: false,
    phone: '555-100-0006',
    email: 'staff@shoreline.demo',
    certifications: [],
    createdAt: '2024-02-01T08:00:00Z',
    updatedAt: '2024-02-01T08:00:00Z',
  },
]

const SEED_CALLOUTS: CallOut[] = [
  {
    id: 'co-1',
    staffId: 'staff-3',      // Jamie Torres — HEAD COOK
    filedById: 'staff-2',   // Morgan Ellis — MANAGER
    date: '2026-06-15',
    shift: 'Morning',
    reason: 'Sick',
    notes: 'Called in at 5:45am. Kitchen was short-staffed for breakfast service.',
    followUpRequired: false,
    wasCovered: true,
    coveredById: 'staff-6',
    createdAt: '2026-06-15T06:00:00Z',
    updatedAt: '2026-06-15T06:00:00Z',
  },
  {
    id: 'co-2',
    staffId: 'staff-5',      // Jordan Lee — SERVER
    filedById: 'staff-2',   // Morgan Ellis — MANAGER
    date: '2026-06-28',
    shift: 'Evening',
    reason: 'No Call No Show',
    notes: 'Did not show for dinner service. Could not be reached by phone.',
    followUpRequired: true,
    followUpNotes: 'Verbal warning issued on 06/29.',
    wasCovered: false,
    createdAt: '2026-06-28T16:00:00Z',
    updatedAt: '2026-06-29T09:00:00Z',
  },
]

const SEED_SCHEDULE: ScheduleEntry[] = []

// ── Store ────────────────────────────────────────────────────────────────────
interface StaffState {
  profiles: StaffProfile[]
  callOuts: CallOut[]
  schedule: ScheduleEntry[]
  isLoading: boolean
  error: string | null

  fetch: () => Promise<void>

  // Profile mutations
  addProfile:    (profile: StaffProfile) => void
  updateProfile: (id: string, updates: Partial<StaffProfile>) => void
  removeProfile: (id: string) => void

  // Call-out mutations
  addCallOut:    (callOut: CallOut) => void
  updateCallOut: (id: string, updates: Partial<CallOut>) => void
  removeCallOut: (id: string) => void

  /**
   * Returns call-outs filtered by viewer identity.
   * A staff member (role < manager) can NEVER see their own call-outs.
   */
  getCallOuts: (viewerAuthUserId: string, viewerRole: UserRole) => CallOut[]

  // Schedule
  addScheduleEntry:    (entry: ScheduleEntry) => void
  updateScheduleEntry: (id: string, updates: Partial<ScheduleEntry>) => void
  removeScheduleEntry: (id: string) => void

  /** Resolve staff profile from an auth user ID */
  profileByAuthId: (authUserId: string) => StaffProfile | undefined
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const useStaffStore = create<StaffState>((set, get) => ({
  profiles:  [],
  callOuts:  [],
  schedule:  [],
  isLoading: false,
  error:     null,

  fetch: async () => {
    set({ isLoading: true, error: null })
    // Production: replace with Supabase queries
    // const { data, error } = await supabase.from('staff_profiles').select('*')
    await new Promise(r => setTimeout(r, 100)) // simulate latency
    set({
      profiles:  SEED_STAFF,
      callOuts:  SEED_CALLOUTS,
      schedule:  SEED_SCHEDULE,
      isLoading: false,
    })
  },

  addProfile: (profile) =>
    set(s => ({ profiles: [...s.profiles, profile] })),

  updateProfile: (id, updates) =>
    set(s => ({
      profiles: s.profiles.map(p =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    })),

  removeProfile: (id) =>
    set(s => ({ profiles: s.profiles.filter(p => p.id !== id) })),

  addCallOut: (callOut) =>
    set(s => ({ callOuts: [...s.callOuts, callOut] })),

  updateCallOut: (id, updates) =>
    set(s => ({
      callOuts: s.callOuts.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    })),

  removeCallOut: (id) =>
    set(s => ({ callOuts: s.callOuts.filter(c => c.id !== id) })),

  getCallOuts: (viewerAuthUserId, viewerRole) => {
    const { callOuts, profiles } = get()
    const isPrivileged = viewerRole === 'admin' || viewerRole === 'manager'
    if (isPrivileged) return callOuts
    // Non-privileged: strip any call-outs filed against the viewer
    const viewerProfile = profiles.find(p => p.authUserId === viewerAuthUserId)
    if (!viewerProfile) return []
    return callOuts.filter(c => c.staffId !== viewerProfile.id)
  },

  addScheduleEntry: (entry) =>
    set(s => ({ schedule: [...s.schedule, entry] })),

  updateScheduleEntry: (id, updates) =>
    set(s => ({
      schedule: s.schedule.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    })),

  removeScheduleEntry: (id) =>
    set(s => ({ schedule: s.schedule.filter(e => e.id !== id) })),

  profileByAuthId: (authUserId) =>
    get().profiles.find(p => p.authUserId === authUserId),
}))
