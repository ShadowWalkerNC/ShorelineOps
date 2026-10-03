import type { UserRole } from '../types/roles'

/**
 * Authoritative capability definitions matching server/src/middleware/permissions.ts
 *
 * Denials:
 * - distributor holds NO capabilities (no PHI, no kitchen/production/hardware/reporting)
 * - readonly holds read capabilities only; every write capability excludes it
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

const CLINICAL_READ: readonly UserRole[] = ['admin', 'manager', 'dietitian']
const SERVICE_READ: readonly UserRole[] = [
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
const RESIDENT_DEMOGRAPHIC_WRITE: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
]
const FLAG_WRITE: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'activities',
  'server',
  'staff',
]
const KITCHEN_WRITE: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'staff',
  'server',
]
const KITCHEN_READ: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'activities',
  'server',
  'staff',
  'readonly',
]
const HYDRATION_WRITE: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'activities',
  'server',
  'staff',
]
const PRODUCTION_WRITE: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'staff',
]
const PRODUCTION_READ: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'staff',
  'readonly',
]
const REPORTING_OPS_READ: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'staff',
  'readonly',
]
const HACCP_READ: readonly UserRole[] = [
  'admin',
  'manager',
  'dietitian',
  'dietary',
  'server',
  'staff',
  'readonly',
]
const MANAGER_ADMIN: readonly UserRole[] = ['manager', 'admin']

export const CAPABILITY_ROLES: Record<Capability, readonly UserRole[]> = {
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

export function hasCapability(role: UserRole | undefined | null, capability: Capability): boolean {
  if (!role) return false
  const allowed = CAPABILITY_ROLES[capability]
  if (!allowed) return false
  return (allowed as readonly string[]).includes(role)
}
