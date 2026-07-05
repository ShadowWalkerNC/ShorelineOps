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
 *
 * changePassword flow:
 *   1. Verify current password
 *   2. Validate new password not in history
 *   3. Hash new password, update sl_users
 *   4. Re-derive encryption key from new password
 *   5. Clear forcePasswordReset flag
 *   6. Update sessionStorage user record
 *
 * loginAsDemo (DEMO BUILDS ONLY):
 *   Bypasses all HIPAA checks — no password, no encryption key,
 *   no audit log. Sets a synthetic AuthUser directly into state.
 *   This method must never be called in local or web builds.
 *   The DemoBootstrap component is the only caller.
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
import { verifyPassword, hashPassword, checkPasswordExpiry } from './passwordPolicy'
import { sessionStore } from './sessionStore'
import { IS_DEMO } from '@/config/mode'

export type { UserRole }

// ── Types ────────────────────────────────────────────────────────────────────────

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

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  mfaVerified: boolean
  forcePasswordReset: boolean
}

/** Minimal shape accepted by loginAsDemo — no password fields needed. */
export interface DemoUser {
  id: string
  name: string
  email: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  forcePasswordReset: boolean
  passwordExpiry: { shouldWarn: boolean; daysUntilExpiry: number } | null
  sessionWarning: boolean
  login: (email: string, password: string) => Promise<void>
  /** Demo mode only. Bypasses all HIPAA checks and sets a synthetic user directly. */
  loginAsDemo: (demoUser: DemoUser) => void
  logout: (reason?: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  can: (permission: Permission) => boolean
  atLeast: (role: UserRole) => boolean
  dismissSessionWarning: () => void
}

const SESSION_KEY = 'sl_session_user'
const MAX_FAILED_ATTEMPTS = 5
const SESSION_TIMEOUT_MS = (() => {
  const stored = localStorage.getItem('sl_session_timeout')
  const parsed = stored ? parseInt(stored, 10) : null
  if (parsed && parsed >= 5 * 60_000 && parsed <= 30 * 60_000) return parsed
  return 15 * 60_000 // default 15 minutes
})()
const WARN_BEFORE_MS = 2 * 60_000

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState(false)
  const [passwordExpiry, setPasswordExpiry] = useState<{ shouldWarn: boolean; daysUntilExpiry: number } | null>(null)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // ── Session timeout ──────────────────────────────────────────────────────

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

  // ── Restore session on mount ──────────────────────────────────────────

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as AuthUser
        setUser(parsed)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── loginAsDemo (DEMO BUILDS ONLY) ───────────────────────────────────────────
  //
  // Sets a synthetic AuthUser directly — no PBKDF2, no audit log, no keyManager.
  // Calling this in a local or web build is a no-op with a console warning.

  const loginAsDemo = useCallback((demoUser: DemoUser) => {
    if (!IS_DEMO) {
      console.warn('[AuthContext] loginAsDemo called outside of demo build — ignoring.')
      return
    }
    const authUser: AuthUser = {
      id: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      role: demoUser.role,
      mfaVerified: true,
      forcePasswordReset: false,
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
    setUser(authUser)
    setIsLoading(false)
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────────────────

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
          ? 'This account has been locked due to too many failed login attempts. Contact your administrator.'
          : `Invalid email or password. ${Math.max(0, MAX_FAILED_ATTEMPTS - newAttempts)} attempt(s) remaining before lockout.`
      )
    }

    await keyManager.initKey(password)
    await auditLog('KEY_INITIALIZED', { userId: match.id, userName: match.name, outcome: 'success' })

    const expiry = checkPasswordExpiry(match.passwordSetAt)
    setPasswordExpiry({ shouldWarn: expiry.shouldWarn, daysUntilExpiry: expiry.daysUntilExpiry })

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

  // ── Logout ────────────────────────────────────────────────────────────────────────

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

  // ── Change Password ───────────────────────────────────────────────────────────

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('Not authenticated.')

    const users: AppUser[] = ls.get(LS_KEYS.users, [])
    const match = users.find(u => u.id === user.id)
    if (!match) throw new Error('User record not found.')

    const valid = await verifyPassword(currentPassword, match.passwordHash)
    if (!valid) {
      await auditLog('PASSWORD_CHANGE_FAILED', {
        userId: user.id,
        userName: user.name,
        outcome: 'failure',
        details: { reason: 'wrong_current_password' },
      })
      throw new Error('Current password is incorrect.')
    }

    const historyToCheck = [match.passwordHash, ...(match.passwordHistory ?? [])]
    for (const oldHash of historyToCheck) {
      const reused = await verifyPassword(newPassword, oldHash)
      if (reused) {
        await auditLog('PASSWORD_CHANGE_FAILED', {
          userId: user.id,
          userName: user.name,
          outcome: 'failure',
          details: { reason: 'password_reuse' },
        })
        throw new Error('This password has been used recently. Choose a different password.')
      }
    }

    const newHash = await hashPassword(newPassword)
    const newHistory = [match.passwordHash, ...(match.passwordHistory ?? [])].slice(0, 10)

    const updatedUsers = users.map(u =>
      u.id === user.id
        ? {
            ...u,
            passwordHash: newHash,
            passwordHistory: newHistory,
            passwordSetAt: new Date().toISOString(),
            forcePasswordReset: false,
            failedAttempts: 0,
          }
        : u
    )
    ls.set(LS_KEYS.users, updatedUsers)

    await keyManager.initKey(newPassword)

    const updatedAuthUser: AuthUser = { ...user, forcePasswordReset: false }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(updatedAuthUser))
    setUser(updatedAuthUser)
    setPasswordExpiry(null)

    await auditLog('PASSWORD_CHANGED', {
      userId: user.id,
      userName: user.name,
      outcome: 'success',
    })
  }, [user])

  // ── Permission helpers ───────────────────────────────────────────────────────

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
      forcePasswordReset: user?.forcePasswordReset ?? false,
      passwordExpiry,
      sessionWarning,
      login,
      loginAsDemo,
      logout,
      changePassword,
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

// ── Role guard components ──────────────────────────────────────────────

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
