// ============================================================
// LOCAL STORAGE HELPER
// ============================================================
// Typed key registry + thin get/set/remove wrappers.
// All stores on the `local` branch use this instead of Supabase.
// ============================================================

export const LS_KEYS = {
  residents:      'sl_residents',
  stockItems:     'sl_stock_items',
  wasteEntries:   'sl_waste_entries',
  counts:         'sl_inventory_counts',
  truckOrders:    'sl_truck_orders',
  menuWeeks:      'sl_menu_weeks',
  menuItems:      'sl_menu_items',
  budgetPeriods:  'sl_budget_periods',
  budgetEntries:  'sl_budget_entries',
  productions:    'sl_production_sheets',
  threads:        'sl_comm_threads',
  approvals:      'sl_comm_approvals',
  staffProfiles:  'sl_staff_profiles',
  callOuts:       'sl_call_outs',
  timePunches:    'sl_time_punches',
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
