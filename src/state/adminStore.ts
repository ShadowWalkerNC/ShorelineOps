/**
 * Admin store — DEMO MODE
 * All data lives in memory. Changes persist for the session but reset on reload.
 */
import { create } from 'zustand'
import type { AdminUser, AuditLogEntry, SystemSettings } from '../types/admin'
import type { UserRole } from '../security/AuthContext'
import { SEED_ADMIN_USERS, SEED_AUDIT_LOG, SEED_SETTINGS, isDemoSeedAllowed, uid, now } from '@/demo/seed'

// B14 demo-honesty: fictional admin users, audit entries, and facility settings
// load only in dev/demo mode. Production boots with empty stores (fail closed).
const seedAllowed = isDemoSeedAllowed()

let _users: AdminUser[]         = seedAllowed ? JSON.parse(JSON.stringify(SEED_ADMIN_USERS)) : []
let _audit: AuditLogEntry[]     = seedAllowed ? JSON.parse(JSON.stringify(SEED_AUDIT_LOG)) : []
let _settings: SystemSettings   = seedAllowed ? JSON.parse(JSON.stringify(SEED_SETTINGS)) : null as unknown as SystemSettings

interface AdminState {
  users: AdminUser[]
  auditEntries: AuditLogEntry[]
  settings: SystemSettings | null
  loading: boolean
  error: string | null
  fetchUsers: () => Promise<void>
  createUser: (data: { name: string; email: string; role: UserRole }) => Promise<void>
  updateUserRole: (id: string, role: UserRole) => Promise<void>
  toggleUserActive: (id: string, active: boolean) => Promise<void>
  fetchAuditLog: (params?: { limit?: number; offset?: number; userId?: string }) => Promise<void>
  fetchSettings: () => Promise<void>
  saveSettings: (data: Partial<SystemSettings>) => Promise<void>
}

export const useAdminStore = create<AdminState>((set) => ({
  users: [],
  auditEntries: [],
  settings: null,
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 150))
    set({ users: [..._users], loading: false })
  },

  createUser: async (data) => {
    const user: AdminUser = { ...data, id: uid(), active: true, createdAt: now(), lastLoginAt: null }
    _users = [..._users, user]
    set({ users: [..._users] })
  },

  updateUserRole: async (id, role) => {
    _users = _users.map(u => u.id === id ? { ...u, role } : u)
    set({ users: [..._users] })
  },

  toggleUserActive: async (id, active) => {
    _users = _users.map(u => u.id === id ? { ...u, active } : u)
    set({ users: [..._users] })
  },

  fetchAuditLog: async (params) => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 150))
    let entries = [..._audit]
    if (params?.userId) entries = entries.filter(e => e.userId === params.userId)
    if (params?.limit)  entries = entries.slice(params.offset ?? 0, (params.offset ?? 0) + params.limit)
    set({ auditEntries: entries, loading: false })
  },

  fetchSettings: async () => {
    set({ loading: true, error: null })
    await new Promise(r => setTimeout(r, 100))
    set({ settings: { ..._settings }, loading: false })
  },

  saveSettings: async (data) => {
    _settings = { ..._settings, ...data }
    set({ settings: { ..._settings } })
  },
}))
