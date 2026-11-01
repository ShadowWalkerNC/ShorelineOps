import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'crypto'
import express from 'express'
import bcrypt from 'bcryptjs'

const directory = mkdtempSync(path.join(tmpdir(), 'shoreline-tv-display-'))
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(directory, 'tv.db')
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')

void test('tv wall-display pairing issues display-scoped sessions and PHI-free aggregates', async t => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { requireAuth } = await import('./middleware/requireAuth')
  const { authRouter } = await import('./routes/auth')
  const { tvRouter } = await import('./routes/tv')
  const { menuRouter } = await import('./routes/menu')
  const { residentsRouter } = await import('./routes/residents')
  const { adminRouter } = await import('./routes/admin')
  const { errorHandler } = await import('./middleware/errorHandler')
  await runMigrations()
  await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')

  const password = 'Synthetic-Only-Password-43!'
  const passwordHash = await bcrypt.hash(password, 4)
  const createUser = async (role = 'admin') => {
    const id = crypto.randomUUID()
    const email = `${id}@example.invalid`
    await pool.query(
      'INSERT INTO users (id,name,email,password,role,active,platform_admin) VALUES ($1,$2,$3,$4,$5,true,false)',
      [id, 'Synthetic user', email, passwordHash, role]
    )
    return { id, email }
  }

  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api/tv', tvRouter)
  app.use('/api/admin', requireAuth, adminRouter)
  // Mirror the production mounts: menu admits display tokens, residents denies them.
  app.use('/api/menu', requireAuth({ allowDisplay: true }), menuRouter)
  app.use('/api/residents', requireAuth, residentsRouter)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const request = (url: string, token?: string, body?: object, method = body ? 'POST' : 'GET') =>
    fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  const login = async (email: string) => {
    const response = await request('/api/auth/login', undefined, { email, password })
    assert.equal(response.status, 200)
    return (await response.json()) as any
  }
  const pairRequest = async (label?: string) => {
    const response = await request('/api/tv/pair/request', undefined, label === undefined ? {} : { label })
    assert.equal(response.status, 201)
    return (await response.json()) as any
  }

  const admin = await createUser('admin')
  const adminSession = await login(admin.email)

  try {
    await t.test('pairing request issues a claim-bound pending code', async () => {
      const body = await pairRequest('Dining Hall TV')
      assert.match(body.code, /^[A-Z2-9]{6}$/)
      assert.match(body.claimToken, /^[0-9a-f]{64}$/)
      assert.equal(body.expiresInSeconds, 600)
      assert.ok(!('accessToken' in body))
      // The claim secret is required to poll: missing or wrong claim reads as invalid.
      assert.equal((await request(`/api/tv/pair/status?code=${body.code}`)).status, 404)
      assert.equal((await request(`/api/tv/pair/status?code=${body.code}&claim=${'0'.repeat(64)}`)).status, 404)
      const status = await request(`/api/tv/pair/status?code=${body.code}&claim=${body.claimToken}`)
      assert.equal(status.status, 200)
      const statusBody = (await status.json()) as any
      assert.equal(statusBody.status, 'pending')
      assert.ok(statusBody.expiresInSeconds > 0)
      assert.ok(!('accessToken' in statusBody))
    })

    await t.test('approval is manager-gated and rejects unknown codes', async () => {
      const dietary = await createUser('dietary')
      const dietarySession = await login(dietary.email)
      const pending = await pairRequest()
      assert.equal((await request('/api/tv/pair/approve', undefined, { code: pending.code })).status, 401)
      assert.equal((await request('/api/tv/pair/approve', dietarySession.accessToken, { code: pending.code })).status, 403)
      assert.equal((await request('/api/tv/pair/approve', adminSession.accessToken, { code: 'ZZZZZZ' })).status, 404)
      // Rejected attempts must not consume the pending code.
      const status = await request(`/api/tv/pair/status?code=${pending.code}&claim=${pending.claimToken}`)
      assert.equal(status.status, 200)
      assert.equal(((await status.json()) as any).status, 'pending')
    })

    let displayToken = ''
    let displayRefresh = ''
    await t.test('approved pairing yields single-use display tokens', async () => {
      const pending = await pairRequest()
      const approve = await request('/api/tv/pair/approve', adminSession.accessToken, { code: pending.code })
      assert.equal(approve.status, 200)
      assert.equal(((await approve.json()) as any).status, 'approved')
      const status = await request(`/api/tv/pair/status?code=${pending.code}&claim=${pending.claimToken}`)
      assert.equal(status.status, 200)
      const body = (await status.json()) as any
      assert.equal(body.status, 'approved')
      assert.equal(typeof body.accessToken, 'string')
      assert.equal(typeof body.refreshToken, 'string')
      displayToken = body.accessToken
      displayRefresh = body.refreshToken
      // Single use: the code is destroyed on first approved read.
      assert.equal((await request(`/api/tv/pair/status?code=${pending.code}&claim=${pending.claimToken}`)).status, 404)
    })

    await t.test('concurrent pairing approvals serialize and exactly one succeeds', async () => {
      const pending = await pairRequest('Concurrent TV')
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          request('/api/tv/pair/approve', adminSession.accessToken, { code: pending.code })
        )
      )
      const statuses = results.map(r => r.status)
      const successes = statuses.filter(s => s === 200)
      const conflicts = statuses.filter(s => s === 409)
      assert.equal(successes.length, 1, 'Exactly one approval request must succeed')
      assert.equal(conflicts.length, 9, 'All other concurrent approvals must return 409 Conflict')

      // Verify the single approved code can now be claimed
      const claimRes = await request(`/api/tv/pair/status?code=${pending.code}&claim=${pending.claimToken}`)
      assert.equal(claimRes.status, 200)
      const claimBody = (await claimRes.json()) as any
      assert.equal(claimBody.status, 'approved')
      assert.equal(typeof claimBody.accessToken, 'string')
    })

    await t.test('concurrent status polls consume single-use claim token exactly once', async () => {
      const pending = await pairRequest('Concurrent Poll TV')
      const approveRes = await request('/api/tv/pair/approve', adminSession.accessToken, { code: pending.code })
      assert.equal(approveRes.status, 200)

      // 10 concurrent requests to claim the approved token
      const polls = await Promise.all(
        Array.from({ length: 10 }, () =>
          request(`/api/tv/pair/status?code=${pending.code}&claim=${pending.claimToken}`)
        )
      )
      const pollStatuses = polls.map(p => p.status)
      const pollSuccesses = pollStatuses.filter(s => s === 200)
      const pollNotFound = pollStatuses.filter(s => s === 404)
      assert.equal(pollSuccesses.length, 1, 'Exactly one status poll must retrieve the approved session')
      assert.equal(pollNotFound.length, 9, 'Subsequent or concurrent polls must receive 404')
    })

    await t.test('ops feed is counts-only with no resident-level fields', async () => {
      const response = await request('/api/tv/ops-today', displayToken)
      assert.equal(response.status, 200)
      const body = (await response.json()) as any
      assert.deepEqual(Object.keys(body).sort(), ['date', 'facilityName', 'generatedAt', 'production', 'trays'])
      assert.deepEqual(Object.keys(body.production).sort(), ['pending', 'signedOff', 'total'])
      assert.deepEqual(
        Object.keys(body.trays).sort(),
        ['assembled', 'delivered', 'dispatched', 'missed', 'remade', 'runs']
      )
      for (const n of [...Object.values(body.production), ...Object.values(body.trays)]) {
        assert.equal(typeof n, 'number')
        assert.ok((n as number) >= 0)
      }
      const serialized = JSON.stringify(body).toLowerCase()
      for (const forbidden of ['resident', 'room', 'email', 'diet', 'allerg', 'npo', 'dob', 'phone', 'ticket']) {
        assert.ok(!serialized.includes(`"${forbidden}`), `payload must not contain ${forbidden} fields`)
      }
      assert.equal((await request('/api/tv/ops-today')).status, 401)
      const distributor = await createUser('distributor')
      const distributorSession = await login(distributor.email)
      assert.equal((await request('/api/tv/ops-today', distributorSession.accessToken)).status, 403)
    })

    await t.test('display tokens reach TV reads but no resident or write routes', async () => {
      assert.equal((await request('/api/menu/weeks', displayToken)).status, 200)
      assert.equal((await request('/api/residents', displayToken)).status, 403)
      assert.equal((await request('/api/menu/weeks', displayToken, { name: 'TV Write Attempt' })).status, 403)
      // Human sessions are unaffected by display scoping.
      assert.equal((await request('/api/residents', adminSession.accessToken)).status, 200)
    })

    await t.test('manager role may approve pairing codes', async () => {
      const manager = await createUser('manager')
      const managerSession = await login(manager.email)
      const pending = await pairRequest('Kitchen Pass TV')
      const approve = await request('/api/tv/pair/approve', managerSession.accessToken, { code: pending.code })
      assert.equal(approve.status, 200)
      const status = await request(`/api/tv/pair/status?code=${pending.code}&claim=${pending.claimToken}`)
      assert.equal(status.status, 200)
      assert.equal(((await status.json()) as any).status, 'approved')
    })

    await t.test('ops counts reflect sheets, runs, and events', async () => {
      const weekId = crypto.randomUUID()
      await pool.query(`INSERT INTO menu_weeks (id, name, active, days) VALUES ($1, $2, true, $3)`, [
        weekId, 'TV Test Week', '{}',
      ])
      await pool.query(
        `INSERT INTO production_sheets (id, menu_week_id, day, slot, rows, counts, signed_off_by, signed_off_at)
         VALUES ($1, $2, 'Monday', 'lunch', '[]', '{}', 'Chef', $3)`,
        [crypto.randomUUID(), weekId, new Date().toISOString()]
      )
      await pool.query(
        `INSERT INTO production_sheets (id, menu_week_id, day, slot, rows, counts)
         VALUES ($1, $2, 'Monday', 'dinner', '[]', '{}')`,
        [crypto.randomUUID(), weekId]
      )
      const runId = crypto.randomUUID()
      const today = new Date().toISOString().slice(0, 10)
      await pool.query(`INSERT INTO tray_runs (id, meal_slot, service_date, wing) VALUES ($1, 'lunch', $2, '')`, [
        runId, today,
      ])
      for (const event of ['assembled', 'dispatched', 'delivered', 'missed']) {
        await pool.query(`INSERT INTO tray_events (id, run_id, event) VALUES ($1, $2, $3)`, [
          crypto.randomUUID(), runId, event,
        ])
      }
      const response = await request('/api/tv/ops-today', displayToken)
      assert.equal(response.status, 200)
      const body = (await response.json()) as any
      assert.deepEqual(body.production, { total: 2, signedOff: 1, pending: 1 })
      assert.deepEqual(body.trays, { runs: 1, assembled: 1, dispatched: 1, delivered: 1, missed: 1, remade: 0 })
    })

    await t.test('crew feed lists active dietary staff without private fields', async () => {
      const addProfile = (over: Record<string, unknown>) =>
        pool.query(
          `INSERT INTO staff_profiles
             (id, first_name, last_name, preferred_name, role, department, position, status, phone, email, manager_notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            crypto.randomUUID(),
            over.first_name ?? 'Crew', over.last_name ?? 'Member', over.preferred_name ?? null,
            over.role ?? 'dietary', over.department ?? 'Dietary', over.position ?? 'Cook',
            over.status ?? 'Active', '555-0100', 'crew@example.invalid', 'private note',
          ]
        )
      await addProfile({ first_name: 'Active', last_name: 'Cook' })
      await addProfile({ first_name: 'Preferred', last_name: 'Chef', preferred_name: 'Chief', role: 'manager', position: 'Executive Chef' })
      await addProfile({ first_name: 'Inactive', last_name: 'Aide', status: 'Terminated' })
      await addProfile({ first_name: 'Night', last_name: 'Nurse', department: 'Nursing', position: 'RN' })
      const response = await request('/api/tv/crew-today', displayToken)
      assert.equal(response.status, 200)
      const body = (await response.json()) as any
      assert.deepEqual(Object.keys(body).sort(), ['crew', 'date', 'generatedAt'])
      assert.equal(body.crew.length, 2)
      assert.deepEqual(body.crew[0], { name: 'Chief Chef', position: 'Executive Chef', department: 'Dietary' })
      assert.deepEqual(Object.keys(body.crew[1]).sort(), ['department', 'name', 'position'])
      const serialized = JSON.stringify(body).toLowerCase()
      for (const forbidden of ['phone', 'email', 'emergency', 'notes', 'certification', 'badge', 'address']) {
        assert.ok(!serialized.includes(`"${forbidden}`), `payload must not contain ${forbidden} fields`)
      }
      assert.equal((await request('/api/tv/crew-today')).status, 401)
      const distributor = await createUser('distributor')
      const distributorSession = await login(distributor.email)
      assert.equal((await request('/api/tv/crew-today', distributorSession.accessToken)).status, 403)
    })

    await t.test('schedule feed lists today shifts with coverage counts and no private fields', async () => {
      const today = new Date().toISOString().slice(0, 10)
      const addProfile = async (over: Record<string, unknown>) => {
        const id = crypto.randomUUID()
        await pool.query(
          `INSERT INTO staff_profiles
             (id, first_name, last_name, role, department, position, status, phone, email)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            over.first_name ?? 'Shift', over.last_name ?? 'Worker',
            over.role ?? 'dietary', over.department ?? 'Dietary', over.position ?? 'Cook',
            over.status ?? 'Active', '555-0199', 'shift@example.invalid',
          ]
        )
        return id
      }
      const morningId = await addProfile({ first_name: 'Morning', last_name: 'Lead', role: 'manager', position: 'Executive Chef' })
      const eveningId = await addProfile({ first_name: 'Evening', last_name: 'Aide', position: 'Dietary Aide' })
      const terminatedId = await addProfile({ first_name: 'Gone', last_name: 'Cook', status: 'Terminated' })
      const nurseId = await addProfile({ first_name: 'Night', last_name: 'Nurse', department: 'Nursing', position: 'RN' })
      const addShift = (staffId: string, date: string, shift: string, station: string) =>
        pool.query('INSERT INTO shifts (id, staff_id, date, shift, station) VALUES ($1, $2, $3, $4, $5)', [
          crypto.randomUUID(), staffId, date, shift, station,
        ])
      await addShift(morningId, today, 'Morning', 'Hot line')
      await addShift(eveningId, today, 'Evening', 'Tray assembly')
      await addShift(terminatedId, today, 'Morning', 'Dish')
      await addShift(nurseId, today, 'Morning', 'Floor')
      await addShift(morningId, '2099-01-01', 'Morning', 'Hot line')
      await pool.query(
        `INSERT INTO call_outs (id, staff_id, filed_by_id, date, shift, reason, notes, coverage_status, replacement_staff_id)
         VALUES ($1, $2, $3, $4, 'Morning', 'Sick', 'private health note', 'Uncovered', NULL)`,
        [crypto.randomUUID(), eveningId, morningId, today]
      )
      await pool.query(
        `INSERT INTO call_outs (id, staff_id, filed_by_id, date, shift, reason, coverage_status, replacement_staff_id, manager_acknowledged)
         VALUES ($1, $2, $3, $4, 'Midday', 'Personal', 'Covered', $5, true)`,
        [crypto.randomUUID(), morningId, morningId, today, eveningId]
      )
      const response = await request('/api/tv/schedule-today', displayToken)
      assert.equal(response.status, 200)
      const body = (await response.json()) as any
      assert.deepEqual(Object.keys(body).sort(), ['coverage', 'date', 'generatedAt', 'shifts'])
      assert.equal(body.date, today)
      assert.equal(body.shifts.length, 2)
      // Morning block sorts before Evening; inactive and non-dietary staff excluded.
      assert.deepEqual(body.shifts[0], { name: 'Morning Lead', position: 'Executive Chef', shift: 'Morning', station: 'Hot line' })
      assert.deepEqual(body.shifts[1], { name: 'Evening Aide', position: 'Dietary Aide', shift: 'Evening', station: 'Tray assembly' })
      assert.deepEqual(body.coverage, { callOuts: 2, uncovered: 1, byShift: { Morning: 1, Midday: 1 } })
      const serialized = JSON.stringify(body).toLowerCase()
      for (const forbidden of ['phone', 'email', 'reason', 'notes', 'replacement', 'sick', 'personal', 'emergency']) {
        assert.ok(!serialized.includes(`"${forbidden}`), `payload must not contain ${forbidden} fields`)
      }
      assert.equal((await request('/api/tv/schedule-today')).status, 401)
      const distributor = await createUser('distributor')
      const distributorSession = await login(distributor.email)
      assert.equal((await request('/api/tv/schedule-today', distributorSession.accessToken)).status, 403)
    })

    await t.test('shift CRUD via /api/admin/shifts synchronizes to /api/tv/schedule-today with zero PHI leakage', async () => {
      const manager = await createUser('manager')
      const managerSession = await login(manager.email)
      const today = new Date().toISOString().slice(0, 10)

      // 1. Create shift via manager API
      const createRes = await request('/api/admin/shifts', managerSession.accessToken, {
        staff_name: 'Jordan River',
        position: 'Dietary Cook',
        station: 'Grill Station',
        shift_date: today,
        shift_window: 'Morning',
      })
      assert.equal(createRes.status, 201)
      const createdShift = (await createRes.json()) as any
      assert.equal(createdShift.staff_name, 'Jordan River')
      assert.equal(createdShift.station, 'Grill Station')

      // 2. Query schedule-today with displayToken -> Jordan River appears
      const schedRes1 = await request('/api/tv/schedule-today', displayToken)
      assert.equal(schedRes1.status, 200)
      const schedBody1 = (await schedRes1.json()) as any
      const matching1 = schedBody1.shifts.find((s: any) => s.name === 'Jordan River')
      assert.ok(matching1, 'Created shift must appear on schedule-today')
      assert.equal(matching1.position, 'Dietary Cook')
      assert.equal(matching1.shift, 'Morning')
      assert.equal(matching1.station, 'Grill Station')

      // 3. Update shift with call_out and private medical note
      const initialCallOuts = schedBody1.coverage.callOuts
      const updateRes = await request(`/api/admin/shifts/${createdShift.id}`, managerSession.accessToken, {
        call_out: true,
        call_out_reason: 'Viral Gastroenteritis',
        notes: 'Confidential clinical health note 104928',
      }, 'PUT')
      assert.equal(updateRes.status, 200)

      // 4. Query schedule-today -> call-out count incremented, private note NOT leaked
      const schedRes2 = await request('/api/tv/schedule-today', displayToken)
      assert.equal(schedRes2.status, 200)
      const schedBody2 = (await schedRes2.json()) as any
      assert.equal(schedBody2.coverage.callOuts, initialCallOuts + 1)
      const serialized = JSON.stringify(schedBody2).toLowerCase()
      for (const forbidden of ['gastroenteritis', 'confidential', 'clinical', 'health', '104928']) {
        assert.ok(!serialized.includes(forbidden), `TV schedule must not leak PHI: ${forbidden}`)
      }

      // 5. Clear call_out
      const clearRes = await request(`/api/admin/shifts/${createdShift.id}`, managerSession.accessToken, {
        call_out: false,
      }, 'PUT')
      assert.equal(clearRes.status, 200)
      const schedRes3 = await request('/api/tv/schedule-today', displayToken)
      const schedBody3 = (await schedRes3.json()) as any
      assert.equal(schedBody3.coverage.callOuts, initialCallOuts)

      // 6. Delete shift
      const delRes = await request(`/api/admin/shifts/${createdShift.id}`, managerSession.accessToken, undefined, 'DELETE')
      assert.equal(delRes.status, 200)
      const schedRes4 = await request('/api/tv/schedule-today', displayToken)
      const schedBody4 = (await schedRes4.json()) as any
      assert.ok(!schedBody4.shifts.some((s: any) => s.name === 'Jordan River'), 'Deleted shift must be removed from TV display')
    })

    await t.test('meals feed reports census and diet/texture counts only', async () => {
      const addResident = (over: Record<string, unknown>) =>
        pool.query(
          'INSERT INTO residents (id, name, room, status, diet_type, texture) VALUES ($1, $2, $3, $4, $5, $6)',
          [
            crypto.randomUUID(),
            over.name ?? 'Test Resident Zephyr', over.room ?? '101A',
            over.status ?? 'Active', over.diet_type ?? 'Regular', over.texture ?? 'Regular',
          ]
        )
      await addResident({ name: 'Alice Alpha', diet_type: 'Regular', texture: 'Regular' })
      await addResident({ name: 'Bob Beta', diet_type: 'NAS', texture: 'Pureed' })
      await addResident({ name: 'Cara Gamma', diet_type: 'Diabetic', texture: 'Soft' })
      await addResident({ name: 'Discharged Delta', status: 'Discharged', diet_type: 'Renal', texture: 'Minced' })
      const response = await request('/api/tv/meals-today', displayToken)
      assert.equal(response.status, 200)
      const body = (await response.json()) as any
      assert.deepEqual(Object.keys(body).sort(), ['census', 'date', 'diets', 'generatedAt', 'textures'])
      assert.equal(body.census, 3)
      assert.deepEqual(body.diets, { Regular: 1, NAS: 1, Diabetic: 1 })
      assert.deepEqual(body.textures, { Regular: 1, Pureed: 1, Soft: 1 })
      for (const n of [body.census, ...Object.values(body.diets), ...Object.values(body.textures)]) {
        assert.equal(typeof n, 'number')
        assert.ok((n as number) >= 0)
      }
      const serialized = JSON.stringify(body)
      for (const leaked of ['Alice Alpha', 'Bob Beta', 'Cara Gamma', '101A', 'room', 'allerg']) {
        assert.ok(!serialized.includes(leaked), `payload must not contain ${leaked}`)
      }
      assert.equal((await request('/api/tv/meals-today')).status, 401)
      const distributor = await createUser('distributor')
      const distributorSession = await login(distributor.email)
      assert.equal((await request('/api/tv/meals-today', distributorSession.accessToken)).status, 403)
    })

    await t.test('refresh preserves display scope', async () => {
      const response = await request('/api/auth/refresh', undefined, { refreshToken: displayRefresh })
      assert.equal(response.status, 200)
      const body = (await response.json()) as any
      displayToken = body.accessToken
      displayRefresh = body.refreshToken
      assert.equal((await request('/api/tv/ops-today', displayToken)).status, 200)
      assert.equal((await request('/api/menu/weeks', displayToken)).status, 200)
      assert.equal((await request('/api/residents', displayToken)).status, 403)
    })

    await t.test('display sessions refresh while MFA is enforced globally', async () => {
      await pool.query('UPDATE system_settings SET mfa_required = true WHERE id = 1')
      try {
        const response = await request('/api/auth/refresh', undefined, { refreshToken: displayRefresh })
        assert.equal(response.status, 200)
        const body = (await response.json()) as any
        displayToken = body.accessToken
        displayRefresh = body.refreshToken
        assert.equal((await request('/api/tv/ops-today', displayToken)).status, 200)
      } finally {
        await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
      }
    })

    await t.test('disabling the display identity revokes walls and blocks re-pairing', async () => {
      await pool.query(`UPDATE users SET active = false WHERE email LIKE 'tv-display+%'`)
      assert.equal((await request('/api/tv/ops-today', displayToken)).status, 401)
      const pending = await pairRequest('Replacement TV')
      assert.equal((await request('/api/tv/pair/approve', adminSession.accessToken, { code: pending.code })).status, 403)
      await pool.query(`UPDATE users SET active = true WHERE email LIKE 'tv-display+%'`)
      assert.equal((await request('/api/tv/ops-today', displayToken)).status, 200)
    })

    await t.test('auth_version bump revokes outstanding display tokens', async () => {
      await pool.query(`UPDATE users SET auth_version = auth_version + 1 WHERE email LIKE 'tv-display+%'`)
      assert.equal((await request('/api/tv/ops-today', displayToken)).status, 401)
      assert.equal((await request('/api/auth/refresh', undefined, { refreshToken: displayRefresh })).status, 401)
    })
  } finally {
    server.close()
  }
})
