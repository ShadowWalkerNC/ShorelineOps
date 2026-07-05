/**
 * ============================================================
 * AUDIT LOG — Immutable, HMAC-Signed, Local Append-Only Log
 * ============================================================
 * HIPAA Security Rule §164.312(b) — Audit Controls
 * HITECH Act — Enhanced audit requirements
 * SOC 2 CC7.2 — Anomaly and incident detection
 * NIST SP 800-92 — Log management
 *
 * Design:
 *   - Stored under sl_audit_log in plain localStorage (NOT PHI-encrypted)
 *     so logs remain readable for breach investigation even if the
 *     facility passphrase is lost or changed.
 *   - Each entry is HMAC-SHA256 signed with a stable HMAC key derived
 *     from a separate secret (sl_audit_hmac_key) to detect tampering.
 *   - Entries are append-only — no update or delete methods exposed.
 *   - Retention: entries older than 6 years are pruned on write
 *     (HIPAA requires 6-year retention of security documentation).
 *   - verifyAuditLog() checks every HMAC — returns list of tampered entry IDs.
 * ============================================================
 */

const AUDIT_KEY      = 'sl_audit_log'
const HMAC_SECRET_KEY = 'sl_audit_hmac_key'
const SIX_YEARS_MS   = 6 * 365.25 * 24 * 60 * 60 * 1000

// ── Action catalogue ─────────────────────────────────────────────────────────
// Typed as a wide union so stores and components can use string literals
// without casting. All values are lowercase-dotted (store actions) or
// SCREAMING_SNAKE (AuthContext / session actions).

export type AuditAction =
  // ─ Auth / session ─────────────────────────────────────────────────────────
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'SESSION_TIMEOUT'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_CHANGE_FAILED'
  | 'PASSWORD_EXPIRED'
  | 'KEY_INITIALIZED'
  | 'KEY_CLEARED'
  | 'EMERGENCY_ACCESS_GRANTED'
  | 'EMERGENCY_ACCESS_USED'
  | 'EMERGENCY_ACCESS_REVOKED'
  // ─ User management (admin panel) ──────────────────────────────────────────
  | 'user.create'
  | 'user.role_change'
  | 'user.lock'
  | 'user.unlock'
  | 'user.force_reset'
  | 'user.password_reset'
  // ─ Residents (PHI) ────────────────────────────────────────────────────────
  | 'resident.create'
  | 'resident.update'
  | 'resident.delete'
  | 'VIEW_RESIDENT'
  | 'EXPORT_RESIDENTS'
  // ─ Staff ──────────────────────────────────────────────────────────────────
  | 'staff.profile.create'
  | 'staff.profile.update'
  | 'staff.profile.delete'
  | 'staff.callout.create'
  | 'staff.callout.update'
  | 'staff.callout.delete'
  | 'VIEW_STAFF'
  // ─ Timecard ───────────────────────────────────────────────────────────────
  | 'CLOCK_IN'
  | 'CLOCK_OUT'
  | 'VIEW_TIMECARD'
  | 'EXPORT_TIMECARD'
  // ─ Budget ─────────────────────────────────────────────────────────────────
  | 'VIEW_BUDGET'
  | 'CREATE_BUDGET_ENTRY'
  | 'UPDATE_BUDGET_ENTRY'
  | 'DELETE_BUDGET_ENTRY'
  | 'EXPORT_BUDGET'
  // ─ Communications ─────────────────────────────────────────────────────────
  | 'VIEW_THREAD'
  | 'CREATE_THREAD'
  | 'UPDATE_THREAD'
  | 'DELETE_THREAD'
  | 'comms.thread.create'
  | 'comms.thread.addEntry'
  | 'comms.thread.update'
  | 'comms.thread.delete'
  | 'comms.approval.create'
  | 'comms.approval.approved'
  | 'comms.approval.rejected'
  | 'comms.approval.withdraw'
  // ─ Inventory ──────────────────────────────────────────────────────────────
  | 'VIEW_INVENTORY'
  | 'UPDATE_INVENTORY'
  // ─ Menu / Production ──────────────────────────────────────────────────────
  | 'VIEW_MENU'
  | 'UPDATE_MENU'
  // ─ Admin / Compliance / Setup ─────────────────────────────────────────────
  | 'ACCESS_DENIED'
  | 'SETTINGS_CHANGED'
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'BREACH_RECORDED'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'COMPLIANCE_ACKNOWLEDGED'
  | 'SETUP_COMPLETED'

