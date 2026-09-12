import type { AdminUser, AuditLogEntry, SystemSettings } from '../types/admin'
import type { UserRole } from '../security/AuthContext'
import { tokenManager } from '../security/tokenManager'
import type {
  FacilityProfile,
  OperationsConfig,
  IntegrationsConfig,
  SecurityConfig,
} from '../state/settingsStore'

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

// ── Facility settings (C04: server-synced, localStorage as offline cache) ──

export interface FacilitySettingsPayload {
  facilityId: string
  settings: {
    facility: FacilityProfile
    operations: OperationsConfig
    integrations: IntegrationsConfig
    security: SecurityConfig
  }
  meta: Record<string, { updatedBy: string | null; updatedAt: string | null }>
}

export type FacilitySettingsUpdate = {
  facility?: Partial<FacilityProfile>
  operations?: Partial<OperationsConfig>
  integrations?: Partial<IntegrationsConfig>
  security?: Partial<SecurityConfig>
}

async function settingsReq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenManager.getAccessToken() ?? ''}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) throw new Error('Not signed in. Sign in again to sync facility settings.')
  if (res.status === 403)
    throw new Error('Only managers or admins can change facility settings.')
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).error ?? '' } catch { /* ignore */ }
    throw new Error(detail ? `${method} ${path} → ${res.status}: ${detail}` : `${method} ${path} → ${res.status}`)
  }
  return res.json()
}

export const settingsApi = {
  getFacilitySettings: () =>
    settingsReq<FacilitySettingsPayload>('GET', '/admin/facility-settings'),
  updateFacilitySettings: (data: FacilitySettingsUpdate) =>
    settingsReq<FacilitySettingsPayload>('PUT', '/admin/facility-settings', data),
}
