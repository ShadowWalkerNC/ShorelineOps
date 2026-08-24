/**
 * ============================================================
 * UNIVERSAL DATA ADAPTER & SUPABASE EMULATOR
 * ============================================================
 * Prevents "Cannot read properties of null (reading 'from')"
 * Provides chainable PostgREST / Supabase-like fluent API with:
 *  - Automatic pre-seeding from demo datasets
 *  - Full reactive localStorage persistence
 *  - Multi-condition filtering (.eq, .neq, .or, .order, .limit)
 *  - Insertion, updates, upserts, single & maybeSingle resolvers
 * ============================================================
 */

import {
  SEED_RESIDENTS,
  SEED_MENU_ITEMS,
  SEED_MENU_WEEKS,
  SEED_RECIPES,
  SEED_PRODUCTION_SHEETS,
  SEED_ADMIN_USERS,
  SEED_AUDIT_LOG,
  SEED_SETTINGS,
} from '@/demo/seed'

// ── Default Additional Seed Data ───────────────────────────────────────────────

const SEED_STAFF_PROFILES = [
  {
    id: 'sp1',
    auth_user_id: 'demo-staff-1',
    employee_number: 'EMP-101',
    first_name: 'Marcus',
    last_name: 'Sterling',
    preferred_name: 'Chef Marcus',
    role: 'manager',
    department: 'Dietary',
    position: 'Executive Chef / Food Service Director',
    hire_date: '2022-03-15',
    status: 'Active',
    full_time: true,
    phone: '(555) 234-5678',
    email: 'marcus.sterling@shorelineops.com',
    emergency_contact: { name: 'Elena Sterling', relationship: 'Spouse', phone: '(555) 234-9988' },
    certifications: [
      { id: 'c1', name: 'ServSafe Food Manager', issuedDate: '2023-04-10', expiresDate: '2028-04-10' },
      { id: 'c2', name: 'CPR / AED', issuedDate: '2024-01-15', expiresDate: '2026-01-15' },
    ],
    manager_notes: 'Oversees menu planning, vendor contracts, and HACCP compliance.',
    created_at: '2022-03-15T08:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'sp2',
    auth_user_id: 'demo-dietitian-1',
    employee_number: 'EMP-102',
    first_name: 'Sarah',
    last_name: 'Jenkins',
    preferred_name: 'Sarah RD',
    role: 'dietitian',
    department: 'Dietary',
    position: 'Lead Registered Dietitian (RD)',
    hire_date: '2023-01-10',
    status: 'Active',
    full_time: true,
    phone: '(555) 345-6789',
    email: 'sarah.jenkins@shorelineops.com',
    emergency_contact: { name: 'Robert Jenkins', relationship: 'Spouse', phone: '(555) 345-1122' },
    certifications: [
      { id: 'c3', name: 'CDR Registered Dietitian', issuedDate: '2020-05-15', expiresDate: '2027-05-15' },
      { id: 'c4', name: 'Allergen Awareness', issuedDate: '2023-02-01', expiresDate: '2027-02-01' },
    ],
    manager_notes: 'Manages clinical nutrition assessments, IDDSI compliance, and PCC EHR sync.',
    created_at: '2023-01-10T08:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'sp3',
    auth_user_id: 'demo-cook-1',
    employee_number: 'EMP-103',
    first_name: 'David',
    last_name: 'Rodriguez',
    preferred_name: 'David',
    role: 'dietary',
    department: 'Dietary',
    position: 'Lead Prep & Line Cook',
    hire_date: '2024-06-01',
    status: 'Active',
    full_time: true,
    phone: '(555) 456-7890',
    email: 'david.rodriguez@shorelineops.com',
    emergency_contact: { name: 'Maria Rodriguez', relationship: 'Sister', phone: '(555) 456-3344' },
    certifications: [
      { id: 'c5', name: 'ServSafe Food Handler', issuedDate: '2024-06-05', expiresDate: '2027-06-05' },
    ],
    manager_notes: 'Hot line production specialist. Expert in pureed and mechanical soft textures.',
    created_at: '2024-06-01T08:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
  {
    id: 'sp4',
    auth_user_id: 'demo-aide-1',
    employee_number: 'EMP-104',
    first_name: 'Emily',
    last_name: 'Vance',
    preferred_name: 'Emily',
    role: 'dietary',
    department: 'Dietary',
    position: 'Dietary Aide / Tray Line Lead',
    hire_date: '2025-02-15',
    status: 'Active',
    full_time: false,
    phone: '(555) 567-8901',
    email: 'emily.vance@shorelineops.com',
    emergency_contact: { name: 'Thomas Vance', relationship: 'Father', phone: '(555) 567-5566' },
    certifications: [
      { id: 'c6', name: 'ServSafe Food Handler', issuedDate: '2025-02-20', expiresDate: '2028-02-20' },
    ],
    manager_notes: 'Main tray scanner operator and nourishment cart coordinator.',
    created_at: '2025-02-15T08:00:00Z',
    updated_at: '2026-06-01T10:00:00Z',
  },
]

const nowIso = new Date().toISOString()
const todayDate = nowIso.slice(0, 10)
const yesterdayDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

const SEED_TIME_PUNCHES = [
  {
    id: 'tp1',
    badge_id: 'EMP-101',
    operation: 'In',
    kiosk_id: 'Kitchen Kiosk 1',
    punched_at: `${todayDate}T06:00:15Z`,
    created_at: `${todayDate}T06:00:15Z`,
    notes: 'Morning prep shift',
  },
  {
    id: 'tp2',
    badge_id: 'EMP-101',
    operation: 'Out',
    kiosk_id: 'Kitchen Kiosk 1',
    punched_at: `${todayDate}T11:30:20Z`,
    created_at: `${todayDate}T11:30:20Z`,
    notes: 'Meal break',
  },
  {
    id: 'tp3',
    badge_id: 'EMP-101',
    operation: 'In',
    kiosk_id: 'Kitchen Kiosk 1',
    punched_at: `${todayDate}T12:00:45Z`,
    created_at: `${todayDate}T12:00:45Z`,
    notes: 'Lunch service supervision',
  },
  {
    id: 'tp4',
    badge_id: 'EMP-103',
    operation: 'In',
    kiosk_id: 'Kitchen Kiosk 2',
    punched_at: `${todayDate}T06:15:00Z`,
    created_at: `${todayDate}T06:15:00Z`,
    notes: 'Hot prep line',
  },
  {
    id: 'tp5',
    badge_id: 'EMP-104',
    operation: 'In',
    kiosk_id: 'Tray Line Scanner Kiosk',
    punched_at: `${todayDate}T10:45:10Z`,
    created_at: `${todayDate}T10:45:10Z`,
    notes: 'Lunch tray assembly',
  },
  {
    id: 'tp6',
    badge_id: 'EMP-101',
    operation: 'In',
    kiosk_id: 'Kitchen Kiosk 1',
    punched_at: `${yesterdayDate}T06:01:00Z`,
    created_at: `${yesterdayDate}T06:01:00Z`,
    notes: 'Regular shift',
  },
  {
    id: 'tp7',
    badge_id: 'EMP-101',
    operation: 'Out',
    kiosk_id: 'Kitchen Kiosk 1',
    punched_at: `${yesterdayDate}T14:32:00Z`,
    created_at: `${yesterdayDate}T14:32:00Z`,
    notes: 'Shift end',
  },
]

const SEED_CALL_OUTS = [
  {
    id: 'co1',
    staff_id: 'sp4',
    filed_by_id: 'sp1',
    date: yesterdayDate,
    shift: 'Evening',
    reason: 'Sick',
    notes: 'Called in with fever. Covered by Carlos Mendes.',
    follow_up_required: false,
    was_covered: true,
    covered_by_id: 'sp3',
    created_at: `${yesterdayDate}T13:00:00Z`,
    updated_at: `${yesterdayDate}T13:00:00Z`,
  },
]

const SEED_INVENTORY = [
  { id: 'inv1', item: 'Boneless Chicken Breast', category: 'Poultry', on_hand: 45, par_level: 60, unit: 'lbs', unit_cost: 3.45, distributor_sku: 'DEN-10492', location: 'Walk-In Freezer' },
  { id: 'inv2', item: 'Atlantic Salmon Fillets', category: 'Seafood', on_hand: 22, par_level: 30, unit: 'lbs', unit_cost: 8.90, distributor_sku: 'DEN-20811', location: 'Walk-In Freezer' },
  { id: 'inv3', item: 'Idaho Russet Potatoes #1', category: 'Produce', on_hand: 120, par_level: 100, unit: 'lbs', unit_cost: 0.65, distributor_sku: 'SYS-50912', location: 'Dry Storage' },
  { id: 'inv4', item: 'Whole Milk Grade A', category: 'Dairy', on_hand: 8, par_level: 20, unit: 'gal', unit_cost: 3.80, distributor_sku: 'DEN-33901', location: 'Dairy Cooler' },
  { id: 'inv5', item: 'Ensure Vanilla 8oz (Case 24)', category: 'Supplements', on_hand: 4, par_level: 10, unit: 'cs', unit_cost: 42.50, distributor_sku: 'SYS-88912', location: 'Nourishment Room' },
  { id: 'inv6', item: 'Thick-It Puree Starch 32oz', category: 'Supplements', on_hand: 6, par_level: 8, unit: 'ea', unit_cost: 14.20, distributor_sku: 'SYS-77123', location: 'Dietary Office' },
  { id: 'inv7', item: 'Rolled Oats 50lb Sack', category: 'Dry Goods', on_hand: 2, par_level: 3, unit: 'bag', unit_cost: 34.50, distributor_sku: 'DEN-44019', location: 'Dry Storage' },
  { id: 'inv8', item: 'Fresh Green Beans', category: 'Produce', on_hand: 18, par_level: 25, unit: 'lbs', unit_cost: 2.10, distributor_sku: 'DEN-55102', location: 'Produce Cooler' },
]

const SEED_BUDGET_PERIODS = [
  {
    id: 'bp-current',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    label: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    total_budget: 14500,
    budget_per_resident_per_day: 6.80,
    created_at: nowIso,
  },
]

const SEED_BUDGET_ENTRIES = [
  { id: 'be1', period_id: 'bp-current', date: `${todayDate}`, category: 'Raw Food', amount: 285.50, description: 'Dennis Broadline delivery invoice', vendor: 'Dennis' },
  { id: 'be2', period_id: 'bp-current', date: `${yesterdayDate}`, category: 'Supplements', amount: 170.00, description: 'Ensure & Thick-It replenishment', vendor: 'Sysco' },
]

const SEED_COMMUNICATIONS = [
  {
    id: 'comm1',
    author: 'Sarah Jenkins, RD',
    role: 'dietitian',
    category: 'Clinical Diet Order',
    subject: 'Margaret Tran (Room 106) - IDDSI Level 4 Pureed Verification',
    body: 'Speech Pathology completed dysphagia swallow study today. Upgraded to IDDSI Level 4 Pureed with mildly thick nectar liquids. All pureed modifications confirmed.',
    status: 'Approved',
    urgent: true,
    created_at: `${todayDate}T09:30:00Z`,
  },
  {
    id: 'comm2',
    author: 'Chef Marcus Sterling',
    role: 'manager',
    category: 'Kitchen Operations',
    subject: 'Dennis Food Service Delivery Received & Checked In',
    body: 'Morning truck received and temp-logged at 36°F (dairy) and -4°F (frozen poultry). 3-way invoice match verified without discrepancy.',
    status: 'Distributed',
    urgent: false,
    created_at: `${todayDate}T07:15:00Z`,
  },
]

// ── Master Table Initialization ────────────────────────────────────────────────

const TABLE_INITIALIZERS: Record<string, () => any[]> = {
  residents: () => SEED_RESIDENTS.map(r => ({
    id: r.id,
    name: r.name,
    room: r.room,
    status: r.status,
    diet_type: r.dietType,
    texture: r.texture,
    portion_size: r.portionSize,
    ensure_per_day: r.ensurePerDay,
    allergies: r.allergies,
    beverages: r.beverages,
    birthday_month: r.birthdayMonth,
    birthday_day: r.birthdayDay,
    serving_location: r.servingLocation,
    table_assignment: r.tableAssignment,
    likes: r.likes,
    dislikes: r.dislikes,
    special_instructions: r.specialInstructions,
    created_at: nowIso,
    updated_at: nowIso,
  })),
  staff_profiles: () => SEED_STAFF_PROFILES,
  time_punches: () => SEED_TIME_PUNCHES,
  call_outs: () => SEED_CALL_OUTS,
  inventory: () => SEED_INVENTORY,
  budget_periods: () => SEED_BUDGET_PERIODS,
  budget_entries: () => SEED_BUDGET_ENTRIES,
  communications: () => SEED_COMMUNICATIONS,
  menu_items: () => SEED_MENU_ITEMS.map(m => ({ id: m.id, name: m.name, texture_modified: m.textureModified, notes: m.notes })),
  menu_weeks: () => SEED_MENU_WEEKS.map(w => ({ id: w.id, name: w.name, active: w.active, effective_from: w.effectiveFrom, days: w.days })),
  production_sheets: () => SEED_PRODUCTION_SHEETS,
  recipes: () => SEED_RECIPES,
  admin_users: () => SEED_ADMIN_USERS,
  audit_logs: () => SEED_AUDIT_LOG,
  system_settings: () => [SEED_SETTINGS],
}

function getTableData(tableName: string): any[] {
  const key = `shoreline_db_${tableName}`
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // localStorage parse fallback
  }

  const initFn = TABLE_INITIALIZERS[tableName]
  const initial = initFn ? initFn() : []
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(initial))
    }
  } catch {
    // Ignore storage quota errors
  }
  return initial
}

