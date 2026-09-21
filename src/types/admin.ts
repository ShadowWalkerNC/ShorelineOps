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
  facilityId: string
  platformAdmin: boolean
  temporaryPassword?: string
}

export interface FacilityAccount {
  id: string
  name: string
  facilityType: string
  primaryContactEmail: string
  betaStatus: 'onboarding' | 'beta' | 'paused' | 'graduated'
  planTier: 'community' | 'pro' | 'enterprise' | 'beta'
  active: boolean
  initialized: boolean
  userCount: number
  createdAt: string
}

export interface OnboardingStatus {
  facilityId: string
  facilityName: string
  complete: boolean
  steps: Array<{ id: string; label: string; complete: boolean }>
  nextAction: string | null
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

export type KitchenServiceMode = 'dining-room' | 'room-service-only' | 'hybrid'

export interface SystemSettings {
  facilityName: string
  timezone: string
  sessionTimeoutMinutes: number
  mfaRequired: boolean
  allowReadonlyExport: boolean
  maintenanceMode: boolean
  kitchenServiceMode: KitchenServiceMode
}
