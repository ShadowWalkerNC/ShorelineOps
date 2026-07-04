// ============================================================
// SHIFT CHECKLISTS — EDITABLE TEMPLATES + PRINT FORMS
// ============================================================
// Management edits the master template.
// Staff print blank copies and fill out by hand.
// Completed copies can optionally be scanned/attached.
//
// Two shifts: Morning, Evening.
// Two roles: Kitchen, Server (or All).
// Three frequencies: Daily, Weekly, Monthly.
// ============================================================

import type { UserRole } from './roles'

export type ChecklistShift = 'Morning' | 'Evening'
export type ChecklistRole  = 'Kitchen' | 'Server' | 'All'
export type ChecklistFrequency = 'Daily' | 'Weekly' | 'Monthly'

// ── Template ──────────────────────────────────────────────────────────────────
export interface ChecklistTemplate {
  id: string
  name: string
  shift: ChecklistShift
  role: ChecklistRole
  frequency: ChecklistFrequency
  /** Ordered list of task items */
  items: ChecklistTemplateItem[]
  isActive: boolean
  lastEditedById: string    // staff profile ID
  lastEditedAt: string
  createdAt: string
}

export interface ChecklistTemplateItem {
  id: string
  order: number
  task: string
  /** Optional detail / instruction below the task line */
  detail?: string
  /** Some tasks may be Kitchen-only even within an All checklist */
  subRole?: ChecklistRole
  requiresInitials: boolean // if true, print a blank initial line
  requiresTemp: boolean     // if true, print a temp log blank
  requiresTime: boolean     // if true, print a time-stamp blank
}

// ── Completed Record (digital — optional, for tracking) ───────────────────────
/**
 * If staff complete the checklist digitally rather than on paper,
 * store the result here. Otherwise only the printed form exists.
 */
export interface CompletedChecklist {
  id: string
  templateId: string
  completedById: string     // staff profile ID
  completedForDate: string  // YYYY-MM-DD
  shift: ChecklistShift
  items: CompletedChecklistItem[]
  signedOffById?: string    // manager who reviewed
  signedOffAt?: string
  createdAt: string
}

export interface CompletedChecklistItem {
  templateItemId: string
  isDone: boolean
  initials?: string
  temp?: string
  time?: string
  note?: string
}

// ── Minimum role required to edit templates ───────────────────────────────────
export const CHECKLIST_EDIT_MIN_ROLE: UserRole = 'manager'