function setTableData(tableName: string, rows: any[]): void {
  const key = `shoreline_db_${tableName}`
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(rows))
    }
  } catch {
    // Ignore
  }
}

// ── Universal Query Builder ────────────────────────────────────────────────────

class QueryBuilder {
  private tableName: string
  private filters: ((row: any) => boolean)[] = []
  private sortColumn?: string
  private sortAscending = true
  private rowLimit?: number
  private isSingle = false
  private isMaybeSingle = false

  constructor(tableName: string) {
    this.tableName = tableName
  }

  select(_columns = '*'): this {
    return this
  }

  eq(column: string, value: any): this {
    this.filters.push(row => row[column] === value)
    return this
  }

  neq(column: string, value: any): this {
    this.filters.push(row => row[column] !== value)
    return this
  }

  or(filterStr: string): this {
    // e.g. "name.ilike.%search%,room.ilike.%search%"
    const conditions = filterStr.split(',').map(c => c.trim())
    this.filters.push(row => {
      return conditions.some(cond => {
        const parts = cond.split('.')
        if (parts.length >= 3) {
          const col = parts[0]
          const op = parts[1]
          const val = parts.slice(2).join('.').replace(/^%|%$/g, '').toLowerCase()
          const rowVal = String(row[col] ?? '').toLowerCase()
          if (op === 'ilike') return rowVal.includes(val)
          if (op === 'eq') return rowVal === val
        }
        return false
      })
    })
    return this
  }

