/**
 * ============================================================
 * AUTH CONTEXT — HIPAA-COMPLIANT LOCAL AUTHENTICATION
 * ============================================================
 * HIPAA Security Rule §164.312(a)(1) — Access control
 * HIPAA Security Rule §164.312(a)(2)(i) — Unique user identification
 * HIPAA Security Rule §164.312(d) — Person authentication
 * SOC 2 CC6.1 — Logical access controls
 *
 * All users are stored in encrypted localStorage (sl_users).
 * No hardcoded credentials. No Supabase. No network calls.
 *
 * Login flow:
 *   1. Look up user by email in sl_users store
 *   2. Check account lock status
 *   3. verifyPassword() — PBKDF2-SHA256
 *   4. On success: keyManager.initKey(passphrase), start session
 *   5. On failure: increment failedAttempts, lock at 5
 *   6. Check password expiry — force reset if expired
 * ============================================================
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import type { UserRole, Permission } from '../types/roles'
import { ROLE_PERMISSIONS, ROLE_RANK, hasPermission } from '../types/roles'
import { keyManager } from '../lib/keyManager'
import { ls, LS_KEYS } from '../lib/localStorage'
import { auditLog } from './auditLog'
import { verifyPassword } from './passwordPolicy'
import { checkPasswordExpiry } from './passwordPolicy'
import { sessionStore } from './sessionStore'

export type { UserRole }

// ── Types ───────────────────────────────────────────────────────────────

export interface AppUser {
  id: string               // crypto.randomUUID() — unique, immutable
  name: string
  email: string
  role: UserRole
  mfaVerified: boolean
  passwordHash: string     // PBKDF2 hash string "<salt>:<hash>"
  passwordHistory: string[]// last 10 hashes
  passwordSetAt: string    // ISO timestamp
  failedAttempts: number
  lockedAt: string | null  // ISO timestamp if locked, else null
  lastLoginAt: string | null
  createdAt: string
  forcePasswordReset: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  passwordExpiry: { shouldWarn: boolean; daysUntilExpiry: number } | null
  sessionWarning: boolean  // true when 2-min timeout warning is active
  login: (email: string, password: string) => Promise<void>
  logout: (reason?: string) => Promise<void>
  can: (permission: Permission) => boolean
  atLeast: (role: UserRole) => boolean
  dismissSessionWarning: () => void
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  mfaVerified: boolean
  forcePasswordReset: boolean
}

const SESSION_KEY = 'sl_session_user'
const MAX_FAILED_ATTEMPTS = 5
const SESSION_TIMEOUT_MS = (() => {
  const stored = localStorage.getItem('sl_session_timeout')
  const parsed = stored ? parseInt(stored, 10) : null
  if (parsed && parsed >= 5 * 60_000 && parsed <= 30 * 60_000) return parsed
  return 15 * 60_000 // default 15 minutes
})()
const WARN_BEFORE_MS = 2 * 60_000 // warn 2 minutes before timeout

// ── Context ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [passwordExpiry, setPasswordExpiry] = useState<{ shouldWarn: boolean; daysUntilExpiry: number } | null>(null)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // ── Session timeout ──────────────────────────────────────────

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warnRef.current) clearTimeout(warnRef.current)
    timeoutRef.current = null
    warnRef.current = null
  }, [])

  const handleTimeout = useCallback(async (currentUser: AuthUser) => {
    clearTimers()
    keyManager.clearKey()
    sessionStorage.removeItem(SESSION_KEY)
    if (sessionIdRef.current) sessionStore.endSession(sessionIdRef.current)
    await auditLog('SESSION_TIMEOUT', {
      userId: currentUser.id,
      userName: currentUser.name,
      outcome: 'success',
    })
    setUser(null)
    setSessionWarning(false)
    setPasswordExpiry(null)
  }, [clearTimers])

  const resetTimeout = useCallback((currentUser: AuthUser) => {
    clearTimers()
    setSessionWarning(false)
    warnRef.current = setTimeout(() => {
      setSessionWarning(true)
    }, SESSION_TIMEOUT_MS - WARN_BEFORE_MS)
    timeoutRef.current = setTimeout(() => {
      void handleTimeout(currentUser)
    }, SESSION_TIMEOUT_MS)
    if (sessionIdRef.current) sessionStore.touchSession(sessionIdRef.current)
  }, [clearTimers, handleTimeout])

  // Wire activity listeners when user is logged in
  useEffect(() => {
    if (!user) return
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    const handler = () => resetTimeout(user)
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    resetTimeout(user)
    return () => {
      events.forEach(e => window.removeEventListener(e, handler))
      clearTimers()
    }
  }, [user, resetTimeout, clearTimers])

  // ── Restore session on mount ───────────────────────────────

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        // Key is not in memory after page reload — user must re-enter passphrase
        // We keep the session record so UI can show the passphrase prompt
        // rather than a full re-login, but PHI is blocked until key is re-derived.
        setUser(parsed)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    const users: AppUser[] = ls.get(LS_KEYS.users, [])
    const match = users.find(u => u.email.toLowerCase() === email.toLowerCase())

    if (!match) {
      await auditLog('LOGIN_FAILED', { outcome: 'failure', details: { email, reason: 'user_not_found' } })
      throw new Error('Invalid email or password.')
    }

    if (match.lockedAt) {
      await auditLog('LOGIN_FAILED', {
        userId: match.id,
        userName: match.name,
        outcome: 'failure',
        details: { reason: 'account_locked' },
      })
      throw new Error('This account is locked. Please contact your administrator.')
    }

    const valid = await verifyPassword(password, match.passwordHash)
    if (!valid) {
      const newAttempts = match.failedAttempts + 1
      const locked = newAttempts >= MAX_FAILED_ATTEMPTS
      const updated = users.map(u =>
        u.id === match.id
          ? { ...u, failedAttempts: newAttempts, lockedAt: locked ? new Date().toISOString() : null }
          : u
      )
      ls.set(LS_KEYS.users, updated)
      if (locked) {
        await auditLog('ACCOUNT_LOCKED', {
          userId: match.id,
          userName: match.name,
          outcome: 'success',
          details: { reason: 'max_failed_attempts' },
        })
      }
      await auditLog('LOGIN_FAILED', {
        userId: match.id,
        userName: match.name,
        outcome: 'failure',
        details: { attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - newAttempts) },
      })
      throw new Error(
        locked
          ? 'This account has been locked due to too many failed login attempts.'
          : `Invalid email or password. ${Math.max(0, MAX_FAILED_ATTEMPTS - newAttempts)} attempt(s) remaining.`
      )
    }

    // Derive encryption key from password (password doubles as passphrase)
    await keyManager.initKey(password)
    await auditLog('KEY_INITIALIZED', { userId: match.id, userName: match.name, outcome: 'success' })

    // Check password expiry
    const expiry = checkPasswordExpiry(match.passwordSetAt)
    setPasswordExpiry({ shouldWarn: expiry.shouldWarn, daysUntilExpiry: expiry.daysUntilExpiry })

    // Reset failed attempts, update last login
    const updatedUsers = users.map(u =>
      u.id === match.id
        ? { ...u, failedAttempts: 0, lockedAt: null, lastLoginAt: new Date().toISOString() }
        : u
    )
    ls.set(LS_KEYS.users, updatedUsers)

    const authUser: AuthUser = {
      id: match.id,
      name: match.name,
      email: match.email,
      role: match.role,
      mfaVerified: match.mfaVerified,
      forcePasswordReset: expiry.expired || match.forcePasswordReset,
    }

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
    const sessionId = sessionStore.startSession(authUser)
    sessionIdRef.current = sessionId

    await auditLog('LOGIN', {
      userId: match.id,
      userName: match.name,
      outcome: 'success',
      details: { role: match.role },
    })

    setUser(authUser)
  }, [])

  // ── Logout ───────────────────────────────────────────────────────────────

  const logout = useCallback(async (reason = 'user_initiated') => {
    const currentUser = user
    clearTimers()
    keyManager.clearKey()
    sessionStorage.removeItem(SESSION_KEY)
    if (sessionIdRef.current) sessionStore.endSession(sessionIdRef.current)
    sessionIdRef.current = null
    if (currentUser) {
      await auditLog('LOGOUT', {
        userId: currentUser.id,
        userName: currentUser.name,
        outcome: 'success',
        details: { reason },
      })
      await auditLog('KEY_CLEARED', {
        userId: currentUser.id,
        userName: currentUser.name,
        outcome: 'success',
      })
    }
    setUser(null)
    setSessionWarning(false)
    setPasswordExpiry(null)
  }, [user, clearTimers])

  // ── Permission helpers ─────────────────────────────────────────────

  const can = useCallback((permission: Permission): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission)
  }, [user])

  const atLeast = useCallback((role: UserRole): boolean => {
    if (!user) return false
    return ROLE_RANK[user.role] >= ROLE_RANK[role]
  }, [user])

  const dismissSessionWarning = useCallback(() => {
    setSessionWarning(false)
    if (user) resetTimeout(user)
  }, [user, resetTimeout])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      passwordExpiry,
      sessionWarning,
      login,
      logout,
      can,
      atLeast,
      dismissSessionWarning,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ── Role guard components (unchanged API) ───────────────────────

export function RequireRole({
  role,
  children,
  fallback = null,
}: {
  role: UserRole
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { atLeast } = useAuth()
  if (!atLeast(role)) return <>{fallback}</>
  return <>{children}</>
}

export function RequirePermission({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { can } = useAuth()
  if (!can(permission)) return <>{fallback}</>
  return <>{children}</>
}

export type UserRoleType = UserRole
export { ROLE_PERMISSIONS }
