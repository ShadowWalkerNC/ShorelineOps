// ============================================================
// NOTIFICATIONS STORE
// ============================================================
// Each notification belongs to exactly one recipient (toStaffId).
// The store ONLY exposes notifications for the current viewer
// via getForStaff(staffId). No cross-user visibility.
//
// Production migration:
//   Replace fetch() with Supabase real-time subscription:
//   supabase.from('notifications').on('INSERT', ...).subscribe()
//   RLS policy: WHERE to_staff_id = auth.uid()
// ============================================================

import { create } from 'zustand'
import type { Notification, NotificationType } from '../types/communications'

// ── Seed data ─────────────────────────────────────────────────────────────────
const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-1',
    toStaffId:   'staff-3',
    fromStaffId: 'staff-2',
    type: 'memo',
    subject: 'Tuesday Menu Adjustment',
    body: 'Please note that the Tuesday lunch protein has been changed from salmon to chicken due to a vendor shortage. Update your prep list accordingly.',
    isRead: false,
    createdAt: '2026-07-01T09:00:00Z',
  },
  {
    id: 'notif-2',
    toStaffId:   'staff-5',
    fromStaffId: 'staff-2',
    type: 'schedule_change',
    subject: 'Schedule Update — Friday Evening',
    body: 'Your Friday evening shift has been moved to 4:00 PM start. Please confirm receipt.',
    isRead: false,
    createdAt: '2026-07-02T14:30:00Z',
  },
  {
    id: 'notif-3',
    toStaffId:   'staff-2',
    fromStaffId: 'staff-3',
    type: 'approval_request',
    subject: 'Menu Change Request — Chicken Substitution',
    body: 'Requesting approval to substitute baked chicken breast for pork tenderloin on Thursday dinner due to delivery shortage.',
    linkedId: 'approval-1',
    linkedType: 'approval',
    isRead: false,
    createdAt: '2026-07-03T07:15:00Z',
  },
]

// ── Store ─────────────────────────────────────────────────────────────────────
interface NotificationsState {
  notifications: Notification[]
  isLoading: boolean

  fetch: () => Promise<void>

  /** Returns only the notifications for a specific staff member */
  getForStaff: (staffId: string) => Notification[]

  /** Unread count for a staff member */
  unreadCount: (staffId: string) => number

  markRead:   (id: string) => void
  markAllRead: (staffId: string) => void

  addNotification: (notif: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => void

  /** Send to multiple recipients at once */
  broadcast: (
    fromStaffId: string,
    toStaffIds: string[],
    type: NotificationType,
    subject: string,
    body: string,
    linkedId?: string
  ) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: false,

  fetch: async () => {
    set({ isLoading: true })
    await new Promise(r => setTimeout(r, 80))
    set({ notifications: SEED_NOTIFICATIONS, isLoading: false })
  },

  getForStaff: (staffId) =>
    get().notifications
      .filter(n => n.toStaffId === staffId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  unreadCount: (staffId) =>
    get().notifications.filter(n => n.toStaffId === staffId && !n.isRead).length,

  markRead: (id) =>
    set(s => ({
      notifications: s.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ),
    })),

  markAllRead: (staffId) =>
    set(s => ({
      notifications: s.notifications.map(n =>
        n.toStaffId === staffId ? { ...n, isRead: true } : n
      ),
    })),

  addNotification: (notif) => {
    const full: Notification = {
      ...notif,
      id: `notif-${Math.random().toString(36).slice(2, 8)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    set(s => ({ notifications: [full, ...s.notifications] }))
  },

  broadcast: (fromStaffId, toStaffIds, type, subject, body, linkedId) => {
    const now = new Date().toISOString()
    const newNotifs: Notification[] = toStaffIds.map(toStaffId => ({
      id: `notif-${Math.random().toString(36).slice(2, 8)}`,
      toStaffId,
      fromStaffId,
      type,
      subject,
      body,
      linkedId,
      isRead: false,
      createdAt: now,
    }))
    set(s => ({ notifications: [...newNotifs, ...s.notifications] }))
  },
}))