  order(column: string, opts: { ascending?: boolean } = {}): this {
    this.sortColumn = column
    this.sortAscending = opts.ascending ?? true
    return this
  }

  limit(count: number): this {
    this.rowLimit = count
    return this
  }

  single(): Promise<{ data: any; error: any }> {
    this.isSingle = true
    return this.exec()
  }

  maybeSingle(): Promise<{ data: any; error: any }> {
    this.isMaybeSingle = true
    return this.exec()
  }

  insert(rowOrRows: any): this & Promise<{ data: any; error: any }> {
    const existing = getTableData(this.tableName)
    const newItems = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
    const created = newItems.map(item => ({
      id: item.id || `gen_${Math.random().toString(36).slice(2, 10)}`,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item,
    }))
    const updated = [...existing, ...created]
    setTableData(this.tableName, updated)
    const result = Array.isArray(rowOrRows) ? created : created[0]
    
    // Store result so subsequent .select().single() returns it
    this.filters = [() => false] // no-op filter
    this.exec = async () => ({ data: result, error: null })
    return this as any
  }

  upsert(rowOrRows: any): this & Promise<{ data: any; error: any }> {
    const existing = getTableData(this.tableName)
    const newItems = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
    const ids = new Set(newItems.map(i => i.id).filter(Boolean))
    const filtered = existing.filter(r => !ids.has(r.id))
    const created = newItems.map(item => ({
      id: item.id || `gen_${Math.random().toString(36).slice(2, 10)}`,
      created_at: item.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item,
    }))
    setTableData(this.tableName, [...filtered, ...created])
    const result = Array.isArray(rowOrRows) ? created : created[0]
    this.exec = async () => ({ data: result, error: null })
    return this as any
  }

