import type { Response, NextFunction } from 'express'
import type { AuthRequest, ApiRole } from './requireAuth'
import { API_ROLES } from './requireAuth'

/**
 * Explicit typed capability allowlists for the security remediation.
 *
 * Rank-based checks (requireRole) do not model unrelated jobs: frontdesk
 * outranks dietitian, activities outranks server, and every threshold admits
 * a vertical slice of unrelated roles. Capabilities name the job instead.
 *
 * Preserved strict policies (do not widen):
 * - Therapeutic diet writes stay dietitian/manager-only (no admin wildcard).
 * - EHR reconciliation stays dietitian/admin-only (owned by ehr.ts, untouched).
 * - Purchasing approvals stay manager-gated (owned by purchasing.ts, untouched).
 *
 * Denials enforced here:
 * - distributor holds no capability in this file (no PHI, no kitchen/
 *   production/hardware/reporting access in the owned routes).
 * - readonly holds read capabilities only; every write capability excludes it.
 * - Unknown capability or role denies (returns false), never throws.
 */

export type Capability =
  | 'residents.read'
  | 'residents.serviceRead'
  | 'residents.historyRead'
  | 'residents.write'
  | 'residents.clinicalWrite'
  | 'residents.flagWrite'
  | 'residents.import'
  | 'residents.delete'
  | 'kitchen.read'
  | 'kitchen.write'
  | 'kitchen.hydrationWrite'
  | 'reporting.clinicalRead'
  | 'reporting.opsRead'
  | 'reporting.financeRead'
  | 'reporting.costWrite'
  | 'reporting.substitutionWrite'
  | 'reporting.substitutionDelete'
  | 'reporting.budgetWrite'
  | 'hardware.print'
  | 'hardware.haccpRead'
  | 'hardware.haccpManage'
  | 'hardware.haccpLog'
  | 'production.read'
  | 'production.write'
  | 'production.delete'
  | 'enterprise.read'
  | 'enterprise.write'

/** Full clinical resident reads: admin/manager/dietitian only. */
const CLINICAL_READ: readonly ApiRole[] = ['admin', 'manager', 'dietitian']

/**
 * Service-critical projected reads: full clinical roles plus frontdesk
 * demographic ops, food-service execution, activities aides (hydration
 * context), and readonly viewers. Distributor excluded (no PHI).
 */
const SERVICE_READ: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'activities',
  'server',
  'staff',
  'readonly',
]

/** Demographic resident writes: no dietary/activities/server/staff. */
const RESIDENT_DEMOGRAPHIC_WRITE: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
]

/** Flag-for-RD-review: any staff job, no readonly/distributor. */
const FLAG_WRITE: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'activities',
  'server',
  'staff',
]

/** Kitchen execution: food-service jobs only (no frontdesk/activities). */
const KITCHEN_WRITE: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'staff',
  'server',
]

/** Kitchen reads: execution + activities (hydration roster) + readonly. */
const KITCHEN_READ: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'activities',
  'server',
  'staff',
  'readonly',
]

/** Hydration passes: kitchen execution plus activities aides (no frontdesk). */
const HYDRATION_WRITE: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'activities',
  'server',
  'staff',
]

/** Production planning: kitchen leadership and aides (no servers/frontdesk). */
const PRODUCTION_WRITE: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'staff',
]

const PRODUCTION_READ: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'staff',
  'readonly',
]

/** Operational reporting: no server/activities/distributor. */
const REPORTING_OPS_READ: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'staff',
  'readonly',
]

const HACCP_READ: readonly ApiRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'server',
  'staff',
  'readonly',
]

const MANAGER_ADMIN: readonly ApiRole[] = ['manager', 'admin']

export const CAPABILITY_ROLES: Record<Capability, readonly ApiRole[]> = {
  'residents.read': CLINICAL_READ,
  'residents.serviceRead': SERVICE_READ,
  'residents.historyRead': CLINICAL_READ,
  'residents.write': RESIDENT_DEMOGRAPHIC_WRITE,
  'residents.clinicalWrite': ['dietitian', 'manager'],
  'residents.flagWrite': FLAG_WRITE,
  'residents.import': ['dietitian', 'manager'],
  'residents.delete': ['admin'],
  'kitchen.read': KITCHEN_READ,
  'kitchen.write': KITCHEN_WRITE,
  'kitchen.hydrationWrite': HYDRATION_WRITE,
  'reporting.clinicalRead': CLINICAL_READ,
  'reporting.opsRead': REPORTING_OPS_READ,
  'reporting.financeRead': MANAGER_ADMIN,
  'reporting.costWrite': MANAGER_ADMIN,
  'reporting.substitutionWrite': KITCHEN_WRITE,
  'reporting.substitutionDelete': MANAGER_ADMIN,
  'reporting.budgetWrite': MANAGER_ADMIN,
  'hardware.print': KITCHEN_WRITE,
  'hardware.haccpRead': HACCP_READ,
  'hardware.haccpManage': MANAGER_ADMIN,
  'hardware.haccpLog': KITCHEN_WRITE,
  'production.read': PRODUCTION_READ,
  'production.write': PRODUCTION_WRITE,
  'production.delete': ['admin'],
  'enterprise.read': MANAGER_ADMIN,
  'enterprise.write': MANAGER_ADMIN,
}

export function can(role: unknown, capability: unknown): boolean {
  if (typeof role !== 'string' || typeof capability !== 'string') return false
  if (!(API_ROLES as readonly string[]).includes(role)) return false
  const allowed = (CAPABILITY_ROLES as Record<string, readonly string[]>)[capability]
  if (!allowed) return false
  return allowed.includes(role)
}

/**
 * Require one of the given capabilities. Mount after requireAuth: a missing
 * role fails closed with 401 (unauthenticated), a denied role with 403 using
 * the existing { error: 'Forbidden' } contract. Unknown capabilities deny.
 */
export function requireCapability(...capabilities: Capability[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const allowed = capabilities.some((capability) => can(req.userRole, capability))
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