export interface AuditEntry {
  id: string
  action: AuditAction
  userId: string | null
  userName: string | null
  resourceId?: string
  resourceType?: string
  timestamp: string
  userAgent: string
  outcome: 'success' | 'failure'
  details?: Record<string, unknown>
  /** HMAC-SHA256 of the entry content (excluding this field) */
  hmac: string
}

// ── HMAC helpers ──────────────────────────────────────────────────────────────

async function getOrCreateHmacKey(): Promise<CryptoKey> {
  let raw = localStorage.getItem(HMAC_SECRET_KEY)
  if (!raw) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    raw = btoa(String.fromCharCode(...bytes))
    localStorage.setItem(HMAC_SECRET_KEY, raw)
  }
  const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function signEntry(entry: Omit<AuditEntry, 'hmac'>): Promise<string> {
  const key = await getOrCreateHmacKey()
  const data = new TextEncoder().encode(JSON.stringify(entry))
  const sig = await crypto.subtle.sign('HMAC', key, data)
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

async function verifyEntry(entry: AuditEntry): Promise<boolean> {
  const { hmac, ...rest } = entry
  const key = await getOrCreateHmacKey()
  const data = new TextEncoder().encode(JSON.stringify(rest))
  const sigBytes = Uint8Array.from(atob(hmac), c => c.charCodeAt(0))
  return crypto.subtle.verify('HMAC', key, sigBytes, data)
}

// ── Core log operations ───────────────────────────────────────────────────────

function loadRaw(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY)
    return raw ? (JSON.parse(raw) as AuditEntry[]) : []
  } catch {
    return []
  }
}

function pruneOld(entries: AuditEntry[]): AuditEntry[] {
  const cutoff = Date.now() - SIX_YEARS_MS
  return entries.filter(e => new Date(e.timestamp).getTime() >= cutoff)
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Append a new audit event. Fire-and-forget from callers.
 * Never throws — audit failure must not block UI.
 */
export async function auditLog(
  action: AuditAction,
  options: {
    userId?: string | null
    userName?: string | null
    resourceId?: string
    resourceType?: string
    outcome?: 'success' | 'failure'
    details?: Record<string, unknown>
  } = {}
): Promise<void> {
  try {
    const base: Omit<AuditEntry, 'hmac'> = {
      id: crypto.randomUUID(),
      action,
      userId: options.userId ?? null,
      userName: options.userName ?? null,
      resourceId: options.resourceId,
      resourceType: options.resourceType,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      outcome: options.outcome ?? 'success',
      details: options.details,
    }
    const hmac = await signEntry(base)
    const entry: AuditEntry = { ...base, hmac }
    const entries = pruneOld(loadRaw())
    entries.push(entry)
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries))
    if (import.meta.env.DEV) {
      console.info('[AuditLog]', action, entry.outcome, entry.userId)
    }
  } catch (err) {
    console.error('[AuditLog] Failed to write entry:', err)
  }
}

/**
 * Flat-object variant used by stores and admin components.
 * Fire-and-forget (no await needed at call sites).
 */
export function writeAudit(params: {
  action: AuditAction
  userId?: string | null
  userName?: string | null
  resourceType?: string
  resourceId?: string
  outcome?: 'success' | 'failure'
  details?: Record<string, unknown>
}): void {
  void auditLog(params.action, {
    userId:       params.userId,
    userName:     params.userName,
    resourceType: params.resourceType,
    resourceId:   params.resourceId,
    outcome:      params.outcome ?? 'success',
    details:      params.details,
  })
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Read all audit entries (admin viewer).
 * Returns entries sorted newest-first.
 */
export function readAuditLog(): AuditEntry[] {
  return [...loadRaw()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

/**
 * Verify integrity of every entry in the log.
 * Returns array of entry IDs that failed HMAC verification (tampered).
 */
export async function verifyAuditLog(): Promise<string[]> {
  const entries = loadRaw()
  const tampered: string[] = []
  for (const entry of entries) {
    const valid = await verifyEntry(entry)
    if (!valid) tampered.push(entry.id)
  }
  return tampered
}

/**
 * Export audit log as a JSON string for download.
 * Includes tamper-verification results.
 */
export async function exportAuditLog(): Promise<string> {
  const entries = loadRaw()
  const tampered = await verifyAuditLog()
  return JSON.stringify(
    {
      exportedAt:      new Date().toISOString(),
      totalEntries:    entries.length,
      tamperedEntries: tampered,
      integrityStatus: tampered.length === 0 ? 'VERIFIED' : 'COMPROMISED',
      entries,
    },
    null,
    2
  )
}
