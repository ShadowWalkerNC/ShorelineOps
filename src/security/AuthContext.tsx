/**
 * Auth context — wired to the real backend.
 * Stores user in React state; tokens managed by tokenManager.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { auditLog } from './auditLog'
import { useSessionTimeout } from './useSessionTimeout'
import { tokenManager } from './tokenManager'
import { authApi } from '../api/auth'

export type UserRole = 'admin' | 'staff' | 'readonly'

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
  login: (email: string, password: string) => Promise<void>
  logout: (reason?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: if a refresh token exists, silently refresh the access token
  // then call /api/auth/me to restore the full user object.
  useEffect(() => {
    async function restoreSession() {
      if (!tokenManager.hasRefreshToken()) {
        setIsLoading(false)
        return
      }
      try {
        await tokenManager.refresh()
        const { data } = await authApi.me()
        setUser(data)
      } catch {
        tokenManager.clear()
      } finally {
        setIsLoading(false)
      }
    }
    restoreSession()
  }, [])

  const logout = useCallback(async (reason = 'user_initiated') => {
    const rt = sessionStorage.getItem('_rt')
    if (rt) {
      try { await authApi.logout(rt) } catch { /* ignore */ }
    }
    tokenManager.clear()
    auditLog('LOGOUT', { userId: user?.id, outcome: 'success', details: { reason } })
    setUser(null)
  }, [user])

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    tokenManager.set(data.accessToken, data.refreshToken)
    auditLog('LOGIN', { userId: data.user.id, outcome: 'success' })
    setUser(data.user)
  }, [])

  useSessionTimeout(() => logout('session_timeout'), user?.id)

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export type UserRoleType = UserRole

export function RequireRole({
  role,
  children,
}: {
  role: UserRole
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const roleRank: Record<UserRole, number> = { readonly: 0, staff: 1, admin: 2 }
  if (!user || roleRank[user.role] < roleRank[role]) {
    auditLog('ACCESS_DENIED', {
      userId: user?.id,
      outcome: 'failure',
      details: { requiredRole: role, userRole: user?.role },
    })
    return <div className="p-4 text-red-600">Access denied.</div>
  }
  return <>{children}</>
}
