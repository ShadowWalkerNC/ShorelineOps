// Bounded-slice integration tests (CP-01/CP-02/CP-12).
// Gate: run ONLY when CONTROL_TEST_DATABASE_URL is explicitly set to a LOOPBACK
// PostgreSQL URL whose database name starts with "shoreline_control_test_".
// Otherwise the suite reports NOT RUN (skipped) and touches nothing.
// The suite never sends email (Gmail env is removed), never writes .env, and
// truncates ONLY the allowlisted control tables in the gated test database.
import { describe, test, before, after } from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { Pool } from 'pg'
import { migrate } from './db/migrate'
import { createApp } from './index'
import { decryptOutbox } from './security/outboxCrypto'
import { dispatchDue, enqueueEmail } from './email/outbox'
import { config } from './config'
import { activateFacility, facilityStatus, type ActivationInspector } from './activation'
import { createSession } from './security/sessions'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const ALLOWED_TABLES = [
  'facility_deployments',
  'activation_requests',
  'account_emails',
  'account_sessions',
  'password_resets',
  'email_outbox',
  'control_audit_log',
  'accounts',
]

function gate(): { url: string } | { skip: string } {
  const raw = (process.env.CONTROL_TEST_DATABASE_URL ?? '').trim()
  if (!raw) return { skip: 'NOT RUN: CONTROL_TEST_DATABASE_URL is not set.' }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { skip: 'NOT RUN: CONTROL_TEST_DATABASE_URL is not a valid URL.' }
  }
  if (!LOOPBACK.has(parsed.hostname.toLowerCase())) {
    return { skip: `NOT RUN: test database host "${parsed.hostname}" is not loopback.` }
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || parsed.search || parsed.hash) {
    return { skip: 'NOT RUN: use a PostgreSQL URL without query overrides.' }
  }
  const dbName = parsed.pathname.replace(/^\//, '').split('/')[0]
  if (!dbName.startsWith('shoreline_control_test_')) {
    return { skip: `NOT RUN: test database "${dbName}" must start with shoreline_control_test_.` }
  }
  return { url: raw }
}

const gated = gate()

