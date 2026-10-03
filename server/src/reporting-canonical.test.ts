import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import jwt from 'jsonwebtoken'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

// Private disposable database: the pool module reads these at import time,
// so they are set here before the dynamic imports in setup() below.
const directory = mkdtempSync(path.join(os.tmpdir(), 'shoreline-reporting-canonical-'))
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(directory, 'reporting.sqlite')
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'synthetic-reporting-canonical-secret-32-chars!'
}

interface FixtureContext {
  base: string
  managerToken: string
  distributorToken: string
  close: () => Promise<void>
}

let ctx: FixtureContext | null = null

async function setup(): Promise<FixtureContext> {
  if (ctx) return ctx
  const { runMigrations } = await import('./db/migrate')
  const { pool } = await import('./db/pool')
  const { requireAuth } = await import('./middleware/requireAuth')
  const { reportingRouter } = await import('./routes/reporting')
  await runMigrations()

  // Canonical residents: two Active (one plain, one therapeutic/allergic),
  // one Hospital and one LOA excluded from every census-derived count.
  await pool.query(
    `INSERT INTO residents (id, name, room, status, diet_type, texture, allergies, ensure_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ['res-active-plain', 'Alice Active', '101', 'Active', 'Regular', 'Regular', [], 0]
  )
  await pool.query(
    `INSERT INTO residents (id, name, room, status, diet_type, texture, allergies, ensure_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ['res-active-clinical', 'Bob Texture', '102', 'Active', 'Cardiac (Low Sodium)', 'Minced & Moist', ['Peanut'], 1]
  )
  await pool.query(
    `INSERT INTO residents (id, name, room, status, diet_type, texture, allergies, ensure_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ['res-hospital', 'Cara Hospital', '103', 'Hospital', 'Regular', 'Regular', [], 0]
  )
  await pool.query(
    `INSERT INTO residents (id, name, room, status, diet_type, texture, allergies, ensure_per_day)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    ['res-loa', 'Dan Loa', '104', 'LOA', 'Regular', 'Pureed', [], 0]
  )

  await pool.query(
    `INSERT INTO daily_cost_log (log_date, resident_count, food_cost, notes)
     VALUES ($1, $2, $3, $4)`,
    ['2026-09-10', 50, 500, 'manual entry']
  )
  await pool.query(
    `INSERT INTO daily_cost_log (log_date, resident_count, food_cost, notes)
     VALUES ($1, $2, $3, $4)`,
    ['2026-09-20', 50, 600, '[auto-rollup] menu-slot costing']
  )

  await pool.query(
    `INSERT INTO substitution_log (resident_id, meal_date, meal_type, original_item, substitute_item, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['res-active-clinical', '2026-09-10', 'Lunch', 'Milk', 'Lactose-free milk', 'intolerance']
  )
  await pool.query(
    `INSERT INTO substitution_log (resident_id, meal_date, meal_type, original_item, substitute_item, reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['res-active-plain', '2026-09-20', 'Dinner', 'Roll', 'Gluten-free roll', 'preference']
  )

  await pool.query(
    `INSERT INTO timecard_punches (badge_id, operation, kiosk_id, punched_at)
     VALUES ($1, $2, $3, $4)`,
    ['BADGE-01', 'In', 'Hot Line Kiosk', '2026-09-20 08:00:00']
  )
  await pool.query(
    `INSERT INTO timecard_punches (badge_id, operation, kiosk_id, punched_at)
     VALUES ($1, $2, $3, $4)`,
    ['BADGE-01', 'Out', 'Hot Line Kiosk', '2026-09-20 16:00:00']
  )

  await pool.query(
    `INSERT INTO menu_weeks (id, name, effective_from, days, active)
     VALUES ($1, $2, $3, $4, $5)`,
    ['week-1', 'Fixture Week', '2026-09-07', '{}', 1]
  )
  await pool.query(
    `INSERT INTO production_sheets (id, menu_week_id, day, slot, rows, counts)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['sheet-early', 'week-1', '2026-09-10', 'Lunch',
      JSON.stringify([{ menuItemId: 'm-1', menuItemName: 'Baked Chicken', total: 42, projectedPortions: 40 }]),
      JSON.stringify({ total: 50 })]
  )
  await pool.query(
    `INSERT INTO production_sheets (id, menu_week_id, day, slot, rows, counts)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['sheet-late', 'week-1', '2026-09-20', 'Dinner',
      JSON.stringify([{ menuItemId: 'm-2', menuItemName: 'Beef Stew', total: 55 }]),
      JSON.stringify({ total: 60 })]
  )

  const app = express()
  app.use(express.json())
  app.use('/api/reporting', requireAuth, reportingRouter)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'error' })
  })
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const sign = (sub: string, role: string): string => jwt.sign(
    { sub, role, purpose: 'access', mfa: false, facilityId: 'default', platformAdmin: false },
    process.env.JWT_SECRET as string,
    { algorithm: 'HS256', audience: 'shoreline-api', expiresIn: '1h' }
  )
  ctx = {
    base,
    managerToken: sign('synthetic-manager', 'manager'),
    distributorToken: sign('synthetic-vendor', 'distributor'),
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await pool.end()
    },
  }
  return ctx
}

