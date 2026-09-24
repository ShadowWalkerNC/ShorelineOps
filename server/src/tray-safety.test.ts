import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'

test('signed trays fail closed and action boundary rechecks current safety', async () => {
  process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'shoreline-tray-')), 'test.db')
  delete process.env.DATABASE_URL
  process.env.JWT_SECRET = 'test-only-tray-secret-at-least-32-characters'
  const { pool } = await import('./db/pool')
  const { signTray, verifyTray, readTray } = await import('./engine/traySafety')
  const { trayrunsRouter } = await import('./routes/trayruns')
  await pool.query('CREATE TABLE residents (id TEXT PRIMARY KEY, name TEXT, room TEXT, status TEXT, profile_version INTEGER, is_npo INTEGER, allergies TEXT, texture TEXT, diet_type TEXT, fluid_restriction_ml INTEGER)')
  await pool.query('CREATE TABLE ehr_reconciliation_queue (id TEXT, resident_id TEXT, status TEXT)')
  await pool.query('CREATE TABLE recipes (name TEXT, allergens TEXT, iddsi_level INTEGER)')
  await pool.query('CREATE TABLE tray_runs (id TEXT PRIMARY KEY, meal_slot TEXT, service_date TEXT)')
  await pool.query('CREATE TABLE tray_events (id TEXT, run_id TEXT, resident_id TEXT, ticket_id TEXT, event TEXT, by TEXT, note TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP)')
  await pool.query('CREATE TABLE audit_log (action TEXT, user_id TEXT, resource_id TEXT, resource_type TEXT, outcome TEXT, details TEXT)')
  await pool.query("INSERT INTO residents VALUES ('r1','Test','1','Active',1,0,'[]','Regular','Regular',NULL)")
  await pool.query("INSERT INTO recipes VALUES ('Rice','[]',7)")
  await pool.query("INSERT INTO tray_runs VALUES ('run1','lunch','2026-09-23')")
  const claims = { residentId: 'r1', ticketId: 'TKT-test', version: 1, diet: 'Regular', texture: 'Regular', allergies: [], foods: ['Rice'], beverages: ['Water'], mealSlot: 'lunch', serviceDate: '2026-09-23' }
  const rawQrPayload = signTray(claims)
  assert.equal((await verifyTray(rawQrPayload)).status, 'VALID')
  assert.equal(readTray(rawQrPayload + 'x'), null)
  assert.equal((await verifyTray('TKT-test:1:fake')).status, 'INVALID_HASH')
  assert.equal((await verifyTray(signTray({ ...claims, version: 2 }))).status, 'SUPERSEDED')
  await pool.query("INSERT INTO ehr_reconciliation_queue VALUES ('q','r1','PENDING_TRIAGE')")
  assert.notEqual((await verifyTray(rawQrPayload)).status, 'VALID')
  await pool.query('DELETE FROM ehr_reconciliation_queue')
  await pool.query("UPDATE recipes SET iddsi_level = 4")
  assert.notEqual((await verifyTray(rawQrPayload)).status, 'VALID')
  await pool.query("UPDATE recipes SET iddsi_level = 7")
  const app = express(); app.use(express.json()); app.use((req: any, _res, next) => { req.userRole = 'staff'; next() }); app.use('/trayruns', trayrunsRouter)
  app.use((err: any, _req: any, res: any, _next: any) => res.status(400).json({ error: err.message }))
  const server = app.listen(0)
  const address = server.address() as { port: number }
  const post = (body: unknown) => fetch(`http://127.0.0.1:${address.port}/trayruns/run1/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    assert.equal((await post({ residentId: 'r1', event: 'assembled' })).status, 400)
    assert.equal((await post({ rawQrPayload, event: 'assembled' })).status, 201)
    await pool.query('UPDATE residents SET is_npo = 1')
    assert.equal((await post({ rawQrPayload, event: 'dispatched' })).status, 409)
    assert.equal((await pool.query('SELECT * FROM tray_events')).rows.length, 1)
    await pool.query('UPDATE residents SET is_npo = 0')
    await pool.query('DROP TABLE ehr_reconciliation_queue')
    await assert.rejects(() => verifyTray(rawQrPayload))
    assert.equal((await post({ rawQrPayload, event: 'dispatched' })).status, 400)
    assert.equal((await pool.query('SELECT * FROM tray_events')).rows.length, 1)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await pool.end() }
})
