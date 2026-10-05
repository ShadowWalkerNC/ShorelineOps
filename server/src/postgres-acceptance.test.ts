import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Multi-client and concurrency acceptance suite.
// Exercises concurrent EHR decisions, stale tray rejection after a clinical update,
// concurrent refresh rotation, account revocation and expired-bearer logout.
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

test('database acceptance: concurrent refresh, account revocation and expired-token logout', async () => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { authRouter } = await import('./routes/auth')
  const { adminRouter } = await import('./routes/admin')
  const { requireAuth } = await import('./middleware/requireAuth')
  const { requireCapability } = await import('./middleware/permissions')
  const { errorHandler } = await import('./middleware/errorHandler')
  await runMigrations()
  await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
  const password = 'Synthetic-Postgres-Auth-Password!'
  const hash = await bcrypt.hash(password, 4)
  const createUser = async (owner = false) => {
    const id = crypto.randomUUID()
    const email = `${id}@example.invalid`
    await pool.query('INSERT INTO users (id,name,email,password,role,active,platform_admin) VALUES ($1,$2,$3,$4,$5,true,$6)',
      [id,'Synthetic auth acceptance',email,hash,'admin',owner])
    return {id,email}
  }
  const app = express()
  app.use(express.json())
  app.use('/auth',authRouter)
  app.use('/admin',requireAuth,adminRouter)
  app.get('/protected',requireAuth,(_req,res) => res.json({ok:true}))
  app.post('/clinical-write',requireAuth,requireCapability('residents.write'),(_req,res) => res.sendStatus(204))
  app.use(errorHandler)
  const server = app.listen(0,'127.0.0.1')
  await new Promise<void>(resolve => server.once('listening',resolve))
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`
  const request = (route:string,body?:object,token?:string,method = body ? 'POST' : 'GET') => fetch(base+route,{
    method,headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}),
  })
  const login = async (email:string) => {
    const response = await request('/auth/login',{email,password})
    assert.equal(response.status,200)
    return response.json() as Promise<{accessToken:string;refreshToken:string}>
  }
  try {
    const owner = await createUser(true)
    const ownerSession = await login(owner.email)
    const user = await createUser()
    const session = await login(user.email)
    const replies = await Promise.all(Array.from({length:4},() => request('/auth/refresh',{refreshToken:session.refreshToken})))
    assert.deepEqual(replies.map(response => response.status).sort(),[200,401,401,401])
    const winner = await replies.find(response => response.status === 200)!.json() as typeof session
    assert.equal((jwt.decode(winner.accessToken) as jwt.JwtPayload).sessionId,
      (jwt.decode(session.accessToken) as jwt.JwtPayload).sessionId)
    assert.equal((await request('/protected',undefined,session.accessToken)).status,200)
    assert.equal((await request(`/admin/users/${user.id}`,{role:'readonly'},ownerSession.accessToken,'PATCH')).status,200)
    assert.equal((await request('/protected',undefined,session.accessToken)).status,401)
    assert.equal((await request('/protected',undefined,winner.accessToken)).status,401)
    assert.equal((await request('/auth/refresh',{refreshToken:winner.refreshToken})).status,401)
    const limited = await login(user.email)
    assert.equal((await request('/clinical-write',{},limited.accessToken)).status,403)
    const expired = jwt.sign({...jwt.decode(limited.accessToken) as jwt.JwtPayload,exp:Math.floor(Date.now()/1000)-30},
      process.env.JWT_SECRET!,{algorithm:'HS256'})
    assert.equal((await request('/auth/logout',{refreshToken:limited.refreshToken},expired)).status,204)
    assert.equal((await request('/protected',undefined,limited.accessToken)).status,401)
    assert.equal((await request('/auth/refresh',{refreshToken:limited.refreshToken})).status,401)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('database acceptance: setup audit rollback and concurrent initialization preserve one owner', async () => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { setupRouter } = await import('./routes/setup')
  const { authRouter } = await import('./routes/auth')
  const OTPAuth = await import('otpauth')
  const { errorHandler } = await import('./middleware/errorHandler')
  await runMigrations()
  process.env.SETUP_BOOTSTRAP_SECRET = crypto.randomBytes(32).toString('hex')
  const app = express()
  app.use(express.json())
  app.use('/setup',setupRouter)
  app.use('/auth',authRouter)
  app.use(errorHandler)
  const server = app.listen(0,'127.0.0.1')
  await new Promise<void>(resolve => server.once('listening',resolve))
  const endpoint = `http://127.0.0.1:${(server.address() as {port:number}).port}/setup/initialize`
  const email = `setup-${crypto.randomUUID()}@example.invalid`
  const body = {facilityName:'Synthetic setup acceptance',primaryContactEmail:'contact@example.invalid',
    facilityType:'Assisted Living',wings:['Synthetic wing'],diningRooms:['Synthetic room'],
    adminName:'Synthetic owner',adminEmail:email,adminPassword:'Synthetic-Setup-Password42!',
    baaSigneeName:'Synthetic representative',deploymentReviewAcknowledged:true,initMode:'clean'}
  const initialize = () => fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',
    'X-Setup-Secret':process.env.SETUP_BOOTSTRAP_SECRET!},body:JSON.stringify(body)})
  const originalConnect = pool.connect
  try {
    pool.connect = async () => {
      const client = await originalConnect.call(pool)
      const query = client.query.bind(client)
      client.query = (sql:string,params:any[]) => {
        if (sql.includes("VALUES ('SETUP_INITIALIZE'")) throw new Error('Synthetic setup audit outage')
        return query(sql,params)
      }
      return client
    }
    try {assert.equal((await initialize()).status,500)} finally {pool.connect=originalConnect}
    assert.equal((await pool.query('SELECT id FROM users WHERE email = $1',[email])).rows.length,0)
    assert.equal((await pool.query('SELECT is_initialized FROM facility_config')).rows.some(row=>!!row.is_initialized),false)
    const attempts = await Promise.all(Array.from({length:4},initialize))
    assert.deepEqual(attempts.map(response=>response.status).sort(),[200,400,400,400])
    assert.equal((await pool.query('SELECT id FROM users WHERE email = $1',[email])).rows.length,1)
    const configuration = (await pool.query('SELECT is_initialized, baa_accepted_at, baa_signee_name FROM facility_config')).rows[0]
    assert.equal(!!configuration.is_initialized,true)
    assert.equal(configuration.baa_accepted_at,null)
    assert.equal(configuration.baa_signee_name,'')
    const audits = await pool.query("SELECT id FROM audit_log WHERE action = 'SETUP_INITIALIZE'")
    assert.equal(audits.rows.length,1)
    await pool.query('UPDATE system_settings SET mfa_required = true WHERE id = 1')
    const auth = (route:string,payload:object) => fetch(endpoint.replace('/setup/initialize','/auth/')+route,
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const login = await auth('login',{email,password:body.adminPassword})
    assert.equal(login.status,200)
    const pending = await login.json() as {mfaEnrollmentRequired:boolean;mfaToken:string}
    assert.equal(pending.mfaEnrollmentRequired,true)
    const begin = await auth('mfa/setup/begin',{mfaToken:pending.mfaToken})
    assert.equal(begin.status,200)
    const enrollment = await begin.json() as {secret:string}
    const code = new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(enrollment.secret)}).generate()
    const confirmed = await auth('mfa/setup/confirm',{mfaToken:pending.mfaToken,code})
    assert.equal(confirmed.status,200)
    const authenticated = await confirmed.json() as {accessToken:string;user:{mfaVerified:boolean}}
    assert.ok(authenticated.accessToken)
    assert.equal(authenticated.user.mfaVerified,true)
    const identity = await fetch(endpoint.replace('/setup/initialize','/auth/me'),
      {headers:{Authorization:`Bearer ${authenticated.accessToken}`}})
    assert.equal(identity.status,200)
  } finally {
    pool.connect=originalConnect
    await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
    delete process.env.SETUP_BOOTSTRAP_SECRET
    await new Promise<void>(resolve=>server.close(()=>resolve()))
  }
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
  const { requireAuth } = await import('./middleware/requireAuth')
  const { issueTestAccessToken } = await import('./test-support/accessToken')
  const staffToken = await issueTestAccessToken({ sub: staffUserId, role: 'staff' })
  const app = express()
  app.use(express.json())
  app.use('/api/trayruns', requireAuth, trayrunsRouter)
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
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

  const { issueTestAccessToken } = await import('./test-support/accessToken')
  const token1 = await issueTestAccessToken({ sub: user1, role: 'dietitian', mfa: true })
  const token2 = await issueTestAccessToken({ sub: user2, role: 'dietitian', mfa: true })

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
