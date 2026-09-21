/**
 * Admin store — DEMO MODE
 * All data lives in memory. Changes persist for the session but reset on reload.
 */
import { create } from 'zustand'
import type { AdminUser, AuditLogEntry, SystemSettings } from '../types/admin'
import type { UserRole } from '../security/AuthContext'
import { SEED_ADMIN_USERS, SEED_AUDIT_LOG, SEED_SETTINGS, isDemoSeedAllowed, uid, now } from '@/demo/seed'
import { adminApi } from '../api/admin'

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
  temporaryPassword: string | null
  clearTemporaryPassword: () => void
  fetchUsers: () => Promise<void>
  createUser: (data: { name: string; email: string; role: UserRole; facilityId?: string }) => Promise<void>
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
  temporaryPassword: null,
  clearTemporaryPassword: () => set({ temporaryPassword: null }),

  fetchUsers: async () => {
    set({ loading: true, error: null })
    try {
      if (seedAllowed) {
        await new Promise(r => setTimeout(r, 150))
        set({ users: [..._users], loading: false })
      } else {
        set({ users: await adminApi.listUsers(), loading: false })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load users.', loading: false })
    }
  },

  createUser: async (data) => {
    try {
      if (seedAllowed) {
        const user: AdminUser = { ...data, id: uid(), active: true, createdAt: now(), lastLoginAt: null, facilityId: 'demo', platformAdmin: false, temporaryPassword: 'DemoOnly-Password1!' }
        _users = [..._users, user]
        set({ users: [..._users], temporaryPassword: user.temporaryPassword ?? null, error: null })
      } else {
        const user = await adminApi.createUser(data)
        set(state => ({ users: [...state.users, user], temporaryPassword: user.temporaryPassword ?? null, error: null }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create user.'
      set({ error: message })
      throw error
    }
  },

  updateUserRole: async (id, role) => {
    try {
      if (seedAllowed) {
        _users = _users.map(u => u.id === id ? { ...u, role } : u)
        set({ users: [..._users], error: null })
      } else {
        const updated = await adminApi.updateUserRole(id, role)
        set(state => ({ users: state.users.map(u => u.id === id ? updated : u), error: null }))
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to update role.' })
    }
  },

  toggleUserActive: async (id, active) => {
    try {
      if (seedAllowed) {
        _users = _users.map(u => u.id === id ? { ...u, active } : u)
        set({ users: [..._users], error: null })
      } else {
        const updated = active ? await adminApi.reactivateUser(id) : await adminApi.deactivateUser(id)
        set(state => ({ users: state.users.map(u => u.id === id ? updated : u), error: null }))
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to update account.' })
    }
  },

  fetchAuditLog: async (params) => {
    set({ loading: true, error: null })
    try {
      if (seedAllowed) {
        await new Promise(r => setTimeout(r, 150))
        let entries = [..._audit]
        if (params?.userId) entries = entries.filter(e => e.userId === params.userId)
        if (params?.limit) entries = entries.slice(params.offset ?? 0, (params.offset ?? 0) + params.limit)
        set({ auditEntries: entries, loading: false })
      } else {
        set({ auditEntries: await adminApi.getAuditLog(params), loading: false })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load audit log.', loading: false })
    }
  },

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      if (seedAllowed) {
        await new Promise(r => setTimeout(r, 100))
        set({ settings: { ..._settings }, loading: false })
      } else {
        set({ settings: await adminApi.getSettings(), loading: false })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to load settings.', loading: false })
    }
  },

  saveSettings: async (data) => {
    try {
      if (seedAllowed) {
        _settings = { ..._settings, ...data }
        set({ settings: { ..._settings }, error: null })
      } else {
        set({ settings: await adminApi.updateSettings(data), error: null })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save settings.'
      set({ error: message })
      throw error
    }
  },
}))
