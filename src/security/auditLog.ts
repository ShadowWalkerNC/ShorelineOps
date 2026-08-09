/**
 * Audit logging utility — HIPAA requires audit logs for all PHI access.
 * Events are shipped with the authenticated JWT; server ignores client userId.
 */
import { api } from '../api/client'
import { tokenManager } from './tokenManager'

export type AuditAction =
  | 'VIEW_RESIDENT'
  | 'EDIT_RESIDENT'
  | 'RESIDENT_UPDATE'
  | 'CREATE_RESIDENT'
  | 'DELETE_RESIDENT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'SESSION_TIMEOUT'
  | 'EXPORT_DATA'
  | 'ACCESS_DENIED'

export interface AuditEvent {
  action: AuditAction
  userId?: string
  resourceId?: string
  resourceType?: string
  timestamp: string
  ipAddress?: string
  userAgent: string
  outcome: 'success' | 'failure'
  details?: Record<string, unknown>
}

async function postAuditEvent(event: AuditEvent): Promise<void> {
  // Audit route requires auth — only ship when we have a token
  if (!tokenManager.getAccessToken() && !tokenManager.hasRefreshToken()) {
    if (import.meta.env.DEV) {
      console.info('[AuditLog] skipped (unauthenticated):', event.action)
    }
    return
  }

  try {
    await api.post('/audit', {
      action: event.action,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      outcome: event.outcome,
      userAgent: event.userAgent,
      details: event.details,
    })
  } catch {
    console.error('[AuditLog] Failed to ship event:', event.action)
  }
}

export function auditLog(
  action: AuditAction,
  options: Partial<Omit<AuditEvent, 'action' | 'timestamp' | 'userAgent'>> = {}
): void {
  const event: AuditEvent = {
    action,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    outcome: options.outcome ?? 'success',
    ...options,
  }

  if (import.meta.env.DEV) {
    console.info('[AuditLog]', event)
  }

  void postAuditEvent(event)
}
