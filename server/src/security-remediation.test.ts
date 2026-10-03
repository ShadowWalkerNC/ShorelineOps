import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import jwt from 'jsonwebtoken'
import type { AddressInfo } from 'node:net'
import { pool } from './db/pool'
import { requireAuth, type ApiRole } from './middleware/requireAuth'
import { residentsRouter } from './routes/residents'
import { kitchenRouter } from './routes/kitchen'
import { reportingRouter } from './routes/reporting'
import { hardwareRouter } from './routes/hardware'
import { productionRouter } from './routes/production'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'synthetic-security-remediation-test-secret-32!'
}

function tokenFor(role: ApiRole, sub = 'synthetic-user', facilityId = 'FAC-TEST'): string {
  return jwt.sign(
    { sub, role, purpose: 'access', mfa: false, facilityId, platformAdmin: false },
    process.env.JWT_SECRET as string,
    { algorithm: 'HS256', audience: 'shoreline-api', expiresIn: '1h' }
  )
}

// The pool is fully mocked: denied requests must fail before any database
// access, and allowed requests run against synthetic rows. No real facility
// data is touched; the real database driver is never reached.
let seen: string[] = []
let writes = 0
let respond: (sql: string, params: any[]) => { rows: any[] } = () => ({ rows: [] })

const originalQuery = pool.query
const originalConnect = pool.connect

function resetMock(impl?: (sql: string, params: any[]) => { rows: any[] }): void {
  seen = []
  writes = 0
  respond = impl ?? (() => ({ rows: [] }))
}

let base = ''
let server: http.Server | null = null

before(async () => {
  pool.query = (async (sql: string, params: any[] = []) => {
    seen.push(String(sql))
    if (/^\s*(INSERT|UPDATE|DELETE)/i.test(String(sql))) writes++
    return respond(String(sql), params)
  }) as typeof pool.query
  pool.connect = (async () => {
    throw new Error('denied path must not open a transaction')
  }) as typeof pool.connect

  const app = express()
  app.use(express.json())
  app.use('/api/residents', requireAuth, residentsRouter)
  app.use('/api/kitchen', requireAuth, kitchenRouter)
  app.use('/api/reporting', requireAuth, reportingRouter)
  app.use('/api/hardware', requireAuth, hardwareRouter)
  app.use('/api/production', requireAuth, productionRouter)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'error' })
  })
  server = http.createServer(app)
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  pool.query = originalQuery
  pool.connect = originalConnect
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()))
})

