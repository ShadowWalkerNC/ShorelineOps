/**
 * Audit logging utility — HIPAA requires audit logs for all PHI access.
 * SOC 2 CC7.2 / ISO 27002 8.15 require tamper-evident logging.
 *
 * In production these events POST to the backend which writes to an
 * immutable append-only log store (e.g. AWS CloudTrail, Datadog).
 */

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
  ipAddress?: string  // populated server-side
  userAgent: string
  outcome: 'success' | 'failure'
  details?: Record<string, unknown>
}

async function postAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    // Fail open — never block UI due to audit log failure,
    // but do log to console so it's visible in monitoring.
    console.error('[AuditLog] Failed to ship event:', event)
  }
}

export function auditLog(
  action: AuditAction,
  options: Partial<Omit<AuditEvent, 'action' | 'timestamp' | 'userAgent'>> = {}
): void {
  const event: AuditEvent = {
    action,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    outcome: options.outcome ?? 'success',
    ...options,
  }

  // Always log to console in dev for visibility
  if (import.meta.env.DEV) {
    console.info('[AuditLog]', event)
  }

  // Ship to backend in all environments
  void postAuditEvent(event)
}