describe('control-plane account slice (gated integration)', () => {
  if ('skip' in gated) {
    test('integration suite', { skip: gated.skip }, () => {})
    return
  }

  const testUrl = gated.url
  let pool: Pool
  let base = ''
  let server: ReturnType<ReturnType<typeof createApp>['listen']>

  // Test-only outbox key (random per run, never a real credential).
  process.env.CONTROL_OUTBOX_ENC_KEY = crypto.randomBytes(32).toString('base64')
  // Guarantee no real email path: remove any Gmail configuration.
  delete process.env.GMAIL_CLIENT_ID
  delete process.env.GMAIL_CLIENT_SECRET
  delete process.env.GMAIL_REFRESH_TOKEN
  delete process.env.GMAIL_SENDER

  const jar = new Map<string, string>()
  async function api(p: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers)
    if (jar.size) headers.set('Cookie', [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '))
    const res = await fetch(`${base}${p}`, { ...init, headers })
    const setCookie = res.headers.getSetCookie?.() ?? []
    for (const c of setCookie) {
      const [pair] = c.split(';')
      const idx = pair.indexOf('=')
      if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim())
    }
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // non-JSON
    }
    return { res, body: body as Record<string, unknown> }
  }
  // Same-origin browser POSTs carry Origin; the CSRF guard requires it on cookies.
  function cookieOrigin(): Record<string, string> {
    return { Origin: base }
  }

  before(async () => {
    pool = new Pool({ connectionString: testUrl, max: 5 })
    await migrate(pool)
    for (const t of ALLOWED_TABLES) await pool.query(`TRUNCATE ${t} RESTART IDENTITY CASCADE`)
    const app = createApp(pool)
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
        process.env.CONTROL_PUBLIC_ORIGIN = base
        resolve()
      })
    })
  })

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
    await pool.end()
  })

  test('AT-01: signup creates unverified account; email honestly unavailable', async () => {
    const { res, body } = await api('/api/accounts/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'Casey.Checker@example.com', password: 'correct-horse-12!' }),
    })
    assert.equal(res.status, 201)
    assert.equal(body.emailStatus, 'unavailable')
    assert.match(String(body.message), /queued when delivery is configured/i)
    const { rows } = await pool.query('SELECT email, email_verified_at FROM accounts WHERE email = $1', [
      'casey.checker@example.com',
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].email_verified_at, null)
    // Outbox row queued + encrypted (decrypts with the test-only key).
    const out = await pool.query('SELECT status, payload_enc FROM email_outbox WHERE to_email = $1', [
      'casey.checker@example.com',
    ])
    assert.equal(out.rows.length, 1)
    assert.equal(out.rows[0].status, 'queued')
    assert.ok(!String(out.rows[0].payload_enc).includes('casey.checker'))
  })

  test('duplicate signup gets the identical generic reply (no enumeration)', async () => {
    const first = await api('/api/accounts/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'another-valid-12!' }),
    })
    assert.equal(first.res.status, 201)
    assert.equal(first.body.emailStatus, 'unavailable')
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM accounts WHERE email = $1', [
      'casey.checker@example.com',
    ])
    assert.equal(rows[0].n, 1)
  })

  test('unverified login refused; resend honestly 503 without a sender', async () => {
    const login = await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'correct-horse-12!' }),
    })
    assert.equal(login.res.status, 403)
    assert.equal(login.body.error, 'EMAIL_UNVERIFIED')
    const resend = await api('/api/accounts/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com' }),
    })
    assert.equal(resend.res.status, 503)
    assert.equal(resend.body.error, 'EMAIL_UNAVAILABLE')
  })

  test('verify is single-use with expiry; replay rejected', async () => {
    const token = `known-verify-${crypto.randomBytes(8).toString('hex')}`
    const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex')
    const { rows: acc } = await pool.query('SELECT id FROM accounts WHERE email = $1', ['casey.checker@example.com'])
    await pool.query(`INSERT INTO account_emails (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')`, [
      acc[0].id,
      hash,
    ])
    const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }
    assert.equal((await api(`/api/accounts/verify?token=${encodeURIComponent(token)}`)).res.status, 404)
    const ok = await api('/api/accounts/verify', request)
    assert.equal(ok.res.status, 200)
    const replay = await api('/api/accounts/verify', request)
    assert.equal(replay.res.status, 400)
    assert.equal(replay.body.error, 'INVALID_OR_EXPIRED')
    const expired = await api('/api/accounts/verify', { ...request, body: JSON.stringify({ token: 'does-not-exist' }) })
    assert.equal(expired.res.status, 400)
  })

  test('AT-02: login, me, logout, session lifecycle', async () => {
    const login = await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'correct-horse-12!' }),
    })
    assert.equal(login.res.status, 200)
    assert.ok(jar.get('control_session'))
    const me = await api('/api/portal/status')
    assert.equal(me.res.status, 200)
    assert.equal(me.body.email, 'casey.checker@example.com')
    assert.equal(me.body.emailVerified, true)
    assert.equal((me.body.billing as { implemented: boolean }).implemented, false)
    assert.equal((me.body.sender as { configured: boolean }).configured, false)
    const logout = await api('/api/accounts/logout', { method: 'POST', headers: cookieOrigin() })
    assert.equal(logout.res.status, 200)
    jar.clear()
    const after = await api('/api/portal/status')
    assert.equal(after.res.status, 401)
  })

  test('clinical staff JWTs are never accepted', async () => {
    const fakeJwt = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: 'staff-1', role: 'admin' })).toString('base64url')}.sig`
    // With a session cookie present, Bearer must still 401 (not 403).
    await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'correct-horse-12!' }),
    })
    const me = await api('/api/portal/status', { headers: { Authorization: `Bearer ${fakeJwt}` } })
    assert.equal(me.res.status, 401)
    assert.equal(me.body.error, 'CONTROL_SESSION_REQUIRED')
    const login = await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fakeJwt}` },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'correct-horse-12!' }),
    })
    assert.equal(login.res.status, 401)
    assert.equal(login.body.error, 'CONTROL_SESSION_REQUIRED')
    jar.clear()
    const bare = await api('/api/portal/status', { headers: { Authorization: `Bearer ${fakeJwt}` } })
    assert.equal(bare.res.status, 401)
  })

  test('Origin CSRF guard rejects cross-origin cookie mutations', async () => {
    await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'correct-horse-12!' }),
    })
    const evil = await api('/api/accounts/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } })
    assert.equal(evil.res.status, 403)
    assert.equal(evil.body.error, 'ORIGIN_FORBIDDEN')
    const ok = await api('/api/accounts/logout', { method: 'POST', headers: cookieOrigin() })
    assert.equal(ok.res.status, 200)
    jar.clear()
  })

  test('password reset is single-use and revokes all sessions', async () => {
    await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'correct-horse-12!' }),
    })
    const before = await api('/api/portal/status')
    assert.equal(before.res.status, 200)
    const reqUnknown = await api('/api/accounts/password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieOrigin() },
      body: JSON.stringify({ email: 'nobody-here@example.com' }),
    })
    assert.equal(reqUnknown.res.status, 200) // generic even for unknown addresses
    const token = `known-reset-${crypto.randomBytes(8).toString('hex')}`
    const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex')
    const { rows: acc } = await pool.query('SELECT id FROM accounts WHERE email = $1', ['casey.checker@example.com'])
    await pool.query(`INSERT INTO password_resets (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [
      acc[0].id,
      hash,
    ])
    const confirm = await api('/api/accounts/password/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieOrigin() },
      body: JSON.stringify({ token, password: 'brand-new-pass-34!' }),
    })
    assert.equal(confirm.res.status, 200)
    const stale = await api('/api/portal/status') // pre-reset session must be dead
    assert.equal(stale.res.status, 401)
    const replay = await api('/api/accounts/password/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...cookieOrigin() },
      body: JSON.stringify({ token, password: 'another-valid-56!' }),
    })
    assert.equal(replay.res.status, 400)
    jar.clear()
    const relogin = await api('/api/accounts/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'brand-new-pass-34!' }),
    })
    assert.equal(relogin.res.status, 200)
    jar.clear()
  })

  test('CP-12: audit log holds no tokens, passwords, or patient tables', async () => {
    const { rows } = await pool.query('SELECT action, meta FROM control_audit_log')
    assert.ok(rows.length >= 5)
    const dumped = JSON.stringify(rows)
    assert.ok(!/known-verify-|known-reset-|correct-horse|brand-new-pass/i.test(dumped))
    for (const row of rows as Array<{ meta: Record<string, unknown> | null }>) {
      if (row.meta) {
        for (const key of Object.keys(row.meta)) {
          assert.ok(!/token|password|secret|cookie|authorization/i.test(key), `sensitive audit key: ${key}`)
        }
      }
    }
    const tables = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN
       ('residents', 'census', 'diet_orders', 'allergens', 'tray_tickets', 'temperatures')`
    )
    assert.equal(tables.rows.length, 0)
  })

  test('concurrent signup is atomic and uses the configured email origin', async () => {
    const request = { method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'attacker.example' },
      body: JSON.stringify({ email: 'concurrent@example.com', password: 'concurrent-pass-12!' }) }
    const replies = await Promise.all(Array.from({ length: 4 }, () => api('/api/accounts/signup', request)))
    for (const reply of replies) {
      assert.equal(reply.res.status, 201)
      assert.deepEqual(reply.body, replies[0].body)
    }
    const result = await pool.query(`SELECT a.id, o.payload_enc FROM accounts a
      JOIN email_outbox o ON o.account_id = a.id WHERE a.email = 'concurrent@example.com'`)
    assert.equal(result.rows.length, 1)
    const payload = decryptOutbox(result.rows[0].payload_enc)
    assert.ok(payload.text.includes(`${base}/verify.html#token=`))
    assert.ok(!payload.text.includes('attacker.example'))
    const tokens = await pool.query('SELECT count(*)::int AS n FROM account_emails WHERE account_id = $1', [result.rows[0].id])
    assert.equal(tokens.rows[0].n, 1)
  })

  test('database failure rolls signup back and returns a safe JSON error', async () => {
    await pool.query(`ALTER TABLE email_outbox ADD CONSTRAINT test_outbox_failure CHECK (to_email <> 'rollback@example.com') NOT VALID`)
    try {
      const reply = await api('/api/accounts/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'rollback@example.com', password: 'rollback-pass-12!' }) })
      assert.equal(reply.res.status, 503)
      assert.deepEqual(reply.body, { error: 'REQUEST_UNAVAILABLE' })
      const accounts = await pool.query(`SELECT id FROM accounts WHERE email = 'rollback@example.com'`)
      assert.equal(accounts.rowCount, 0)
    } finally {
      await pool.query('ALTER TABLE email_outbox DROP CONSTRAINT test_outbox_failure')
    }
  })

  test('login CSRF, JSON requirements, UTF-8 password limits and resend privacy', async () => {
    jar.clear()
    const login = { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
      body: JSON.stringify({ email: 'casey.checker@example.com', password: 'brand-new-pass-34!' }) }
    assert.equal((await api('/api/accounts/login', login)).res.status, 403)
    assert.equal((await api('/api/accounts/login', { ...login, headers: { ...login.headers, Origin: base.replace('http:', 'https:') } })).res.status, 403)
    assert.equal((await api('/api/accounts/login', { ...login, headers: { 'Content-Type': 'text/plain' } })).res.status, 415)
    assert.equal((await api('/api/accounts/signup', { ...login, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'long@example.com', password: '🙂'.repeat(20) }) })).res.status, 400)
    const replies = []
    for (const email of ['concurrent@example.com', 'unknown@example.com']) {
      replies.push(await api('/api/accounts/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }))
    }
    assert.equal(replies[0].res.status, 503)
    assert.equal(replies[1].res.status, 503)
    assert.deepEqual(replies[0].body, replies[1].body)
  })

  test('concurrent password reset consumes all sibling tokens once', async () => {
    const account = await pool.query(`SELECT id FROM accounts WHERE email = 'casey.checker@example.com'`)
    const tokens = [crypto.randomBytes(24).toString('hex'), crypto.randomBytes(24).toString('hex')]
    for (const token of tokens) await pool.query(`INSERT INTO password_resets (account_id, token_hash, expires_at)
      VALUES ($1, $2, now() + interval '1 hour')`, [account.rows[0].id, crypto.createHash('sha256').update(token).digest('hex')])
    const request = (token: string) => api('/api/accounts/password/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'concurrent-new-78!' }) })
    const replies = await Promise.all([request(tokens[0]), request(tokens[0])])
    assert.deepEqual(replies.map(reply => reply.res.status).sort(), [200, 400])
    assert.equal((await request(tokens[1])).res.status, 400)
  })

  test('outbox atomically claims queued mail and recovers stale leases (fixture transport)', async () => {
    await pool.query('TRUNCATE email_outbox')
    for (let index = 0; index < 4; index++) await enqueueEmail(pool, { accountId: null, to: 'fixture@example.com', kind: 'verify', subject: 'Fixture', text: `Fixture ${index}` })
    await pool.query(`UPDATE email_outbox SET status = 'sending', claimed_until = now() - interval '1 second' WHERE id = (SELECT id FROM email_outbox LIMIT 1)`)
    const originalFetch = globalThis.fetch
    const names = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_SENDER']
    const originalEnv = names.map(name => process.env[name])
    for (const name of names) process.env[name] = name === 'GMAIL_SENDER' ? 'fixture@example.com' : 'test-only'
    let sends = 0
    globalThis.fetch = (async (url: string | URL | Request) => {
      const address = String(url)
      if (address === 'https://oauth2.googleapis.com/token') return new Response(JSON.stringify({ access_token: 'fixture-only' }), { status: 200 })
      assert.equal(address, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send')
      sends++
      return new Response(JSON.stringify({ id: `fixture-${sends}` }), { status: 200 })
    }) as typeof fetch
    try {
      const results = await Promise.all([dispatchDue(pool, 4), dispatchDue(pool, 4)])
      assert.equal(results.reduce((sum, result) => sum + result.dispatched, 0), 4)
      assert.equal(sends, 4)
      const pending = await pool.query(`SELECT id FROM email_outbox WHERE status <> 'sent' OR payload_enc <> '' OR claimed_until IS NOT NULL`)
      assert.equal(pending.rowCount, 0)
    } finally {
      globalThis.fetch = originalFetch
      names.forEach((name, index) => { if (originalEnv[index] === undefined) delete process.env[name]; else process.env[name] = originalEnv[index] })
    }
  })

  test('manual activation requires verified intent, provider identity, unique resources and secrets', async () => {
    const ids = Array.from({ length: 6 }, () => crypto.randomUUID())
    const input = { email: 'activation@example.test', plan: 'PRO_TIER', projectId: ids[0], environmentId: ids[1], appServiceId: ids[2], databaseServiceId: ids[3], appOrigin: 'https://activation-test.up.railway.app' }
    const account = (await pool.query(`INSERT INTO accounts(email,password_hash) VALUES($1,'test-only-not-login') RETURNING id`, [input.email])).rows[0].id
    const common = { RAILWAY_PROJECT_ID: ids[0], RAILWAY_ENVIRONMENT_ID: ids[1] }
    const app = { ...common, RAILWAY_SERVICE_ID: ids[2], NODE_ENV: 'production', RAILWAY_PUBLIC_DOMAIN: 'activation-test.up.railway.app', JWT_SECRET: crypto.randomBytes(32).toString('hex'), SETUP_BOOTSTRAP_SECRET: crypto.randomBytes(24).toString('hex'), DATABASE_URL: 'postgresql://customer:unique-fixture-password@customer-db.railway.internal:5432/customer' }
    const database = { ...common, RAILWAY_SERVICE_ID: ids[3], RAILWAY_PRIVATE_DOMAIN: 'customer-db.railway.internal', PGUSER: 'customer', PGPASSWORD: 'unique-fixture-password', PGDATABASE: 'customer' }
    let ready = false
    const inspector: ActivationInspector = { variables: async (_project, _environment, service) => service === ids[2] ? app : database, readiness: async () => ({ ready, initialized: false, demo: false }) }
    await assert.rejects(activateFacility(pool, input, inspector), /VERIFIED_ACCOUNT_REQUIRED/)
    await pool.query('UPDATE accounts SET email_verified_at=now() WHERE id=$1', [account])
    ready = true
    await assert.rejects(activateFacility(pool, input, inspector), /MATCHING_ACTIVATION_REQUEST_REQUIRED/)
    const session = await createSession(pool, account, null, null)
    const request = (plan: string) => fetch(base + '/api/portal/activation-request', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: `control_session=${session.token}` }, body: JSON.stringify({ plan }) })
    assert.equal((await request('FREE_TIER')).status, 400)
    assert.equal((await request('PRO_TIER')).status, 202)
    assert.equal((await pool.query('SELECT count(*)::int n FROM facility_deployments')).rows[0].n, 0)
    assert.equal((await facilityStatus(pool, account)).status, 'awaiting-owner-activation')
    app.RAILWAY_SERVICE_ID = ids[4]
    await assert.rejects(activateFacility(pool, input, inspector), /PROVIDER_RESOURCE_IDENTITY_MISMATCH/)
    app.RAILWAY_SERVICE_ID = ids[2]
    const connection = app.DATABASE_URL
    app.DATABASE_URL = connection.replace('customer-db.railway.internal', 'other-customer.railway.internal')
    await assert.rejects(activateFacility(pool, input, inspector), /DATABASE_SERVICE_BINDING_MISMATCH/)
    app.DATABASE_URL = connection
    ready = false
    await assert.rejects(activateFacility(pool, input, inspector), /PRODUCTION_READINESS_REQUIRED/)
    ready = true
    assert.equal((await activateFacility(pool, input, inspector)).alreadyActivated, false)
    assert.equal((await activateFacility(pool, input, inspector)).alreadyActivated, true)
    assert.equal((await request('ENTERPRISE_TIER')).status, 409)
    assert.equal((await facilityStatus(pool, account)).setupKey, app.SETUP_BOOTSTRAP_SECRET)
    const other = (await pool.query(`INSERT INTO accounts(email,password_hash,email_verified_at) VALUES('activation-other@example.test','test-only',now()) RETURNING id`)).rows[0].id
    assert.equal((await facilityStatus(pool, other)).setupKey, null)
    await pool.query(`INSERT INTO activation_requests(account_id,plan) VALUES($1,'PRO_TIER')`, [other])
    await assert.rejects(activateFacility(pool, { ...input, email: 'activation-other@example.test' }, inspector), /FACILITY_RESOURCES_OR_SECRETS_ALREADY_ASSIGNED/)
    const distinct = { ...input, email: 'activation-other@example.test', appServiceId: ids[4], databaseServiceId: ids[5], appOrigin: 'https://activation-other.up.railway.app' }
    const reusedSecret: ActivationInspector = { ...inspector, variables: async (_project, _environment, service) => service === ids[4]
      ? { ...app, RAILWAY_SERVICE_ID: ids[4], RAILWAY_PUBLIC_DOMAIN: 'activation-other.up.railway.app', SETUP_BOOTSTRAP_SECRET: crypto.randomBytes(24).toString('hex') }
      : { ...database, RAILWAY_SERVICE_ID: ids[5] } }
    await assert.rejects(activateFacility(pool, distinct, reusedSecret), /FACILITY_RESOURCES_OR_SECRETS_ALREADY_ASSIGNED/)
    const row = (await pool.query('SELECT bootstrap_cipher FROM facility_deployments WHERE account_id=$1', [account])).rows[0]
    assert.ok(!row.bootstrap_cipher.includes(app.SETUP_BOOTSTRAP_SECRET))
    const response = await fetch(base + '/api/portal/status', { headers: { Cookie: `control_session=${session.token}` } })
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal((await response.json() as { provisioning: { automaticProvisioning: boolean } }).provisioning.automaticProvisioning, false)
  })

  test('production cookies cannot be configured insecurely', () => {
    const previous = process.env.NODE_ENV
    const cookie = process.env.CONTROL_COOKIE_SECURE
    try {
      process.env.NODE_ENV = 'production'
      process.env.CONTROL_COOKIE_SECURE = 'false'
      assert.equal(config.cookieSecure, true)
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous
      if (cookie === undefined) delete process.env.CONTROL_COOKIE_SECURE; else process.env.CONTROL_COOKIE_SECURE = cookie
    }
  })
})
