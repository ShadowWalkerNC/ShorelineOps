import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import jwt from 'jsonwebtoken'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'shoreline-ehr-')), 'test.sqlite')
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')

test('EHR decisions apply atomically and retain unresolved work on failure', async t => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  const { ehrRouter } = await import('./routes/ehr')
  await runMigrations()
  const user = crypto.randomUUID()
  const resident = crypto.randomUUID()
  await pool.query('INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)',
    [user, 'Synthetic reviewer', 'reviewer@example.invalid', 'unused', 'dietitian'])
  await pool.query('INSERT INTO residents (id, name, room, allergies) VALUES ($1,$2,$3,$4)',
    [resident, 'Synthetic resident', 'TEST', ['Milk']])
  const credential = (role: string) => jwt.sign({ sub: user, role, purpose: 'access', mfa: true, facilityId: 'default', platformAdmin: false },
    process.env.JWT_SECRET!, { audience: 'shoreline-api', expiresIn: '5m' })
  const app = express()
  app.use(express.json())
  app.use('/api/ehr', ehrRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/ehr`
  const add = async (type: string, payload: unknown, residentId: string | null = resident) => {
    const id = crypto.randomUUID()
    await pool.query('INSERT INTO ehr_reconciliation_queue (id,resident_id,resident_name,external_ehr_id,change_type,incoming_payload,conflict_reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, residentId, 'Synthetic resident', 'synthetic', type, JSON.stringify(payload), 'Review required'])
    return id
  }
  const resolve = (id: string, body: object = { action: 'APPROVED_BY_RD' }, role = 'dietitian') => fetch(`${base}/reconciliation-queue/${id}/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential(role)}` }, body: JSON.stringify(body),
  })
  const state = async (id: string) => (await pool.query('SELECT status FROM ehr_reconciliation_queue WHERE id = $1', [id])).rows[0].status
  const profile = async () => (await pool.query('SELECT allergies, diet_type, texture, is_npo, profile_version FROM residents WHERE id = $1', [resident])).rows[0]
  try {
    await t.test('allergy approval merges, increments once, and records before/after evidence', async () => {
      const id = await add('NEW_ALLERGEN', { allergies: ['milk', 'Egg', 'egg'] })
      assert.equal((await resolve(id)).status, 200)
      assert.deepEqual((await profile()).allergies, ['Milk', 'Egg'])
      assert.equal((await profile()).profile_version, 2)
      assert.equal(await state(id), 'APPROVED_BY_RD')
      const audits = await pool.query("SELECT details FROM audit_log WHERE action = 'ehr.reconciliation.resolved'")
      const detail = typeof audits.rows[0].details === 'string' ? JSON.parse(audits.rows[0].details) : audits.rows[0].details
      assert.equal(detail.previousProfile.profile_version, 1)
      assert.equal(detail.appliedProfile.profile_version, 2)
      assert.equal((await resolve(id)).status, 409)
      assert.equal((await profile()).profile_version, 2)
    })
    await t.test('queue exposes authoritative comparison and stale review cannot apply', async () => {
      const id = await add('DIET_ORDER', { dietOrder: 'NAS' })
      const response = await fetch(`${base}/reconciliation-queue`, { headers: { Authorization: `Bearer ${credential('dietitian')}` } })
      const data = await response.json() as { items: { id: string; current_profile: { profile_version: number } }[] }
      assert.equal(data.items.find(item => item.id === id)?.current_profile.profile_version, 2)
      assert.equal((await resolve(id, { action: 'APPROVED_BY_RD', expectedProfileVersion: 1 })).status, 409)
      assert.equal(await state(id), 'PENDING_TRIAGE')
      assert.equal((await profile()).diet_type, 'Regular')
    })
    await t.test('unsupported, malformed, unlinked and missing-resident changes remain pending', async () => {
      const cases: [string, unknown, string | null, number][] = [
        ['ADMISSION', {}, resident, 400], ['DIET_ORDER', {}, resident, 400],
        ['TEXTURE_UPDATE', [], resident, 400], ['NEW_ALLERGEN', { allergies: [{}] }, resident, 400],
        ['NEW_ALLERGEN', { allergies: [] }, resident, 400], ['NPO_ORDER', {}, null, 400],
        ['DIET_ORDER', { dietOrder: 'NAS' }, crypto.randomUUID(), 404],
      ]
      for (const [type, payload, residentId, status] of cases) {
        const id = await add(type, payload, residentId)
        assert.equal((await resolve(id)).status, status, type)
        assert.equal(await state(id), 'PENDING_TRIAGE')
      }
    })
    await t.test('audit failure rolls back resident change and queue status', async () => {
      const id = await add('DIET_ORDER', { dietOrder: 'Renal' })
      const before = await profile()
      await pool.query("CREATE TRIGGER reject_decision_audit BEFORE INSERT ON audit_log WHEN NEW.action = 'ehr.reconciliation.resolved' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;")
      try {
        assert.equal((await resolve(id)).status, 500)
        assert.deepEqual(await profile(), before)
        assert.equal(await state(id), 'PENDING_TRIAGE')
      } finally { await pool.query('DROP TRIGGER reject_decision_audit') }
    })
    await t.test('concurrent approval commits one version change', async () => {
      const id = await add('TEXTURE_UPDATE', { texture: 'Pureed' })
      const before = await profile()
      const responses = await Promise.all([resolve(id), resolve(id)])
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
      assert.equal((await profile()).profile_version, before.profile_version + 1)
    })
    await t.test('manager cannot approve; rejection does not change resident', async () => {
      const id = await add('NPO_ORDER', {})
      const before = await profile()
      assert.equal((await resolve(id, { action: 'APPROVED_BY_RD' }, 'manager')).status, 403)
      assert.equal(await state(id), 'PENDING_TRIAGE')
      assert.equal((await resolve(id, { action: 'REJECTED_BY_RD' })).status, 200)
      assert.deepEqual(await profile(), before)
    })
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
    await pool.end()
  }
})
