import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import * as OTPAuth from 'otpauth'

// Configure storage before importing any application module. Never load .env.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'shoreline-auth-test-')), 'auth.db')
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')

void test('access credentials stay separate from pending MFA credentials', async (t) => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { authRouter } = await import('./routes/auth')
  const { ehrRouter } = await import('./routes/ehr')
  const { residentsRouter } = await import('./routes/residents')
  const { recipesRouter } = await import('./routes/recipes')
  const { requireAuth, verifyAccessToken } = await import('./middleware/requireAuth')
  const { errorHandler } = await import('./middleware/errorHandler')
  await runMigrations()
  const password = 'Test-Only-Long-Passphrase-9!'
  const passwordHash = await bcrypt.hash(password, 4)
  const mfaSecret = new OTPAuth.Secret({ size: 20 }).base32
  const userId = crypto.randomUUID()
  const plainId = crypto.randomUUID()
  for (const [id, email, enabled, secret] of [
    [userId, 'mfa@example.invalid', true, mfaSecret],
    [plainId, 'plain@example.invalid', false, null],
  ]) {
    await pool.query('INSERT INTO users (id,name,email,password,role,active,mfa_enabled,mfa_secret) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, 'Synthetic account', email, passwordHash, 'admin', true, enabled, secret])
  }
  await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api/residents', requireAuth, residentsRouter)
  app.use('/api/recipes', requireAuth, recipesRouter)
  app.use('/api/ehr', ehrRouter)
  app.use(errorHandler)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}`
  const request = (url: string, token?: string, body?: object) => fetch(base + url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const login = async (email: string) => {
    const response = await request('/api/auth/login', undefined, { email, password })
    assert.equal(response.status, 200)
    return response.json() as Promise<any>
  }
  try {
    const challenge = await login('mfa@example.invalid')
    assert.equal(challenge.mfaRequired, true)
    assert.equal(challenge.accessToken, undefined)
    const verifyToken = challenge.mfaToken as string
    await pool.query('UPDATE system_settings SET mfa_required = true WHERE id = 1')
    const enrollChallenge = await login('plain@example.invalid')
    assert.equal(enrollChallenge.mfaEnrollmentRequired, true)
    const enrollToken = enrollChallenge.mfaToken as string

    for (const [kind, token] of [['verify', verifyToken], ['enroll', enrollToken]]) {
      await t.test(`${kind} pending token rejected by all access-token consumers`, async () => {
        for (const url of ['/api/residents', '/api/recipes', '/api/auth/me', '/api/ehr/census']) {
          assert.equal((await request(url, token)).status, 401, url)
        }
        assert.equal((await request('/api/auth/mfa/setup/begin', token, {})).status, 401)
        assert.equal((await request('/api/auth/mfa/setup/confirm', token, { code: '000000' })).status, 401)
        assert.equal((await request('/api/ehr/reconciliation-queue/synthetic/resolve', token, {})).status, 403)
      })
    }
    await t.test('MFA tokens cannot be exchanged across pending purposes', async () => {
      assert.equal((await request('/api/auth/mfa/setup/begin', undefined, { mfaToken: verifyToken })).status, 401)
      assert.equal((await request('/api/auth/mfa/verify', undefined, { mfaToken: enrollToken, code: '000000' })).status, 401)
    })
    let completed: any
    await t.test('valid TOTP completes login and access works', async () => {
      const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(mfaSecret) }).generate()
      const response = await request('/api/auth/mfa/verify', undefined, { mfaToken: verifyToken, code })
      assert.equal(response.status, 200)
      completed = await response.json()
      assert.equal(verifyAccessToken(completed.accessToken).mfa, true)
      for (const url of ['/api/auth/me', '/api/residents']) {
        assert.equal((await request(url, completed.accessToken)).status, 200, url)
      }
    })
    await t.test('enrollment works only via its explicit body-token flow', async () => {
      const begun = await request('/api/auth/mfa/setup/begin', undefined, { mfaToken: enrollToken })
      assert.equal(begun.status, 200)
      const setup: any = await begun.json()
      const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(setup.secret) }).generate()
      const confirmed = await request('/api/auth/mfa/setup/confirm', undefined, { mfaToken: enrollToken, code })
      assert.equal(confirmed.status, 200)
      const session: any = await confirmed.json()
      assert.equal(verifyAccessToken(session.accessToken).sub, plainId)
      assert.equal((await request('/api/auth/me', session.accessToken)).status, 200)
    })
    await t.test('refresh issues the same restricted access-token class', async () => {
      const response = await request('/api/auth/refresh', undefined, { refreshToken: completed.refreshToken })
      assert.equal(response.status, 200)
      const refreshed: any = await response.json()
      assert.equal(verifyAccessToken(refreshed.accessToken).purpose, 'access')
      assert.equal((await request('/api/auth/refresh', undefined, { refreshToken: completed.refreshToken })).status, 401)
      const newHash = crypto.createHash('sha256').update(refreshed.refreshToken).digest('hex')
      await pool.query('UPDATE refresh_tokens SET expires_at = $1 WHERE token_hash = $2', [new Date(Date.now() - 60_000).toISOString(), newHash])
      assert.equal((await request('/api/auth/refresh', undefined, { refreshToken: refreshed.refreshToken })).status, 401)
      assert.equal((await request('/api/auth/me', refreshed.accessToken)).status, 200)
    })
    await t.test('non-MFA login remains valid when MFA is not required', async () => {
      await pool.query('UPDATE system_settings SET mfa_required = false WHERE id = 1')
      await pool.query('UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1', [plainId])
      const session = await login('plain@example.invalid')
      assert.equal(verifyAccessToken(session.accessToken).mfa, false)
      assert.equal((await request('/api/auth/me', session.accessToken)).status, 200)
    })
    await t.test('legacy, malformed, expired and wrong-audience tokens fail closed', async () => {
      const secret = process.env.JWT_SECRET!
      const valid = { sub: userId, role: 'admin', purpose: 'access', mfa: true }
      const tokens = [
        jwt.sign({ sub: userId, role: 'admin' }, secret, { expiresIn: '1m' }),
        jwt.sign(valid, secret, { expiresIn: '1m', audience: 'shoreline-mfa' }),
        jwt.sign({ ...valid, purpose: 'mfa_verify' }, secret, { expiresIn: '1m', audience: 'shoreline-api' }),
        jwt.sign({ ...valid, role: 'toString' }, secret, { expiresIn: '1m', audience: 'shoreline-api' }),
        jwt.sign({ ...valid, sub: '' }, secret, { expiresIn: '1m', audience: 'shoreline-api' }),
        jwt.sign(valid, secret, { expiresIn: -1, audience: 'shoreline-api' }),
        jwt.sign(valid, secret, { audience: 'shoreline-api' }),
        jwt.sign(valid, secret, { expiresIn: '1m', audience: 'shoreline-api', algorithm: 'HS384' }),
      ]
      for (const token of tokens) assert.equal((await request('/api/auth/me', token)).status, 401)
    })
    await t.test('completed access token cannot masquerade as enrollment token', async () => {
      assert.equal((await request('/api/auth/mfa/setup/begin', undefined, { mfaToken: completed.accessToken })).status, 401)
    })
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    await pool.end()
  }
})
