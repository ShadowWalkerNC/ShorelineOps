/**
 * Auth context — JWT-backed by default.
 * Demo credentials are only available when VITE_DEMO_MODE=true (never for PHI).
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { UserRole, Permission } from '../types/roles'
import { ROLE_PERMISSIONS, ROLE_RANK, hasPermission } from '../types/roles'
import { authApi } from '../api/auth'
import { tokenManager } from './tokenManager'
import { auditLog } from './auditLog'

export type { UserRole }

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  mfaVerified: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<
    | { status: 'authenticated' }
    | { status: 'mfa_required'; mfaToken: string; email: string; name: string }
    | { status: 'mfa_enrollment_required'; mfaToken: string; email: string; name: string }
  >
  completeMfaLogin: (mfaToken: string, code: string) => Promise<void>
  completeMfaEnrollment: (mfaToken: string, code: string) => Promise<void>
  beginMfaEnrollment: (mfaToken: string) => Promise<{ secret: string; otpauthUrl: string }>
  logout: (reason?: string) => Promise<void>
  can: (permission: Permission) => boolean
  atLeast: (role: UserRole) => boolean
}

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const IS_DEV = import.meta.env.DEV
const SESSION_KEY = 'shoreline_demo_user'
const IDLE_TIMEOUT_MS = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS ?? 15 * 60 * 1000)

const AuthContext = createContext<AuthContextValue | null>(null)

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false
  const u = value as Record<string, unknown>
  return (
    typeof u.id === 'string' &&
    typeof u.name === 'string' &&
    typeof u.email === 'string' &&
    typeof u.role === 'string'
  )
}

const DEFAULT_DEMO_USER: AuthUser = {
  id: 'usr_admin',
  name: 'Chef Marcus Vance',
  email: 'admin@shoreline.demo',
  role: 'admin',
  mfaVerified: true,
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function restore() {
      try {
        if (DEMO_MODE || IS_DEV) {
          const stored = sessionStorage.getItem(SESSION_KEY)
          if (stored) {
            const parsed = JSON.parse(stored) as unknown
            if (isAuthUser(parsed)) {
              if (!cancelled) setUser({ ...parsed, mfaVerified: !!parsed.mfaVerified })
              return
            }
          }
          // In demo mode, automatically log in as the demo admin so direct deep-links (e.g. /menu) load instantly
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(DEFAULT_DEMO_USER))
          if (!cancelled) setUser(DEFAULT_DEMO_USER)
          return
        }

        if (!tokenManager.hasRefreshToken()) return

        try {
          await tokenManager.refresh()
        } catch {
          tokenManager.clear()
          return
        }

        const { data } = await authApi.me()
        if (!cancelled && isAuthUser(data)) {
          setUser({
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role,
            mfaVerified: !!data.mfaVerified,
          })
        }
      } catch {
        tokenManager.clear()
        sessionStorage.removeItem(SESSION_KEY)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const applySession = useCallback((data: { accessToken: string; refreshToken: string; user: AuthUser }) => {
    tokenManager.set(data.accessToken, data.refreshToken)
    const authUser: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      mfaVerified: !!data.user.mfaVerified,
    }
    setUser(authUser)
    auditLog('LOGIN', { outcome: 'success' })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE || IS_DEV) {
      try {
        const { DEMO_USERS } = await import('./demoCredentials')
        const match = DEMO_USERS.find(
          (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        )
        if (match) {
          const { password: _pw, ...authUser } = match
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
          setUser(authUser)
          auditLog('LOGIN', { userId: authUser.id, outcome: 'success' })
          return { status: 'authenticated' as const }
        }
      } catch {
        /* fallback to backend API */
      }
    }

    const { data } = await authApi.login(email, password)

    if ('mfaRequired' in data && data.mfaRequired) {
      return {
        status: 'mfa_required' as const,
        mfaToken: data.mfaToken,
        email: data.user.email,
        name: data.user.name,
      }
    }

    if ('mfaEnrollmentRequired' in data && data.mfaEnrollmentRequired) {
      return {
        status: 'mfa_enrollment_required' as const,
        mfaToken: data.mfaToken,
        email: data.user.email,
        name: data.user.name,
      }
    }

    if (!('accessToken' in data)) {
      throw new Error('Unexpected login response')
    }

    applySession(data)
    return { status: 'authenticated' as const }
  }, [applySession])

  const completeMfaLogin = useCallback(async (mfaToken: string, code: string) => {
    const { data } = await authApi.verifyMfa(mfaToken, code)
    applySession(data)
  }, [applySession])

  const beginMfaEnrollment = useCallback(async (mfaToken: string) => {
    const { data } = await authApi.beginMfaSetup(mfaToken)
    return { secret: data.secret, otpauthUrl: data.otpauthUrl }
  }, [])

  const completeMfaEnrollment = useCallback(async (mfaToken: string, code: string) => {
    const { data } = await authApi.confirmMfaSetup(code, mfaToken)
    if ('accessToken' in data) {
      applySession(data)
    } else {
      throw new Error('Enrollment did not return a session')
    }
  }, [applySession])

  const logout = useCallback(async (reason = 'user_initiated') => {
    const uid = user?.id
    try {
      if (!DEMO_MODE) {
        const refreshToken = sessionStorage.getItem('_rt')
        if (refreshToken) {
          // Ship audit while access token is still valid
          auditLog(reason === 'idle_timeout' ? 'SESSION_TIMEOUT' : 'LOGOUT', {
            userId: uid,
            outcome: 'success',
            details: { reason },
          })
          await authApi.logout(refreshToken).catch(() => undefined)
        }
      } else {
        auditLog(reason === 'idle_timeout' ? 'SESSION_TIMEOUT' : 'LOGOUT', {
          userId: uid,
          outcome: 'success',
          details: { reason },
        })
      }
    } finally {
      tokenManager.clear()
      sessionStorage.removeItem(SESSION_KEY)
      setUser(null)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    let timeoutId: ReturnType<typeof setTimeout>
    const resetTimer = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        void logout('idle_timeout')
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const
    events.forEach((evt) => window.addEventListener(evt, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timeoutId)
      events.forEach((evt) => window.removeEventListener(evt, resetTimer))
    }
  }, [user, logout])

  const can = useCallback((permission: Permission): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission)
  }, [user])

  const atLeast = useCallback((role: UserRole): boolean => {
    if (!user) return false
    return ROLE_RANK[user.role] >= ROLE_RANK[role]
  }, [user])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      completeMfaLogin,
      completeMfaEnrollment,
      beginMfaEnrollment,
      logout,
      can,
      atLeast,
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
