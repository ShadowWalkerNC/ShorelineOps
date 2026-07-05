/**
 * ============================================================
 * USER STORE — App User Management
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(i) — Unique user identification
 * HIPAA Security Rule §164.308(a)(3) — Workforce security
 * SOC 2 CC6.2 — New internal and external users
 *
 * Manages authentication users (separate from staffStore profiles).
 * All passwords are stored as PBKDF2-SHA256 hashes — never plaintext.
 * sl_users is stored in PLAIN localStorage because it contains only
 * hashed credentials and metadata — no PHI.
 * ============================================================
 */

import { create } from 'zustand'
import { ls, LS_KEYS } from '../lib/localStorage'
import { auditLog } from '../security/auditLog'
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  isPasswordInHistory,
  checkPasswordExpiry,
} from '../security/passwordPolicy'
import type { AppUser } from '../security/AuthContext'
import type { UserRole } from '../types/roles'

export type { AppUser }

interface UserStoreState {
  users: AppUser[]
  load: () => void
  getUser: (id: string) => AppUser | undefined
  listUsers: () => AppUser[]
  createUser: (
    data: { name: string; email: string; role: UserRole; password: string },
    createdById: string,
    createdByName: string
  ) => Promise<AppUser>
  updateUser: (
    id: string,
    updates: Partial<Pick<AppUser, 'name' | 'email' | 'role'>>,
    updatedById: string,
    updatedByName: string
  ) => Promise<void>
  deleteUser: (id: string, deletedById: string, deletedByName: string) => Promise<void>
  lockUser: (id: string, lockedById: string, lockedByName: string) => Promise<void>
  unlockUser: (id: string, unlockedById: string, unlockedByName: string) => Promise<void>
  forcePasswordReset: (id: string, byId: string, byName: string) => Promise<void>
  changePassword: (
    id: string,
    currentPassword: string,
    newPassword: string
  ) => Promise<void>
}

function loadUsers(): AppUser[] {
  return ls.get<AppUser[]>(LS_KEYS.users, [])
}

function saveUsers(users: AppUser[]): void {
  ls.set(LS_KEYS.users, users)
}

export const useUserStore = create<UserStoreState>((set, get) => ({
  users: [],

  load: () => set({ users: loadUsers() }),

  getUser: (id) => get().users.find(u => u.id === id),

  listUsers: () => get().users,

  createUser: async (data, createdById, createdByName) => {
    // Validate email uniqueness
    const existing = loadUsers()
    if (existing.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error(`A user with email "${data.email}" already exists.`)
    }
    // Validate password policy
    const validation = validatePassword(data.password)
    if (!validation.valid) {
      throw new Error(`Password does not meet requirements:\n${validation.errors.join('\n')}`)
    }
    const passwordHash = await hashPassword(data.password)
    const now = new Date().toISOString()
    const user: AppUser = {
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      role: data.role,
      mfaVerified: false,
      passwordHash,
      passwordHistory: [passwordHash],
      passwordSetAt: now,
      failedAttempts: 0,
      lockedAt: null,
      lastLoginAt: null,
      createdAt: now,
      forcePasswordReset: false,
    }
    const updated = [...existing, user]
    saveUsers(updated)
    set({ users: updated })
    await auditLog('USER_CREATED', {
      userId: createdById,
      userName: createdByName,
      resourceId: user.id,
      resourceType: 'user',
      outcome: 'success',
      details: { newUserEmail: data.email, role: data.role },
    })
    return user
  },

  updateUser: async (id, updates, updatedById, updatedByName) => {
    const users = loadUsers().map(u => u.id === id ? { ...u, ...updates } : u)
    saveUsers(users)
    set({ users })
    await auditLog('UPDATE_STAFF', {
      userId: updatedById,
      userName: updatedByName,
      resourceId: id,
      resourceType: 'user',
      outcome: 'success',
      details: updates,
    })
  },

  deleteUser: async (id, deletedById, deletedByName) => {
    const users = loadUsers().filter(u => u.id !== id)
    saveUsers(users)
    set({ users })
    await auditLog('USER_DELETED', {
      userId: deletedById,
      userName: deletedByName,
      resourceId: id,
      resourceType: 'user',
      outcome: 'success',
    })
  },

  lockUser: async (id, lockedById, lockedByName) => {
    const users = loadUsers().map(u =>
      u.id === id ? { ...u, lockedAt: new Date().toISOString() } : u
    )
    saveUsers(users)
    set({ users })
    await auditLog('ACCOUNT_LOCKED', {
      userId: lockedById,
      userName: lockedByName,
      resourceId: id,
      resourceType: 'user',
      outcome: 'success',
      details: { reason: 'admin_action' },
    })
  },

  unlockUser: async (id, unlockedById, unlockedByName) => {
    const users = loadUsers().map(u =>
      u.id === id ? { ...u, lockedAt: null, failedAttempts: 0 } : u
    )
    saveUsers(users)
    set({ users })
    await auditLog('ACCOUNT_UNLOCKED', {
      userId: unlockedById,
      userName: unlockedByName,
      resourceId: id,
      resourceType: 'user',
      outcome: 'success',
    })
  },

  forcePasswordReset: async (id, byId, byName) => {
    const users = loadUsers().map(u =>
      u.id === id ? { ...u, forcePasswordReset: true } : u
    )
    saveUsers(users)
    set({ users })
    await auditLog('PASSWORD_CHANGED', {
      userId: byId,
      userName: byName,
      resourceId: id,
      resourceType: 'user',
      outcome: 'success',
      details: { action: 'force_reset_flagged' },
    })
  },

  changePassword: async (id, currentPassword, newPassword) => {
    const users = loadUsers()
    const user = users.find(u => u.id === id)
    if (!user) throw new Error('User not found.')

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) throw new Error('Current password is incorrect.')

    // Validate new password policy
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      throw new Error(`Password does not meet requirements:\n${validation.errors.join('\n')}`)
    }

    // Check password history
    const inHistory = await isPasswordInHistory(newPassword, user.passwordHistory)
    if (inHistory) {
      throw new Error('You cannot reuse any of your last 10 passwords.')
    }

    const newHash = await hashPassword(newPassword)
    const newHistory = [...user.passwordHistory, newHash].slice(-10)
    const updated = users.map(u =>
      u.id === id
        ? { ...u, passwordHash: newHash, passwordHistory: newHistory,
            passwordSetAt: new Date().toISOString(), forcePasswordReset: false,
            failedAttempts: 0 }
        : u
    )
    saveUsers(updated)
    set({ users: updated })
    await auditLog('PASSWORD_CHANGED', {
      userId: id,
      userName: user.name,
      resourceId: id,
      resourceType: 'user',
      outcome: 'success',
    })

    // Check new expiry
    const expiry = checkPasswordExpiry(new Date().toISOString())
    if (expiry.shouldWarn) {
      await auditLog('PASSWORD_EXPIRED', { userId: id, userName: user.name, outcome: 'success',
        details: { daysUntilExpiry: expiry.daysUntilExpiry } })
    }
  },
}))
