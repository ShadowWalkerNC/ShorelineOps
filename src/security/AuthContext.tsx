/**
 * ============================================================
 * AUTH CONTEXT — DEMO MODE
 * ============================================================
 * This file uses hardcoded local credentials so the app works
 * as a fully self-contained demo with NO backend required.
 *
 * ⚠️  DEMO ONLY — Do NOT use in production.
 *     See DEMO.md for the full guide on replacing this with
 *     real Supabase authentication.
 * ============================================================
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

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

// ── Demo credential store ─────────────────────────────────────────────────────
// Three accounts cover all three role levels for demo/review purposes.
// Replace this entire block with Supabase auth in production (see DEMO.md).
const DEMO_USERS: (AuthUser & { password: string })[] = [
  {
    id: 'demo-admin-1',
    name: 'Admin User',
    email: 'admin@shoreline.demo',
    password: 'Admin1234!',
    role: 'admin',
    mfaVerified: true,
  },
  {
    id: 'demo-staff-1',
    name: 'Staff User',
    email: 'staff@shoreline.demo',
    password: 'Staff1234!',
    role: 'staff',
    mfaVerified: true,
  },
  {
    id: 'demo-readonly-1',
    name: 'Read-Only User',
    email: 'readonly@shoreline.demo',
    password: 'Readonly1234!',
    role: 'readonly',
    mfaVerified: true,
  },
]

const SESSION_KEY = 'shoreline_demo_user'

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY)
      if (stored) setUser(JSON.parse(stored))
    } catch {
      // ignore bad stored value
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    // Simulate a brief network delay so the UX feels natural
    await new Promise(r => setTimeout(r, 400))
    const match = DEMO_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (!match) throw new Error('Invalid email or password')
    const { password: _pw, ...authUser } = match
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser))
    setUser(authUser)
  }, [])

  const logout = useCallback(async (_reason = 'user_initiated') => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

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
    return <div className="p-4 text-red-600">Access denied.</div>
  }
  return <>{children}</>
}
