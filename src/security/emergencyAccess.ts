/**
 * ============================================================
 * EMERGENCY ACCESS — Break-Glass Procedure
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(ii) — Emergency access procedure
 * SOC 2 CC6.1 — Logical access controls — emergency provisions
 *
 * Allows an admin to grant a user temporary elevated access
 * when normal access controls prevent urgent care delivery.
 *
 * Rules:
 *   - Only admin role can grant emergency access
 *   - Access auto-expires in 1 hour — cannot be extended
 *   - Every grant is logged to the immutable audit log
 *   - Every use of elevated access is logged
 *   - Admin can revoke early
 *   - Full log viewable in admin compliance panel
 * ============================================================
 */

import { ls } from '../lib/localStorage'
import { auditLog } from './auditLog'

const EMERGENCY_KEY = 'sl_emergency_access'
const EXPIRY_MS = 60 * 60_000 // 1 hour

export interface EmergencyGrant {
  id: string
  targetUserId: string
  targetUserName: string
  grantedByUserId: string
  grantedByUserName: string
  reason: string
  grantedAt: string   // ISO
  expiresAt: string   // ISO
  revokedAt: string | null
  usageLog: string[]  // ISO timestamps of each use
}

function loadGrants(): EmergencyGrant[] {
  try {
    const raw = localStorage.getItem(EMERGENCY_KEY)
    return raw ? (JSON.parse(raw) as EmergencyGrant[]) : []
  } catch {
    return []
  }
}

function saveGrants(grants: EmergencyGrant[]): void {
  localStorage.setItem(EMERGENCY_KEY, JSON.stringify(grants))
}

/**
 * Grant emergency access to a user.
 * Only callable by admin — caller must verify role before calling.
 */
export async function grantEmergencyAccess(
  targetUserId: string,
  targetUserName: string,
  grantedByUserId: string,
  grantedByUserName: string,
  reason: string
): Promise<EmergencyGrant> {
  const now = new Date()
  const grant: EmergencyGrant = {
    id: crypto.randomUUID(),
    targetUserId,
    targetUserName,
    grantedByUserId,
    grantedByUserName,
    reason,
    grantedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPIRY_MS).toISOString(),
    revokedAt: null,
    usageLog: [],
  }
  const grants = loadGrants()
  grants.push(grant)
  saveGrants(grants)
  await auditLog('EMERGENCY_ACCESS_GRANTED', {
    userId: grantedByUserId,
    userName: grantedByUserName,
    resourceId: targetUserId,
    resourceType: 'user',
    outcome: 'success',
    details: { targetUserName, reason, expiresAt: grant.expiresAt },
  })
  return grant
}

/**
 * Check if a user currently has active emergency access.
 * Also logs usage if grant is active.
 */
export async function checkEmergencyAccess(
  userId: string,
  userName: string
): Promise<EmergencyGrant | null> {
  const grants = loadGrants()
  const active = grants.find(
    g =>
      g.targetUserId === userId &&
      !g.revokedAt &&
      new Date(g.expiresAt).getTime() > Date.now()
  )
  if (!active) return null
  // Log usage
  const updated = grants.map(g =>
    g.id === active.id
      ? { ...g, usageLog: [...g.usageLog, new Date().toISOString()] }
      : g
  )
  saveGrants(updated)
  await auditLog('EMERGENCY_ACCESS_USED', {
    userId,
    userName,
    outcome: 'success',
    details: { grantId: active.id, grantedBy: active.grantedByUserName, reason: active.reason },
  })
  return active
}

/**
 * Revoke an active emergency access grant early.
 */
export async function revokeEmergencyAccess(
  targetUserId: string,
  revokedByUserId: string,
  revokedByUserName: string
): Promise<void> {
  const grants = loadGrants().map(g =>
    g.targetUserId === targetUserId && !g.revokedAt
      ? { ...g, revokedAt: new Date().toISOString() }
      : g
  )
  saveGrants(grants)
  await auditLog('EMERGENCY_ACCESS_REVOKED', {
    userId: revokedByUserId,
    userName: revokedByUserName,
    resourceId: targetUserId,
    resourceType: 'user',
    outcome: 'success',
    details: { action: 'emergency_access_revoked' },
  })
}

/**
 * Get full emergency access log for admin compliance panel.
 */
export function getEmergencyAccessLog(): EmergencyGrant[] {
  return [...loadGrants()].sort(
    (a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime()
  )
}
