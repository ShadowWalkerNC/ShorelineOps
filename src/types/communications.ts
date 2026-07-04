// ============================================================
// COMMUNICATIONS — NOTIFICATIONS, THREADS & APPROVALS
// ============================================================
// Three distinct systems that work together:
//
// 1. Notification — point-to-point, personal inbox only.
//    A staff member sees ONLY their own notifications.
//
// 2. CommunicationThread — structured workflow for resident
//    council notes, staff meeting minutes, memos, policy changes.
//    Draft → Pending Review → Approved → Distributed.
//
// 3. ApprovalRequest — change-gated workflow. Any sensitive
//    edit (menu, inventory, staff record) creates a request
//    that must be approved before the change is applied.
// ============================================================

import type { UserRole } from './roles'

// ── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string
  /** Recipient — only this staff member can see this notification */
  toStaffId: string
  /** Sender staff profile ID */
  fromStaffId: string
  type: NotificationType
  subject: string
  body: string
  /** Optional deep-link ID (approval request, thread, etc.) */
  linkedId?: string
  linkedType?: NotificationLinkType
  isRead: boolean
  createdAt: string
}

export type NotificationType =
  | 'memo'
  | 'approval_request'
  | 'approval_result'
  | 'schedule_change'
  | 'council_notes'
  | 'meeting_notes'
  | 'callout_filed'      // sent to manager/admin — NEVER to the subject
  | 'price_alert'
  | 'inventory_low'
  | 'system'

export type NotificationLinkType =
  | 'approval'
  | 'thread'
  | 'inventory_item'
  | 'truck_order'
  | 'staff_profile'

// ── Communication Threads ─────────────────────────────────────────────────────
/**
 * A structured, role-gated thread that follows an editorial workflow.
 * Example: Activities Director writes council notes → Manager reviews
 * → Manager responds → finalized → distributed to selected staff.
 */
export interface CommunicationThread {
  id: string
  type: ThreadType
  subject: string
  status: ThreadStatus
  createdById: string       // staff profile ID
  createdAt: string
  updatedAt: string
  entries: ThreadEntry[]
  /** Staff profile IDs who received the finalized distribution */
  distributedTo: string[]
  distributedAt?: string
  /** If true, a printed/exported copy was generated */
  wasPrinted: boolean
  printedAt?: string
  printedById?: string
}

export type ThreadType =
  | 'resident_council'
  | 'staff_meeting'
  | 'memo'
  | 'policy_change'
  | 'general'

export type ThreadStatus =
  | 'Draft'
  | 'Pending Review'
  | 'Approved'
  | 'Distributed'
  | 'Archived'

export interface ThreadEntry {
  id: string
  /** Staff profile ID of the author */
  authorId: string
  /** Role snapshot at time of writing */
  authorRole: UserRole
  body: string
  createdAt: string
  /**
   * Internal entries are visible to managers/admins only
   * and are NOT included in the distributed document.
   */
  isInternal: boolean
}

// ── Approval Requests ─────────────────────────────────────────────────────────
/**
 * Created whenever a change requires authorization before being applied.
 * The payload contains a snapshot of the proposed change data.
 * On approval, the calling code applies the payload to the target store.
 */
export interface ApprovalRequest {
  id: string
  type: ApprovalType
  /** Staff profile ID of the person requesting the change */
  requestedById: string
  /** Staff profile ID of the assigned approver */
  assignedToId: string
  status: ApprovalStatus
  subject: string
  description: string
  /**
   * Serialized snapshot of the proposed change.
   * Shape varies by type — use a discriminated union per type in consuming code.
   */
  payload: Record<string, unknown>
  reviewedAt?: string
  reviewNote?: string
  createdAt: string
  updatedAt: string
}

export type ApprovalType =
  | 'menu_change'
  | 'inventory_adjustment'
  | 'truck_order'
  | 'staff_record_change'
  | 'budget_override'
  | 'checklist_change'

export type ApprovalStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Withdrawn'