async function get(pathname: string, token: string): Promise<Response> {
  const { base } = await setup()
  return fetch(base + pathname, { headers: { authorization: `Bearer ${token}` } })
}

test('summary aggregates the Active census and dated cost/substitution fixtures', async () => {
  const { managerToken } = await setup()
  const res = await get('/api/reporting/summary?start=2026-09-01&end=2026-09-30', managerToken)
  const text = await res.text()
  assert.equal(res.status, 200, text.slice(0, 500))
  const body = JSON.parse(text) as any
  assert.equal(body.activeResidents, 2)
  assert.equal(body.totalFoodCost, '1100.00')
  assert.equal(body.totalResidentDays, 100)
  assert.equal(body.costPerResidentDay, '11.00')
  assert.deepEqual(body.costSourceCounts, { rolledUpDays: 1, manualDays: 1 })
  assert.equal(body.substitutions, 2)
  assert.equal(body.allergyFlagCount, 1)
  assert.equal(body.specialDietCount, 1)
  assert.equal(body.estimatedLaborHours, 8)
})

test('cost-log and substitution date filters return the in-range rows with canonical joins', async () => {
  const { managerToken } = await setup()

  const cost = await get('/api/reporting/cost-log?start=2026-09-15&end=2026-09-25', managerToken)
  assert.equal(cost.status, 200)
  const costRows = (await cost.json()) as any[]
  assert.equal(costRows.length, 1)
  assert.equal(costRows[0].log_date, '2026-09-20')
  assert.equal(costRows[0].source, 'auto')

  const subs = await get('/api/reporting/substitutions?start=2026-09-15&end=2026-09-25', managerToken)
  assert.equal(subs.status, 200)
  const subRows = (await subs.json()) as any[]
  assert.equal(subRows.length, 1)
  assert.equal(subRows[0].resident_name, 'Alice Active')
  assert.equal(subRows[0].original_item, 'Roll')
  assert.equal(subRows[0].substitute_item, 'Gluten-free roll')
})

test('production variance returns actual planned counts with the canonical schema keys', async () => {
  const { managerToken } = await setup()

  const all = await get('/api/reporting/production-variance', managerToken)
  assert.equal(all.status, 200)
  const entries = (await all.json()) as any[]
  assert.equal(entries.length, 2)
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(),
      ['date', 'id', 'item_name', 'meal_type', 'planned', 'produced', 'variancePct'].sort())
  }
  const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]))
  assert.equal(byId['sheet-early:m-1'].planned, 42)
  assert.equal(byId['sheet-early:m-1'].item_name, 'Baked Chicken')
  assert.equal(byId['sheet-early:m-1'].date, '2026-09-10')
  assert.equal(byId['sheet-early:m-1'].meal_type, 'Lunch')
  assert.equal(byId['sheet-late:m-2'].planned, 55)
  assert.equal(byId['sheet-late:m-2'].item_name, 'Beef Stew')
  // Produced counts are honestly null until actual cooked counts are recorded.
  assert.equal(byId['sheet-late:m-2'].produced, null)
  assert.equal(byId['sheet-late:m-2'].variancePct, null)

  const filtered = await get('/api/reporting/production-variance?start=2026-09-15&end=2026-09-25', managerToken)
  assert.equal(filtered.status, 200)
  const filteredEntries = (await filtered.json()) as any[]
  assert.equal(filteredEntries.length, 1)
  assert.equal(filteredEntries[0].id, 'sheet-late:m-2')
  assert.equal(filteredEntries[0].planned, 55)
})

test('clinical risk reports use canonical diet/texture/allergy columns', async () => {
  const { managerToken } = await setup()

  const allergy = await get('/api/reporting/allergy-risk', managerToken)
  assert.equal(allergy.status, 200)
  const risk = (await allergy.json()) as any[]
  assert.equal(risk.length, 1)
  assert.equal(risk[0].name, 'Bob Texture')
  assert.equal(risk[0].first_name, 'Bob')
  assert.equal(risk[0].last_name, 'Texture')
  assert.deepEqual(risk[0].allergies, ['Peanut'])

  const mismatch = await get('/api/reporting/diet-mismatches', managerToken)
  assert.equal(mismatch.status, 200)
  const mismatches = (await mismatch.json()) as any[]
  assert.equal(mismatches.length, 1)
  assert.equal(mismatches[0].name, 'Bob Texture')
  assert.deepEqual(mismatches[0].supplements, ['Ensure (1/day)'])
  assert.equal(mismatches[0].ensurePerDay, 1)
})

test('reporting denies vendor access without leaking data', async () => {
  const { distributorToken } = await setup()
  for (const pathname of ['/api/reporting/summary', '/api/reporting/cost-log', '/api/reporting/production-variance', '/api/reporting/allergy-risk']) {
    const denied = await get(pathname, distributorToken)
    assert.equal(denied.status, 403, `expected distributor to be denied ${pathname}`)
  }
})

after(async () => {
  if (ctx) {
    await ctx.close()
    ctx = null
  }
})
