import type { Pool } from 'pg'
import type { Queryable } from '../db/pool'
import { newToken, sha256hex } from './tokens'

export const SESSION_COOKIE = 'control_session'
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000

export interface SessionInfo {
  sessionId: string
  accountId: string
  email: string
  verified: boolean
}

export async function createSession(
  pool: Queryable,
  accountId: string,
  ip: string | null,
  userAgent: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await pool.query(
    'INSERT INTO account_sessions (account_id, session_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)',
    [accountId, sha256hex(token), expiresAt, ip?.slice(0, 100) ?? null, userAgent?.slice(0, 300) ?? null]
  )
  return { token, expiresAt }
}

export async function getSessionAccount(pool: Pool, token: string): Promise<SessionInfo | null> {
  if (!token) return null
  const { rows } = await pool.query(
    `SELECT s.id AS sid, s.account_id, a.email, a.email_verified_at
     FROM account_sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.session_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [sha256hex(token)]
  )
  if (!rows.length) return null
  const r = rows[0] as { sid: string; account_id: string; email: string; email_verified_at: string | null }
  await pool.query('UPDATE account_sessions SET last_seen_at = now() WHERE id = $1', [r.sid])
  return { sessionId: r.sid, accountId: r.account_id, email: r.email, verified: r.email_verified_at !== null }
}

export async function revokeSession(pool: Pool, token: string): Promise<void> {
  if (!token) return
  await pool.query('UPDATE account_sessions SET revoked_at = now() WHERE session_hash = $1', [sha256hex(token)])
}

export async function revokeAllSessions(pool: Pool, accountId: string): Promise<void> {
  await pool.query('UPDATE account_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL', [
    accountId,
  ])
}

export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`
}

export function readSessionCookie(req: { headers: { cookie?: string } }): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    if (part.slice(0, idx).trim() === SESSION_COOKIE) return part.slice(idx + 1).trim()
  }
  return null
}
