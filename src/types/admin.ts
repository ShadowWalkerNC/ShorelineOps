import type { UserRole } from '../security/AuthContext'
import type { AuditAction } from '../security/auditLog'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface AuditLogEntry {
  id: string
  action: AuditAction
  userId?: string
  userName?: string
  resourceId?: string
  resourceType?: string
  timestamp: string
  outcome: 'success' | 'failure'
  ipAddress?: string
  details?: Record<string, unknown>
}

export interface SystemSettings {
  facilityName: string
  timezone: string
  sessionTimeoutMinutes: number
  mfaRequired: boolean
  allowReadonlyExport: boolean
  maintenanceMode: boolean
}
