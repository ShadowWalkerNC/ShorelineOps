import { create } from 'zustand'
import { adminApi } from '../api/admin'
import type { AdminUser, AuditLogEntry, SystemSettings } from '../types/admin'
import type { UserRole } from '../security/AuthContext'

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

export const useAdminStore = create<AdminState>((set, get) => ({
  users: [],
  auditEntries: [],
  settings: null,
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null })
    try {
      const users = await adminApi.listUsers()
      set({ users })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ loading: false })
    }
  },

  createUser: async (data) => {
    const user = await adminApi.createUser(data)
    set(s => ({ users: [...s.users, user] }))
  },

  updateUserRole: async (id, role) => {
    const updated = await adminApi.updateUserRole(id, role)
    set(s => ({ users: s.users.map(u => u.id === id ? updated : u) }))
  },

  toggleUserActive: async (id, active) => {
    const updated = active
      ? await adminApi.reactivateUser(id)
      : await adminApi.deactivateUser(id)
    set(s => ({ users: s.users.map(u => u.id === id ? updated : u) }))
  },

  fetchAuditLog: async (params) => {
    set({ loading: true, error: null })
    try {
      const auditEntries = await adminApi.getAuditLog(params)
      set({ auditEntries })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ loading: false })
    }
  },

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      const settings = await adminApi.getSettings()
      set({ settings })
    } catch (e) {
      set({ error: String(e) })
    } finally {
      set({ loading: false })
    }
  },

  saveSettings: async (data) => {
    const settings = await adminApi.updateSettings(data)
    set({ settings })
  },
}))
