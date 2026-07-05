// ============================================================
// STAFF PROFILES, CALL-OUTS & CERTIFICATIONS
// ============================================================
// Call-outs are NEVER exposed to the staff member they target.
// Enforce this at the store layer (filter by viewer role/id)
// and at the Postgres RLS layer in production.
// ============================================================

import type { UserRole, Department } from './roles'

// ── Staff Profile ─────────────────────────────────────────────────────────────
export interface StaffProfile {
  /** Unique DB id */
  id: string
  /** Links to the AuthUser / Supabase auth.users row */
  authUserId: string
  employeeNumber: string
  firstName: string
  lastName: string
  preferredName?: string
  /** Full display name — computed, not stored */
  // displayName: `${firstName} ${lastName}` — derive at runtime
  role: UserRole
  department: Department
  /** Free-form position title, e.g. "Head Cook", "Dietary Aide" */
  position: string
  hireDate: string          // ISO 8601 date string YYYY-MM-DD
  status: StaffStatus
  fullTime: boolean
  phone?: string
  email?: string
  emergencyContact?: EmergencyContact
  certifications: Certification[]
  /** Visible to managers/admin only — never surface to the staff member */
  managerNotes?: string
  createdAt: string         // ISO 8601
  updatedAt: string         // ISO 8601
}

export type StaffStatus =
  | 'Active'
  | 'Inactive'
  | 'On Leave'
  | 'Terminated'

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

// ── Certifications ────────────────────────────────────────────────────────────
export interface Certification {
  id: string
  name: string              // e.g. "ServSafe", "CPR/AED"
  issuedDate: string        // YYYY-MM-DD
  expiresDate?: string      // YYYY-MM-DD — undefined = no expiry
  /** URL to uploaded certificate document (Supabase Storage in production) */
  fileUrl?: string
  isExpired?: boolean       // derived at runtime
}

/** Common certifications for quick-add */
export const COMMON_CERTIFICATIONS = [
  'ServSafe Food Handler',
  'ServSafe Food Manager',
  'CPR / AED',
  'First Aid',
  'Allergen Awareness',
  'TIPS / TABC',
  'Food Safety Level 2',
] as const
export type CommonCertification = typeof COMMON_CERTIFICATIONS[number]

// ── Call-Outs ─────────────────────────────────────────────────────────────────
// ⚠️  A staff member must NEVER see their own call-out records.
//     Filter using: callouts.filter(c => c.staffId !== viewer.staffId)
//     unless viewer.role is 'manager' or 'admin'.
export interface CallOut {
  id: string
  /** Staff profile ID of the person who called out */
  staffId: string
  /** Auth user ID of the manager/admin who filed this record */
  filedById: string
  /** Date the call-out occurred (not when it was filed) */
  date: string              // YYYY-MM-DD
  shift: CallOutShift
  reason: CallOutReason
  /** Free-form detail notes — manager/admin visible only */
  notes?: string
  followUpRequired: boolean
  followUpNotes?: string
  /** Whether the absence was covered by another employee */
  wasCovered: boolean
  coveredById?: string      // staff profile ID of covering employee
  createdAt: string
  updatedAt: string
}

export type CallOutShift =
  | 'Morning'
  | 'Evening'
  | 'All Day'
  | 'Split'

export type CallOutReason =
  | 'Sick'
  | 'Personal'
  | 'Family Emergency'
  | 'No Call No Show'
  | 'Approved Leave'
  | 'Bereavement'
  | 'Medical Appointment'
  | 'Other'

// ── Schedule ──────────────────────────────────────────────────────────────────
export interface ScheduleEntry {
  id: string
  staffId: string
  date: string              // YYYY-MM-DD
  shift: CallOutShift
  startTime: string         // HH:MM 24h
  endTime: string           // HH:MM 24h
  role: UserRole
  department: Department
  notes?: string
  createdById: string
  createdAt: string
}

// ── Timecard Punches ──────────────────────────────────────────────────────────
// Stored under LS_KEYS.timePunches ('sl_time_punches').
// badge_id and kiosk_id are non-PHI identifiers — safe for plain ls (not cs).
export interface TimecardPunch {
  id: string
  badge_id: string
  operation: 'In' | 'Out'
  kiosk_id: string
  punched_at: string        // ISO 8601
  created_at: string        // ISO 8601
  notes?: string | null
}
