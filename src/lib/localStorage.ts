// ============================================================
// LOCAL STORAGE HELPER
// ============================================================
// Typed key registry + thin get/set/remove wrappers.
//
// NON-PHI keys only — use cs (cryptoStore) for PHI keys.
// PHI keys are listed in PHI_KEYS in cryptoStore.ts.
//
// All stores on the `local` branch use this instead of Supabase.
// ============================================================

export const LS_KEYS = {
  // PHI — read/write via cryptoStore (cs), not ls
  residents:      'sl_residents',
  staffProfiles:  'sl_staff_profiles',
  callOuts:       'sl_call_outs',
  threads:        'sl_comm_threads',
  approvals:      'sl_comm_approvals',
  budgetPeriods:  'sl_budget_periods',
  budgetEntries:  'sl_budget_entries',
  // Non-PHI — safe to use ls directly
  timePunches:    'sl_time_punches',   // badge IDs only, not PHI
  stockItems:     'sl_stock_items',
  wasteEntries:   'sl_waste_entries',
  counts:         'sl_inventory_counts',
  truckOrders:    'sl_truck_orders',
  menuWeeks:      'sl_menu_weeks',
  menuItems:      'sl_menu_items',
  productions:    'sl_production_sheets',
  // Auth / setup / compliance (non-PHI metadata)
  users:          'sl_users',
  complianceRecord: 'sl_compliance_record',
  setupComplete:  'sl_setup_complete',
  facilityInfo:   'sl_facility_info',
  auditLog:       'sl_audit_log',
  auditHmacKey:   'sl_audit_hmac_key',
  keySalt:        'sl_key_salt',
  activeSessions: 'sl_active_sessions',
} as const

export type LsKey = typeof LS_KEYS[keyof typeof LS_KEYS]

function get<T>(key: LsKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function set<T>(key: LsKey, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    console.warn(`[localStorage] Could not write key "${key}"`)
  }
}

function remove(key: LsKey): void {
  localStorage.removeItem(key)
}

export const ls = { get, set, remove }
