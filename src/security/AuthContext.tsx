/**
 * ============================================================
 * AUTH CONTEXT — DEMO MODE
 * ============================================================
 * Uses hardcoded local credentials so the app works as a
 * fully self-contained demo with NO backend required.
 *
 * ⚠️  DEMO ONLY — Do NOT use in production.
 *     Replace with Supabase auth + RLS in production.
 *     See DEMO.md for migration guide.
 *
 * Roles (lowest → highest privilege):
 *   readonly → staff → server → dietary → activities → manager → admin
 * ============================================================
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { UserRole, Permission } from '../types/roles'
import { ROLE_PERMISSIONS, ROLE_RANK, hasPermission } from '../types/roles'

export type { UserRole }

export interface AuthUser {
  /** Matches the staffProfile.authUserId for linking */
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
  /** Returns true if the current user has the given permission */
  can: (permission: Permission) => boolean
  /** Returns true if the current user's role is at least as privileged as the given role */
  atLeast: (role: UserRole) => boolean
}

// ── Demo credential store ─────────────────────────────────────────────────────
// Seven accounts cover all role levels for demo/review purposes.
// Replace this block with Supabase auth.signInWithPassword() in production.
const DEMO_USERS: (AuthUser & { password: string })[] = [
  {
    id: 'demo-admin-1',
    name: 'Alex Rivera',
    email: 'admin@shoreline.demo',
    password: 'Admin1234!',
    role: 'admin',
    mfaVerified: true,
  },
  {
    id: 'demo-manager-1',
    name: 'Morgan Ellis',
    email: 'manager@shoreline.demo',
    password: 'Manager1234!',
    role: 'manager',
    mfaVerified: true,
  },
  {
    id: 'demo-dietary-1',
    name: 'Jamie Torres',
    email: 'dietary@shoreline.demo',
    password: 'Dietary1234!',
    role: 'dietary',
    mfaVerified: true,
  },
  {
    id: 'demo-activities-1',
    name: 'Casey Nguyen',
    email: 'activities@shoreline.demo',
    password: 'Activities1234!',
    role: 'activities',
    mfaVerified: true,
  },
  {
    id: 'demo-server-1',
    name: 'Jordan Lee',
    email: 'server@shoreline.demo',
    password: 'Server1234!',
    role: 'server',
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

  const can = useCallback((permission: Permission): boolean => {
    if (!user) return false
    return hasPermission(user.role, permission)
  }, [user])

  const atLeast = useCallback((role: UserRole): boolean => {
    if (!user) return false
    return ROLE_RANK[user.role] >= ROLE_RANK[role]
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, can, atLeast }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ── Role guard component ──────────────────────────────────────────────────────
/**
 * Renders children only if the current user has AT LEAST the given role.
 * Renders fallback (or null) otherwise.
 */
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

/**
 * Renders children only if the current user has the given permission.
 */
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

// Re-export for consumers that imported from here previously
export type UserRoleType = UserRole
export { ROLE_PERMISSIONS }
