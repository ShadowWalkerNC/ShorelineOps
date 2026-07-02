/**
 * Auth context — provides user identity and session control throughout the app.
 * Scaffold is MFA-ready (mfaVerified flag) and RBAC-ready (role field).
 *
 * Wire up to your real auth backend (JWT, OAuth2, etc.) in the login flow.
 * HIPAA / SOC 2 require: strong passwords, MFA, short-lived tokens.
 */
import React, { createContext, useContext, useState, useCallback } from 'react'
import { auditLog } from './auditLog'
import { useSessionTimeout } from './useSessionTimeout'

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
  login: (user: AuthUser) => void
  logout: (reason?: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const logout = useCallback((reason = 'user_initiated') => {
    auditLog('LOGOUT', {
      userId: user?.id,
      outcome: 'success',
      details: { reason },
    })
    setUser(null)
    // Clear any session tokens from memory here
  }, [user])

  const login = useCallback((authUser: AuthUser) => {
    auditLog('LOGIN', { userId: authUser.id, outcome: 'success' })
    setUser(authUser)
  }, [])

  // Auto-logout on inactivity — HIPAA §164.312(a)(2)(iii)
  useSessionTimeout(() => logout('session_timeout'), user?.id)

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/**
 * Role-based access guard. Wrap any component that requires a minimum role.
 * RBAC is required by HIPAA minimum necessary standard and SOC 2 CC6.3.
 */
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
