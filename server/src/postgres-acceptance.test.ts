import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'

// Multi-client and concurrency acceptance suite.
// Exercises concurrent EHR triage decisions, simultaneous tray card scans against mutating profiles,
// and database version bumps under high contention.
// Runs against isolated SQLite in local/CI environments, and respects DATABASE_URL when a live PostgreSQL instance is configured.

const isPg = Boolean(process.env.DATABASE_URL && /^(postgres|postgresql):\/\//i.test(process.env.DATABASE_URL))

if (!isPg) {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = ''
  process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'shoreline-postgres-acc-')), 'acc.sqlite')
}
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')

after(async () => {
  const { pool } = await import('./db/pool')
  await pool.end()
})

test('database acceptance: tray dispatch after clinical update rejects stale signed card', async () => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { signTray, verifyTray } = await import('./engine/traySafety')
  const { trayrunsRouter } = await import('./routes/trayruns')

  await runMigrations()

  const residentId = crypto.randomUUID()
  const runId = crypto.randomUUID()

  // Seed resident at profile_version = 1
  await pool.query(
    `INSERT INTO residents
       (id, name, room, status, diet_type, texture, portion_size, allergies, is_npo, profile_version)
     VALUES ($1, 'Patient Concurrency Test', 'RM-101', 'Active', 'Regular', 'Regular', 'Regular', $2, false, 1)`,
    [residentId, []]
  )

  await pool.query(
    `INSERT INTO recipes (id, name, allergens, iddsi_level)
     VALUES ($1, 'Roast Turkey', $2, 7)`,
    [crypto.randomUUID(), []]
  )

  await pool.query(
    `INSERT INTO tray_runs (id, meal_slot, service_date, wing)
     VALUES ($1, 'lunch', '2026-10-02', 'North Wing')`,
    [runId]
  )

  // Sign ticket for profile version 1
  const ticketId = 'TKT-CONC-001'
  const claimsV1 = {
    residentId,
    ticketId,
    version: 1,
    diet: 'Regular',
    texture: 'Regular',
    allergies: [],
    foods: ['Roast Turkey'],
    beverages: ['Water'],
    mealSlot: 'lunch',
    serviceDate: '2026-10-02',
  }
  const rawQrPayloadV1 = signTray(claimsV1)

  // Initial verification must be valid
  const check1 = await verifyTray(rawQrPayloadV1)
  assert.equal(check1.status, 'VALID')

  const staffUserId = crypto.randomUUID()
  await pool.query(
    'INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)',
    [staffUserId, 'Staff Scanner', 'staff@example.invalid', 'unused', 'staff']
  )

  // Setup Express app
  const app = express()
  app.use(express.json())
  app.use((req: any, _res, next) => {
    req.userRole = 'staff'
    req.userId = staffUserId
    next()
  })
  app.use('/api/trayruns', trayrunsRouter)
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('[TEST APP ERROR]', err)
    res.status(err.status || 500).json({ error: err.message })
  })

  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const port = (server.address() as { port: number }).port
  const base = `http://127.0.0.1:${port}/api/trayruns`

  try {
    // 1. First event: assemble tray with V1 card
    const resAssemble = await fetch(`${base}/${runId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawQrPayload: rawQrPayloadV1, event: 'assembled' }),
    })
    assert.equal(resAssemble.status, 201)

    // 2. Clinical update: Resident is placed NPO concurrently by Dietitian (profile_version bumped to 2)
    await pool.query(
      `UPDATE residents
       SET is_npo = true, npo_reason = 'Scheduled Endoscopy', profile_version = 2, updated_at = NOW()
       WHERE id = $1`,
      [residentId]
    )

    // 3. Concurrent dispatch attempt with stale V1 QR code: MUST fail closed with 409 Conflict
    const resDispatch = await fetch(`${base}/${runId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawQrPayload: rawQrPayloadV1, event: 'dispatched' }),
    })
    assert.equal(resDispatch.status, 409)
    const errBody = (await resDispatch.json()) as any
    assert.ok(
      errBody.status === 'SUPERSEDED' || errBody.status === 'NPO_ORDER' || String(errBody.error).includes('SUPERSEDED') || String(errBody.error).includes('NPO'),
      `Expected stale card or NPO lockout, got: ${JSON.stringify(errBody)}`
    )

    // 4. Verify no dispatched event was recorded into tray_events
    const { rows: events } = await pool.query('SELECT event FROM tray_events WHERE run_id = $1', [runId])
    assert.equal(events.length, 1)
    assert.equal(events[0].event, 'assembled')
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('concurrency acceptance: multi-client race on EHR reconciliation queue resolves atomically', async () => {
  const { pool } = await import('./db/pool')
  const { ehrRouter } = await import('./routes/ehr')

  const user1 = crypto.randomUUID()
  const user2 = crypto.randomUUID()
  const resident = crypto.randomUUID()

  await pool.query(
    'INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)',
    [user1, 'Dietitian One', 'rd1@example.invalid', 'unused', 'dietitian']
  )
  await pool.query(
    'INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)',
    [user2, 'Dietitian Two', 'rd2@example.invalid', 'unused', 'dietitian']
  )
  await pool.query(
    'INSERT INTO residents (id, name, room, allergies, profile_version) VALUES ($1,$2,$3,$4,1)',
    [resident, 'Concurrent Resident', '102-B', ['Fish']]
  )

  const token1 = jwt.sign(
    { sub: user1, role: 'dietitian', purpose: 'access', mfa: true, facilityId: 'default', platformAdmin: false },
    process.env.JWT_SECRET!,
    { audience: 'shoreline-api', expiresIn: '5m' }
  )
  const token2 = jwt.sign(
    { sub: user2, role: 'dietitian', purpose: 'access', mfa: true, facilityId: 'default', platformAdmin: false },
    process.env.JWT_SECRET!,
    { audience: 'shoreline-api', expiresIn: '5m' }
  )

  const app = express()
  app.use(express.json())
  app.use('/api/ehr', ehrRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/ehr`

  const queueId = crypto.randomUUID()
  await pool.query(
    `INSERT INTO ehr_reconciliation_queue
       (id, resident_id, resident_name, external_ehr_id, change_type, incoming_payload, conflict_reason, status)
     VALUES ($1, $2, 'Concurrent Resident', 'EHR-1002', 'NEW_ALLERGEN', $3, 'Allergy update', 'PENDING_TRIAGE')`,
    [queueId, resident, JSON.stringify({ allergies: ['Fish', 'Shellfish'] })]
  )

  try {
    // Fire two simultaneous approvals for the same reconciliation queue item
    const [res1, res2] = await Promise.all([
      fetch(`${base}/reconciliation-queue/${queueId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
        body: JSON.stringify({ action: 'APPROVED_BY_RD' }),
      }),
      fetch(`${base}/reconciliation-queue/${queueId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
        body: JSON.stringify({ action: 'APPROVED_BY_RD' }),
      }),
    ])

    const statuses = [res1.status, res2.status].sort()
    // Exactly one should succeed (200), and the loser must be rejected (409 Conflict)
    assert.deepEqual(statuses, [200, 409], 'Atomic resolution ensures exactly one winner')

    // Profile version must have incremented exactly once (from 1 to 2)
    const { rows: resRows } = await pool.query(
      'SELECT profile_version, allergies FROM residents WHERE id = $1',
      [resident]
    )
    assert.equal(resRows[0].profile_version, 2)
    assert.deepEqual(resRows[0].allergies, ['Fish', 'Shellfish'])
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