async function request(method: string, path: string, role: ApiRole | null, body?: unknown, extraHeaders?: Record<string, string>): Promise<Response> {
  const headers: Record<string, string> = { ...(extraHeaders ?? {}) }
  if (role) headers['authorization'] = `Bearer ${tokenFor(role)}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  return fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}

test('clinical CSV import is dietitian/manager-only; admin is denied without side effects', async () => {
  const payload = { csv: 'name,room,diet\nAlice Active,101,Regular' }

  for (const role of ['dietitian', 'manager'] as const) {
    resetMock()
    const allowed = await request('POST', '/api/residents/import-csv', role, payload)
    assert.equal(allowed.status, 200, `expected ${role} to import, got ${allowed.status}: ${await allowed.clone().text()}`)
  }

  for (const role of ['admin', 'frontdesk', 'dietary', 'activities', 'server', 'staff', 'readonly', 'distributor'] as const) {
    resetMock()
    const denied = await request('POST', '/api/residents/import-csv', role, payload)
    assert.equal(denied.status, 403, `expected ${role} to be denied import`)
    assert.deepEqual(seen, [], `denied ${role} import must not query`)
    assert.equal(writes, 0)
  }

  resetMock()
  const anonymous = await request('POST', '/api/residents/import-csv', null, payload)
  assert.equal(anonymous.status, 401)
  assert.deepEqual(seen, [])
})

test('signed tray generator requires kitchen execution/printing capability (readonly/activities denied)', async () => {
  const emptyDb = () => ({ rows: [] })

  for (const role of ['admin', 'manager', 'dietitian', 'dietary', 'server', 'staff'] as const) {
    resetMock(emptyDb)
    const allowed = await request('GET', '/api/kitchen/traycards-generated?mealSlot=Dinner', role)
    assert.equal(allowed.status, 200, `expected ${role} to generate trays, got ${allowed.status}: ${await allowed.clone().text()}`)
    const body = (await allowed.json()) as any
    assert.ok(Array.isArray(body.trayCards))
  }

  for (const role of ['frontdesk', 'activities', 'readonly', 'distributor'] as const) {
    resetMock(emptyDb)
    const denied = await request('GET', '/api/kitchen/traycards-generated?mealSlot=Dinner', role)
    assert.equal(denied.status, 403, `expected ${role} to be denied the signed generator`)
    assert.deepEqual(seen, [], `denied ${role} generator must not query`)
  }
})

test('legacy hardware print is disabled with explicit 503 after the capability gate', async () => {
  for (const role of ['admin', 'manager', 'dietitian', 'dietary', 'server', 'staff'] as const) {
    resetMock()
    const first = await request('POST', '/api/hardware/print/tray-card', role,
      { residentId: 'res-1', directPrint: true }, { 'idempotency-key': `print-${role}` })
    assert.equal(first.status, 503, `expected ${role} to get 503`)
    const body = (await first.json()) as any
    assert.equal(body.code, 'HARDWARE_PRINT_UNAVAILABLE')
    assert.match(String(body.canonical ?? ''), /traycards-generated/)
    assert.match(String(body.guidance ?? ''), /traycards-generated/)
    assert.deepEqual(seen, [], 'disabled print must not touch the database')
    assert.equal(writes, 0)
    assert.equal(first.headers.get('x-idempotency-replay'), null)
    // No idempotency machinery on the disabled path: a repeat is a fresh 503.
    const second = await request('POST', '/api/hardware/print/tray-card', role,
      { residentId: 'res-1' }, { 'idempotency-key': `print-${role}` })
    assert.equal(second.status, 503)
    assert.equal(second.headers.get('x-idempotency-replay'), null)
    assert.deepEqual(seen, [])
  }

  for (const role of ['frontdesk', 'activities', 'readonly', 'distributor'] as const) {
    resetMock()
    const denied = await request('POST', '/api/hardware/print/tray-card', role, { residentId: 'res-1' })
    assert.equal(denied.status, 403, `expected ${role} to be denied print`)
    assert.deepEqual(seen, [])
  }
})

const residentRow = {
  id: 'res-1',
  name: 'Alice Active',
  room: '101',
  status: 'Active',
  diet_type: 'Cardiac (Low Sodium)',
  texture: 'Minced & Moist',
  portion_size: 'Regular',
  ensure_per_day: 1,
  allergies: ['Peanut'],
  beverages: ['Water'],
  birthday_month: 'March',
  birthday_day: 4,
  serving_location: 'Dining Room',
  table_assignment: 'A1',
  likes: 'Pie',
  dislikes: 'Fish',
  special_instructions: 'Cut food small',
  is_npo: 0,
  npo_reason: '',
  fluid_restriction_ml: 1500,
  profile_version: 3,
  diet_ordered_by: 'dietitian-1',
  diet_order_date: '2026-09-01',
  diet_effective_date: '2026-09-02',
}

const historyRow = {
  id: 'hist-1',
  resident_id: 'res-1',
  profile_version: 3,
  diet_type: 'Cardiac (Low Sodium)',
  texture: 'Minced & Moist',
  is_npo: 0,
  allergies: ['Peanut'],
  created_at: '2026-09-02T00:00:00.000Z',
}

function residentDb(sql: string): { rows: any[] } {
  if (/FROM resident_profile_history/i.test(sql)) return { rows: [historyRow] }
  if (/FROM residents/i.test(sql)) return { rows: [residentRow] }
  return { rows: [] }
}

test('resident projections carry safety fields without private demographics; history is clinical-only', async () => {
  resetMock(residentDb)
  const full = await request('GET', '/api/residents/res-1', 'dietitian')
  assert.equal(full.status, 200)
  const fullBody = (await full.json()) as any
  assert.equal(fullBody.likes, 'Pie')
  assert.equal(fullBody.birthdayMonth, 'March')
  assert.equal(fullBody.specialInstructions, 'Cut food small')
  assert.equal(fullBody.dietOrderedBy, 'dietitian-1')
  assert.deepEqual(fullBody.allergies, ['Peanut'])

  // Food-service execution roles get the service-critical projection.
  for (const role of ['dietary', 'server', 'staff', 'frontdesk', 'activities', 'readonly'] as const) {
    resetMock(residentDb)
    const projected = await request('GET', '/api/residents/res-1', role)
    assert.equal(projected.status, 200, `expected ${role} to read the projection`)
    const body = (await projected.json()) as any
    assert.equal(body.isNpo, false)
    assert.equal(body.fluidRestrictionMl, 1500)
    assert.equal(body.profileVersion, 3)
    assert.deepEqual(body.allergies, ['Peanut'])
    for (const privateField of ['likes', 'dislikes', 'birthdayMonth', 'birthdayDay', 'specialInstructions', 'dietOrderedBy', 'dietOrderDate', 'dietEffectiveDate']) {
      assert.ok(!(privateField in body), `${role} projection must not include ${privateField}`)
    }
  }

  resetMock(residentDb)
  const list = await request('GET', '/api/residents', 'server')
  assert.equal(list.status, 200)
  const listBody = (await list.json()) as any[]
  assert.equal(listBody.length, 1)
  assert.ok(!('likes' in listBody[0]), 'list projection must not include private fields')
  assert.deepEqual(listBody[0].allergies, ['Peanut'])

  // Distributors hold no resident capability: no PHI of any shape.
  resetMock(residentDb)
  const vendor = await request('GET', '/api/residents/res-1', 'distributor')
  assert.equal(vendor.status, 403)
  assert.deepEqual(seen, [])

  // Diet history is full-clinical-readers only.
  for (const role of ['dietitian', 'manager', 'admin'] as const) {
    resetMock(residentDb)
    const history = await request('GET', '/api/residents/res-1/history', role)
    assert.equal(history.status, 200, `expected ${role} to read history`)
    assert.equal(((await history.json()) as any[]).length, 1)
  }
  for (const role of ['frontdesk', 'dietary', 'activities', 'server', 'staff', 'readonly', 'distributor'] as const) {
    resetMock(residentDb)
    const denied = await request('GET', '/api/residents/res-1/history', role)
    assert.equal(denied.status, 403, `expected ${role} to be denied history`)
    assert.deepEqual(seen, [], `denied ${role} history must not query`)
  }
})

const periodRow = {
  id: 'period-1', label: 'September 2026', month: 9, year: 2026,
  total_budget: 17100, resident_count: 60, budget_per_resident_per_day: 9.5,
  start_date: '2026-09-01', end_date: '2026-09-30', created_at: '2026-09-01T00:00:00.000Z',
}

const entryRow = {
  id: 'entry-1', period_id: 'period-1', date: '2026-09-18', vendor: 'Dennis',
  description: 'Delivery', amount: 1450.25, category: 'Food',
  invoice_ref: 'INV-1', logged_by: 'manager-1', created_at: '2026-09-18T00:00:00.000Z',
}

function budgetDb(sql: string): { rows: any[] } {
  if (/FROM budget_periods/i.test(sql)) return { rows: [periodRow] }
  if (/FROM budget_entries/i.test(sql)) return { rows: [entryRow] }
  return { rows: [] }
}

test('reporting budget writes are manager/admin-only; finance detail reads are manager/admin-only', async () => {
  const periodPayload = { label: 'September 2026', month: 9, year: 2026, totalBudget: 17100, residentCount: 60 }

  for (const role of ['manager', 'admin'] as const) {
    resetMock(budgetDb)
    const created = await request('POST', '/api/reporting/budget-periods', role, periodPayload)
    assert.equal(created.status, 201, `expected ${role} to create a budget period`)
  }
  for (const role of ['dietitian', 'frontdesk', 'dietary', 'activities', 'server', 'staff', 'readonly', 'distributor'] as const) {
    resetMock(budgetDb)
    const denied = await request('POST', '/api/reporting/budget-periods', role, periodPayload)
    assert.equal(denied.status, 403, `expected ${role} to be denied budget-period write`)
    assert.deepEqual(seen, [])
    assert.equal(writes, 0)
  }

  resetMock(budgetDb)
  const entryDenied = await request('PUT', '/api/reporting/budget-entries/entry-1', 'dietitian', { amount: 10 })
  assert.equal(entryDenied.status, 403)
  assert.deepEqual(seen, [])
  resetMock(budgetDb)
  const entryUpdated = await request('PUT', '/api/reporting/budget-entries/entry-1', 'manager', { amount: 10 })
  assert.equal(entryUpdated.status, 200)

  resetMock(budgetDb)
  const deleteDenied = await request('DELETE', '/api/reporting/budget-entries/entry-1', 'staff')
  assert.equal(deleteDenied.status, 403)
  assert.deepEqual(seen, [])
  resetMock(budgetDb)
  const deleted = await request('DELETE', '/api/reporting/budget-entries/entry-1', 'admin')
  assert.equal(deleted.status, 204)

  // Least-privilege finance detail: budget-period reads are manager/admin-only.
  for (const role of ['manager', 'admin'] as const) {
    resetMock(budgetDb)
    const readable = await request('GET', '/api/reporting/budget-periods', role)
    assert.equal(readable.status, 200, `expected ${role} to read budget periods`)
    assert.ok(seen.length > 0)
  }
  for (const role of ['dietitian', 'frontdesk', 'dietary', 'activities', 'server', 'staff', 'readonly', 'distributor'] as const) {
    resetMock(budgetDb)
    const denied = await request('GET', '/api/reporting/budget-periods', role)
    assert.equal(denied.status, 403, `expected ${role} to be denied budget reads`)
    assert.deepEqual(seen, [], `denied ${role} budget read must not query`)
  }

  // Clinical reporting is clinical-readers only; vendors see no reporting PHI.
  resetMock(() => ({ rows: [] }))
  const clinical = await request('GET', '/api/reporting/allergy-risk', 'dietitian')
  assert.equal(clinical.status, 200)
  for (const role of ['readonly', 'frontdesk', 'distributor', 'server'] as const) {
    resetMock(() => ({ rows: [] }))
    const denied = await request('GET', '/api/reporting/allergy-risk', role)
    assert.equal(denied.status, 403, `expected ${role} to be denied allergy-risk`)
    assert.deepEqual(seen, [])
  }
  for (const path of ['/summary', '/cost-log', '/substitutions', '/production-variance', '/diet-mismatches', '/haccp-temperature-log', '/budget-entries']) {
    resetMock(() => ({ rows: [] }))
    const denied = await request('GET', `/api/reporting${path}`, 'distributor')
    assert.equal(denied.status, 403, `expected distributor to be denied ${path}`)
    assert.deepEqual(seen, [], `distributor denial on ${path} must not query`)
  }
})

const substitutionRow = {
  id: 'sub-1',
  resident_id: 'res-1',
  meal_date: '2026-09-20',
  meal_type: 'Lunch',
  original_item: 'Milk',
  substitute_item: 'Lactose-free milk',
  reason: 'lactose intolerance — resident reports GI history, avoid dairy allergen',
  logged_by: 'dietary-1',
  created_at: '2026-09-20T12:00:00.000Z',
  resident_name: 'Alice Active',
  room: '101',
  logged_by_name: 'Dana Dietary',
}

function substitutionDb(sql: string): { rows: any[] } {
  if (/FROM substitution_log/i.test(sql)) return { rows: [substitutionRow] }
  return { rows: [] }
}

test('substitution full-detail reads are clinical-only; denials precede any DB query', async () => {
  for (const role of ['admin', 'manager', 'dietitian'] as const) {
    resetMock(substitutionDb)
    const allowed = await request('GET', '/api/reporting/substitutions', role)
    assert.equal(allowed.status, 200, `expected ${role} to read substitutions, got ${allowed.status}: ${await allowed.clone().text()}`)
    const body = (await allowed.json()) as any[]
    assert.equal(body.length, 1)
    assert.equal(body[0].resident_name, 'Alice Active')
    assert.equal(body[0].room, '101')
    assert.equal(body[0].original_item, 'Milk')
    assert.equal(body[0].substitute_item, 'Lactose-free milk')
    assert.match(String(body[0].reason ?? ''), /intolerance/)
    assert.ok(seen.length > 0)
  }

  for (const role of ['readonly', 'frontdesk', 'staff', 'distributor', 'dietary', 'server', 'activities'] as const) {
    resetMock(substitutionDb)
    const denied = await request('GET', '/api/reporting/substitutions', role)
    assert.equal(denied.status, 403, `expected ${role} to be denied substitutions`)
    assert.deepEqual(seen, [], `denied ${role} substitutions must not query`)
  }
})

function costLogDb(sql: string): { rows: any[] } {
  if (/FROM daily_cost_log/i.test(sql)) {
    return { rows: [{ log_date: '2026-09-20', resident_count: 50, food_cost: 600, notes: 'manual entry', created_by: 'manager-1', logged_by_name: 'Mara Manager' }] }
  }
  return { rows: [] }
}

function summaryDb(sql: string): { rows: any[] } {
  if (/FROM daily_cost_log/i.test(sql)) {
    if (/auto_days/i.test(sql)) return { rows: [{ auto_days: '1', manual_days: '1' }] }
    return { rows: [{ total_food_cost: '1100', total_resident_days: '100', log_days: '2' }] }
  }
  if (/FROM substitution_log/i.test(sql)) return { rows: [{ cnt: '2' }] }
  if (/SELECT allergies FROM residents/i.test(sql)) return { rows: [{ allergies: ['Peanut'] }, { allergies: [] }] }
  if (/FROM residents/i.test(sql)) {
    if (/texture/i.test(sql)) return { rows: [{ cnt: '1' }] }
    return { rows: [{ cnt: '2' }] }
  }
  if (/FROM timecard_punches/i.test(sql)) return { rows: [{ total_punches: '2' }] }
  return { rows: [] }
}

function complianceDb(sql: string): { rows: any[] } {
  if (/FROM daily_cost_log/i.test(sql)) return { rows: [{ total: '1100', days: '100' }] }
  if (/FROM substitution_log/i.test(sql)) return { rows: [{ cnt: '2' }] }
  if (/SELECT allergies FROM residents/i.test(sql)) return { rows: [{ allergies: ['Peanut'] }] }
  if (/FROM residents/i.test(sql)) return { rows: [{ cnt: '1' }] }
  return { rows: [] }
}

test('finance detail reads are manager/admin-only; aggregate reporting stays ops-readable', async () => {
  const financeEndpoints: Array<{ path: string; mock: (sql: string) => { rows: any[] } }> = [
    { path: '/api/reporting/cost-log', mock: costLogDb },
    { path: '/api/reporting/cpd-breakdown?date=2026-09-20', mock: () => ({ rows: [] }) },
    { path: '/api/reporting/budget-periods', mock: budgetDb },
    { path: '/api/reporting/budget-entries', mock: budgetDb },
  ]

  for (const { path, mock } of financeEndpoints) {
    for (const role of ['manager', 'admin'] as const) {
      resetMock(mock)
      const allowed = await request('GET', path, role)
      assert.equal(allowed.status, 200, `expected ${role} to read ${path}, got ${allowed.status}: ${await allowed.clone().text()}`)
      assert.ok(seen.length > 0, `allowed ${role} read on ${path} must query`)
    }
    for (const role of ['dietitian', 'frontdesk', 'dietary', 'staff', 'readonly', 'server', 'activities', 'distributor'] as const) {
      resetMock(mock)
      const denied = await request('GET', path, role)
      assert.equal(denied.status, 403, `expected ${role} to be denied ${path}`)
      assert.deepEqual(seen, [], `denied ${role} on ${path} must not query`)
    }
  }

  // Finance line detail keeps its contract for finance readers.
  resetMock(costLogDb)
  const cost = await request('GET', '/api/reporting/cost-log', 'manager')
  assert.equal(cost.status, 200)
  const costBody = (await cost.json()) as any[]
  assert.equal(costBody[0].source, 'manual')
  resetMock(budgetDb)
  const entries = await request('GET', '/api/reporting/budget-entries', 'admin')
  assert.equal(entries.status, 200)
  assert.equal(((await entries.json()) as any[])[0].vendor, 'Dennis')

  // Aggregates stay ops-readable: readonly still sees summary/compliance/variance.
  resetMock(summaryDb)
  const summary = await request('GET', '/api/reporting/summary?start=2026-09-01&end=2026-09-30', 'readonly')
  assert.equal(summary.status, 200, `expected readonly to read summary: ${await summary.clone().text()}`)
  resetMock(complianceDb)
  const compliance = await request('GET', '/api/reporting/compliance-summary', 'readonly')
  assert.equal(compliance.status, 200, `expected readonly to read compliance-summary: ${await compliance.clone().text()}`)
  resetMock(() => ({ rows: [] }))
  const variance = await request('GET', '/api/reporting/production-variance', 'readonly')
  assert.equal(variance.status, 200)
  assert.deepEqual((await variance.json()) as any[], [])

  // Vendors still see no aggregate reporting.
  resetMock(complianceDb)
  const vendorCompliance = await request('GET', '/api/reporting/compliance-summary', 'distributor')
  assert.equal(vendorCompliance.status, 403)
  assert.deepEqual(seen, [])
})

test('clinical regressions preserved: NPO hydration block and diet-order role guard', async () => {
  // NPO hard block: fluids can never be logged for an NPO resident.
  resetMock((sql) => /FROM residents/i.test(sql)
    ? { rows: [{ id: 'npo-1', name: 'Npo Patient', status: 'Active', is_npo: 1 }] }
    : { rows: [] })
  const blocked = await request('POST', '/api/kitchen/hydration', 'dietary',
    { residentId: 'npo-1', pass: 'morning', offeredOz: 8, consumedOz: 4 })
  assert.equal(blocked.status, 403)
  assert.ok(!seen.some((sql) => /INSERT INTO hydration_records/i.test(sql)), 'NPO block must not persist fluids')
  assert.equal(writes, 0)

  // Admin holds demographic write but no clinical diet authority: the
  // in-handler field guard still refuses diet changes without updating.
  resetMock((sql) => /FROM residents/i.test(sql)
    ? { rows: [{ diet_type: 'Regular', texture: 'Regular', allergies: [], is_npo: 0, npo_reason: '', profile_version: 1 }] }
    : { rows: [] })
  const refused = await request('PUT', '/api/residents/res-1', 'admin', { dietType: 'Renal' })
  assert.equal(refused.status, 403)
  assert.ok(!seen.some((sql) => /UPDATE residents/i.test(sql)), 'refused diet order must not update')
})

test('production planning gates: writes exclude servers/frontdesk/vendors; delete is admin-only', async () => {
  const sheetPayload = { menuWeekId: 'week-1', day: '2026-09-20', slot: 'Dinner', rows: [], counts: {} }
  const sheetRow = {
    id: 'sheet-1', menu_week_id: 'week-1', day: '2026-09-20', slot: 'Dinner',
    rows: '[]', counts: '{}', signed_off_by: null, signed_off_at: null,
    created_at: '2026-09-20T00:00:00.000Z', updated_at: '2026-09-20T00:00:00.000Z',
  }

  for (const role of ['server', 'frontdesk', 'readonly', 'distributor', 'activities'] as const) {
    resetMock()
    const denied = await request('POST', '/api/production/sheets', role, sheetPayload)
    assert.equal(denied.status, 403, `expected ${role} to be denied sheet write`)
    assert.deepEqual(seen, [])
  }
  resetMock((sql) => /FROM production_sheets/i.test(sql) ? { rows: [sheetRow] } : { rows: [] })
  const created = await request('POST', '/api/production/sheets', 'manager', sheetPayload)
  assert.equal(created.status, 201)

  resetMock()
  const deleteDenied = await request('DELETE', '/api/production/sheets/sheet-1', 'manager')
  assert.equal(deleteDenied.status, 403)
  assert.deepEqual(seen, [])
  resetMock((sql) => /FROM production_sheets/i.test(sql) ? { rows: [{ id: 'sheet-1' }] } : { rows: [] })
  const deleted = await request('DELETE', '/api/production/sheets/sheet-1', 'admin')
  assert.equal(deleted.status, 204)

  resetMock(() => ({ rows: [] }))
  const readable = await request('GET', '/api/production/sheets', 'readonly')
  assert.equal(readable.status, 200)
  resetMock()
  const serverDenied = await request('GET', '/api/production/sheets', 'server')
  assert.equal(serverDenied.status, 403)
  assert.deepEqual(seen, [])
})
