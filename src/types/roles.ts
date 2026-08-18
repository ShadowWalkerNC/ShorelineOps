// ============================================================
// ROLES & PERMISSIONS
// ============================================================
// Single source of truth for every role, department, and
// permission in the system. Guards, stores, and UI all
// derive their visibility rules from these types.
//
// Production note: map these to Postgres role/permission
// tables and enforce at the RLS (Row Level Security) layer.
// ============================================================

// ── Roles ────────────────────────────────────────────────────────────────────
export const USER_ROLES = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'distributor',
  'activities',
  'server',
  'staff',
  'readonly',
] as const
export type UserRole = typeof USER_ROLES[number]

/** Numeric rank — higher = more privileged. Used for ≥ comparisons. */
export const ROLE_RANK: Record<UserRole, number> = {
  readonly:    0,
  distributor: 1,   // External distributor partner (Catalog & items portal)
  staff:       2,
  server:      3,
  activities:  4,
  dietary:     5,
  dietitian:   6,   // Clinical Dietitian — nutrition, diet orders, clinical sign-offs
  frontdesk:   7,   // Office Assistant — administrative
  manager:     8,
  admin:       9,
}

/** Human-readable labels for display */
export const ROLE_LABEL: Record<UserRole, string> = {
  admin:       'Administrator',
  manager:     'Manager',
  dietitian:   'Registered Dietitian (RD)',
  frontdesk:   'Office Assistant',
  dietary:     'Dietary Staff',
  distributor: 'Distributor Partner',
  activities:  'Activities Director',
  server:      'Server',
  staff:       'Staff',
  readonly:    'Read-Only',
}

// ── Departments ───────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  'Administration',
  'Dietary',
  'Activities',
  'Nursing',
  'Housekeeping',
  'Maintenance',
  'Management',
] as const
export type Department = typeof DEPARTMENTS[number]

// ── Permissions ───────────────────────────────────────────────────────────────
export const PERMISSIONS = [
  // Residents
  'view:residents',
  'edit:residents',
  // Staff
  'view:staff',
  'edit:staff',
  'manage:roles',
  // Call-outs (never visible to the subject staff member)
  'view:callouts',
  'file:callouts',
  // Inventory
  'view:inventory',
  'edit:inventory',
  'submit:inventory_count',
  'approve:inventory_count',
  // Menu
  'view:menu',
  'edit:menu',
  'request:menu_change',
  'approve:menu_change',
  // Production
  'view:production',
  'edit:production',
  // Budget
  'view:budget',
  'edit:budget',
  // Truck orders
  'view:truck',
  'create:truck_order',
  'approve:truck_order',
  'receive:truck_order',
  // Communications & notifications
  'send:notifications',
  'view:communications',
  'create:communications',
  'approve:communications',
  'distribute:communications',
  // Approvals
  'view:approvals',
  'action:approvals',
  // Vendor / Distributor
  'manage:vendor_catalog',
  'view:vendor_catalog',
  // Admin
  'view:audit',
  'manage:settings',
  'manage:checklists',
  'manage:preplist_templates',
] as const
export type Permission = typeof PERMISSIONS[number]

// ── Role → Permission map ─────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: PERMISSIONS, // all

  manager: [
    'view:residents', 'edit:residents',
    'view:staff', 'edit:staff',
    'view:callouts', 'file:callouts',
    'view:inventory', 'edit:inventory', 'submit:inventory_count', 'approve:inventory_count',
    'view:menu', 'edit:menu', 'request:menu_change', 'approve:menu_change',
    'view:production', 'edit:production',
    'view:budget',
    'view:truck', 'create:truck_order', 'approve:truck_order', 'receive:truck_order',
    'manage:vendor_catalog', 'view:vendor_catalog',
    'send:notifications',
    'view:communications', 'create:communications', 'approve:communications', 'distribute:communications',
    'view:approvals', 'action:approvals',
    'view:audit',
    'manage:checklists', 'manage:preplist_templates',
  ],

  dietitian: [
    'view:residents', 'edit:residents',
    'view:menu', 'edit:menu', 'request:menu_change', 'approve:menu_change',
    'view:production',
    'view:inventory',
    'view:truck',
    'manage:vendor_catalog', 'view:vendor_catalog',
    'view:communications', 'create:communications',
  ],

  // Office Assistant — near-manager access.
  frontdesk: [
    'view:residents', 'edit:residents',
    'view:staff',
    'view:callouts', 'file:callouts',
    'view:inventory',
    'view:menu', 'request:menu_change',
    'view:production',
    'view:budget',
    'view:truck', 'create:truck_order',
    'send:notifications',
    'view:communications', 'create:communications', 'distribute:communications',
    'view:approvals', 'action:approvals',
  ],

  dietary: [
    'view:residents',
    'view:inventory', 'edit:inventory', 'submit:inventory_count',
    'view:menu',
    'view:production', 'edit:production',
    'view:truck', 'create:truck_order',
    'view:vendor_catalog',
    'view:communications',
  ],

  distributor: [
    'manage:vendor_catalog',
    'view:vendor_catalog',
  ],

  activities: [
    'view:residents',
    'view:menu',
    'view:communications', 'create:communications',
  ],

  server: [
    'view:residents',
    'view:menu',
    'view:production',
    'view:communications',
  ],

  staff: [
    'view:residents',
    'view:menu',
    'view:communications',
  ],

  readonly: [
    'view:residents',
    'view:menu',
    'view:inventory',
  ],
}

/** Returns true if the given role has the given permission. */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] as readonly string[]).includes(permission)
}

/** Returns true if roleA is at least as privileged as roleB. */
export function roleAtLeast(roleA: UserRole, roleB: UserRole): boolean {
  return ROLE_RANK[roleA] >= ROLE_RANK[roleB]
}
