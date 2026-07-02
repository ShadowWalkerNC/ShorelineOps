import type { AdminUser, AuditLogEntry, SystemSettings } from '../types/admin'
import type { UserRole } from '../security/AuthContext'
import { tokenManager } from '../security/tokenManager'

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokenManager.getAccessToken()}`,
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  return res.json()
}

export const adminApi = {
  // Users
  listUsers: () => req<AdminUser[]>('GET', '/admin/users'),
  createUser: (data: { name: string; email: string; role: UserRole }) =>
    req<AdminUser>('POST', '/admin/users', data),
  updateUserRole: (id: string, role: UserRole) =>
    req<AdminUser>('PATCH', `/admin/users/${id}`, { role }),
  deactivateUser: (id: string) =>
    req<AdminUser>('PATCH', `/admin/users/${id}`, { active: false }),
  reactivateUser: (id: string) =>
    req<AdminUser>('PATCH', `/admin/users/${id}`, { active: true }),

  // Audit log
  getAuditLog: (params?: { limit?: number; offset?: number; userId?: string }) => {
    const qs = new URLSearchParams()
    if (params?.limit)  qs.set('limit',  String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    if (params?.userId) qs.set('userId', params.userId)
    return req<AuditLogEntry[]>('GET', `/admin/audit?${qs}`)
  },

  // Settings
  getSettings: () => req<SystemSettings>('GET', '/admin/settings'),
  updateSettings: (data: Partial<SystemSettings>) =>
    req<SystemSettings>('PATCH', '/admin/settings', data),
}
