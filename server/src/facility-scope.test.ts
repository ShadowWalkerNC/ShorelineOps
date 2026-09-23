import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'
import { tenantContextMiddleware } from './middleware/tenantContext'
import { requireAuth } from './middleware/requireAuth'

test('single-facility boundary rejects foreign credentials and header switching', async () => {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
  process.env.SHORELINE_FACILITY_ID = 'facility-a'
  const token = (facilityId: string, platformAdmin = false) => jwt.sign({
    sub: 'synthetic-user', role: 'admin', purpose: 'access', mfa: true,
    facilityId, platformAdmin,
  }, process.env.JWT_SECRET!, { audience: 'shoreline-api', expiresIn: '5m' })
  const app = express()
  app.use(tenantContextMiddleware)
  app.get('/records', requireAuth, (_req, res) => res.json({ ok: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/records`
  try {
    for (const owner of [false, true]) {
      const local = token('facility-a', owner)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}` } })).status, 200)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token('facility-b', owner)}` } })).status, 403)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-b' } })).status, 403)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-a' } })).status, 200)
    }
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    delete process.env.SHORELINE_FACILITY_ID
  }
})
