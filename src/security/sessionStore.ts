/**
 * ============================================================
 * SESSION STORE — Active Session Tracker
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(iii) — Automatic logoff
 * SOC 2 CC6.1 — Logical access — session management
 *
 * Tracks all active sessions so the admin panel can:
 *   - See who is currently logged in
 *   - See last activity time per session
 *   - Remotely terminate a session
 *
 * Sessions are stored in plain localStorage (sl_active_sessions)
 * because they contain no PHI — only user ID, name, role, and timestamps.
 * ============================================================
 */

import { ls, LS_KEYS } from '../lib/localStorage'
import type { AuthUser } from './AuthContext'

export interface ActiveSession {
  id: string          // crypto.randomUUID()
  userId: string
  userName: string
  role: string
  startedAt: string   // ISO
  lastActivity: string // ISO
  userAgent: string
  terminated: boolean
}

function load(): ActiveSession[] {
  return ls.get(LS_KEYS.activeSessions, [])
}

function save(sessions: ActiveSession[]): void {
  // Keep only last 200 sessions to bound storage
  const trimmed = sessions.slice(-200)
  ls.set(LS_KEYS.activeSessions, trimmed)
}

/**
 * Start a new session on login. Returns the session ID.
 */
function startSession(user: AuthUser): string {
  const id = crypto.randomUUID()
  const session: ActiveSession = {
    id,
    userId: user.id,
    userName: user.name,
    role: user.role,
    startedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    userAgent: navigator.userAgent,
    terminated: false,
  }
  const sessions = load()
  sessions.push(session)
  save(sessions)
  return id
}

/**
 * Update lastActivity timestamp on user interaction.
 */
function touchSession(sessionId: string): void {
  const sessions = load().map(s =>
    s.id === sessionId ? { ...s, lastActivity: new Date().toISOString() } : s
  )
  save(sessions)
}

/**
 * Mark a session as ended (logout, timeout, or admin termination).
 */
function endSession(sessionId: string): void {
  const sessions = load().map(s =>
    s.id === sessionId ? { ...s, terminated: true, lastActivity: new Date().toISOString() } : s
  )
  save(sessions)
}

/**
 * Get all active (non-terminated) sessions.
 */
function getActiveSessions(): ActiveSession[] {
  return load().filter(s => !s.terminated)
}

/**
 * Get full session history (for admin audit view).
 */
function getAllSessions(): ActiveSession[] {
  return [...load()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
}

/**
 * Admin: terminate a specific session remotely.
 * The terminated flag is checked by AuthProvider on activity.
 */
function terminateSession(sessionId: string): void {
  endSession(sessionId)
}

/**
 * Check if a given session has been remotely terminated.
 * Called periodically by AuthProvider to enforce remote logoff.
 */
function isSessionTerminated(sessionId: string): boolean {
  const session = load().find(s => s.id === sessionId)
  return session ? session.terminated : true
}

export const sessionStore = {
  startSession,
  touchSession,
  endSession,
  getActiveSessions,
  getAllSessions,
  terminateSession,
  isSessionTerminated,
}
