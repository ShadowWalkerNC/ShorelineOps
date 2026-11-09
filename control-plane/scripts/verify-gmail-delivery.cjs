// Explicit operator opt-in. Sends exactly two account emails to the configured sender.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { Pool } = require('pg')
const { createApp } = require('../dist/index')
const { migrate } = require('../dist/db/migrate')
const { decryptOutbox } = require('../dist/security/outboxCrypto')
const { dispatchDue } = require('../dist/email/outbox')

async function verify() {
  if (!process.argv.includes('--send')) throw new Error('Explicit --send approval is required. This sends two real account test emails to GMAIL_SENDER.')
  const target = new URL(process.env.CONTROL_TEST_DATABASE_URL || '')
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    !/^\/shoreline_control_test_mail_[a-z0-9_]+$/.test(target.pathname) || target.search || target.hash) throw new Error('Use a dedicated loopback shoreline_control_test_mail_ database without URL overrides.')
  const recipient = process.env.GMAIL_SENDER
  if (!recipient || !process.env.GMAIL_REFRESH_TOKEN) throw new Error('Load the authorized Gmail configuration before running this check.')
  process.env.NODE_ENV = 'test'
  process.env.CONTROL_OUTBOX_ENC_KEY = crypto.randomBytes(32).toString('base64')
  const pool = new Pool({ connectionString: target.href, max: 4 })
  let server
  try {
    const inventory = await pool.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'")
    assert.equal(inventory.rows[0].n, 0, 'The live-mail acceptance database must be empty and disposable')
    await migrate(pool)
    server = createApp(pool).listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    process.env.CONTROL_PUBLIC_ORIGIN = base
    const password = crypto.randomBytes(24).toString('base64url')
    const replacement = crypto.randomBytes(24).toString('base64url')
    let cookie = ''
    async function request(endpoint, body) {
      const response = await fetch(base + endpoint, { method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}) })
      const setCookie = response.headers.getSetCookie()[0]
      if (setCookie) cookie = setCookie.split(';')[0]
      return response
    }
    async function sendAndReadLink(kind, pathname) {
      const queued = await pool.query("SELECT payload_enc FROM email_outbox WHERE kind = $1 AND status = 'queued' AND to_email = $2", [kind, recipient.toLowerCase()])
      assert.equal(queued.rows.length, 1)
      const payload = decryptOutbox(queued.rows[0].payload_enc)
      assert.equal(payload.to.toLowerCase(), recipient.toLowerCase())
      const link = new URL(payload.text.match(/https?:\/\/[^\s]+/)[0])
      assert.equal(link.origin, base)
      assert.equal(link.pathname, pathname)
      const page = await fetch(link)
      assert.equal(page.status, 200)
      const sent = await dispatchDue(pool, 1)
      assert.equal(sent.dispatched, 1, 'Gmail must return an actual message receipt')
      assert.equal(sent.unavailable, false)
      return new URLSearchParams(link.hash.slice(1)).get('token')
    }
    assert.equal((await request('/api/accounts/signup', { email: recipient, password })).status, 201)
    const verification = await sendAndReadLink('verify', '/verify.html')
    assert.equal((await request('/api/accounts/verify', { token: verification })).status, 200)
    assert.equal((await request('/api/accounts/verify', { token: verification })).status, 400)
    assert.equal((await request('/api/accounts/login', { email: recipient, password })).status, 200)
    assert.equal((await request('/api/accounts/password/request', { email: recipient })).status, 200)
    const recovery = await sendAndReadLink('reset', '/reset.html')
    assert.equal((await request('/api/accounts/password/confirm', { token: recovery, password: replacement })).status, 200)
    assert.equal((await request('/api/portal/status')).status, 401)
    assert.equal((await request('/api/accounts/password/confirm', { token: recovery, password: replacement })).status, 400)
    cookie = ''
    assert.equal((await request('/api/accounts/login', { email: recipient, password: replacement })).status, 200)
    const outbox = await pool.query("SELECT count(*)::int AS n FROM email_outbox WHERE status = 'sent' AND payload_enc = ''")
    assert.equal(outbox.rows[0].n, 2)
    console.log('PASS: Gmail accepted both real account emails; verification/recovery links served, tokens single-use, old session revoked, new login accepted. Inbox delivery requires separate mailbox confirmation.')
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    await pool.end()
  }
}

verify().catch(error => {
  console.error('Live Gmail acceptance failed:', error.code || error.name || 'error')
  process.exitCode = 1
})
