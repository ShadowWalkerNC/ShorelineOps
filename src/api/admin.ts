/**
 * Admin API client — local branch stub.
 *
 * On the local branch adminStore reads from in-memory seed data.
 * This file is scaffolding for the Supabase migration and makes
 * no network calls. It will be replaced with a real implementation
 * when the local branch is promoted to production.
 */
import type { AdminUser, AuditLogEntry, SystemSettings } from '../types/admin'
import type { UserRole } from '../security/AuthContext'

async function noop<T>(): Promise<T> {
  return null as unknown as T
}

export const adminApi = {
  // Users
  listUsers: () => noop<AdminUser[]>(),
  createUser: (_data: { name: string; email: string; role: UserRole }) => noop<AdminUser>(),
  updateUserRole: (_id: string, _role: UserRole) => noop<AdminUser>(),
  deactivateUser: (_id: string) => noop<AdminUser>(),
  reactivateUser: (_id: string) => noop<AdminUser>(),

  // Audit log
  getAuditLog: (_params?: { limit?: number; offset?: number; userId?: string }) =>
    noop<AuditLogEntry[]>(),

  // Settings
  getSettings: () => noop<SystemSettings>(),
  updateSettings: (_data: Partial<SystemSettings>) => noop<SystemSettings>(),
}