  private isUpdate = false
  private updatePatch: any = null
  private isDelete = false

  update(patch: any): this & Promise<{ data: any; error: any }> {
    this.isUpdate = true
    this.updatePatch = patch
    return this as any
  }

  delete(): this & Promise<{ data: any; error: any }> {
    this.isDelete = true
    return this as any
  }

  async exec(): Promise<{ data: any; error: any }> {
    let rows = getTableData(this.tableName)
    if (this.isUpdate && this.updatePatch) {
      let modifiedRow: any = null
      const updated = rows.map(row => {
        const match = this.filters.length === 0 || this.filters.every(f => f(row))
        if (match) {
          modifiedRow = { ...row, ...this.updatePatch, updated_at: new Date().toISOString() }
          return modifiedRow
        }
        return row
      })
      setTableData(this.tableName, updated)
      return { data: modifiedRow, error: null }
    }
    if (this.isDelete) {
      const remaining = rows.filter(row => !this.filters.every(f => f(row)))
      setTableData(this.tableName, remaining)
      return { data: null, error: null }
    }
    for (const f of this.filters) {
      rows = rows.filter(f)
    }
    if (this.sortColumn) {
      const col = this.sortColumn
      const asc = this.sortAscending
      rows.sort((a, b) => {
        const valA = a[col] ?? ''
        const valB = b[col] ?? ''
        if (valA < valB) return asc ? -1 : 1
        if (valA > valB) return asc ? 1 : -1
        return 0
      })
    }
    if (this.rowLimit !== undefined) {
      rows = rows.slice(0, this.rowLimit)
    }
    if (this.isSingle) {
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: 'Row not found' } }
    }
    if (this.isMaybeSingle) {
      return { data: rows[0] ?? null, error: null }
    }
    return { data: rows, error: null }
  }

  then(onfulfilled?: ((value: { data: any; error: any }) => any) | null, onrejected?: ((reason: any) => any) | null): Promise<any> {
    return this.exec().then(onfulfilled, onrejected)
  }
}

// ── Exported Supabase Emulator Instance ─────────────────────────────────────────

export const supabase = {
  from(tableName: string) {
    return new QueryBuilder(tableName)
  },
  auth: {
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'mock-path' }, error: null }),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `/uploads/${path}` } }),
    }),
  },
} as any

