import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'shoreline-facility-scope-')), 'test.sqlite')

test('single-facility boundary rejects foreign credentials and header switching', async () => {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
  process.env.SHORELINE_FACILITY_ID = 'facility-a'
  const { tenantContextMiddleware } = await import('./middleware/tenantContext')
  const { requireAuth } = await import('./middleware/requireAuth')
  const { runMigrations } = await import('./db/migrate')
  const { pool } = await import('./db/pool')
  const { issueTestAccessToken } = await import('./test-support/accessToken')
  await runMigrations()
  const token = (facilityId: string, platformAdmin = false) => issueTestAccessToken({
    sub: `synthetic-${facilityId}-${platformAdmin}`, role: 'admin', mfa: true,
    facilityId, platformAdmin,
  })
  const app = express()
  app.use(tenantContextMiddleware)
  app.get('/records', requireAuth, (_req, res) => res.json({ ok: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/records`
  try {
    for (const owner of [false, true]) {
      const local = await token('facility-a', owner)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}` } })).status, 200)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${await token('facility-b', owner)}` } })).status, 403)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-b' } })).status, 403)
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-a' } })).status, 200)
    }
    assert.equal((await fetch(url)).status, 401)
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401)
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    await pool.end()
    delete process.env.SHORELINE_FACILITY_ID
  }
})
