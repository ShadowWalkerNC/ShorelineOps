import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = join(mkdtempSync(join(tmpdir(), 'shoreline-settings-fixture-')), 'test.sqlite')

test('settings migration removes only untouched exact historical fixtures and preserves operator values', async () => {
  const { pool } = await import('./db/pool')
  const { runMigrations } = await import('./db/migrate')
  try {
    await runMigrations()
    assert.equal((await pool.query('SELECT * FROM facility_settings')).rows.length, 0, 'new facilities must not acquire invented identity, account or BAA records')
    const legacy = JSON.stringify({ primaryDistributor: 'dennis', distributorCustomerNumber: 'DEN-884910', pccFacilityId: 'FAC-PORTLAND-01', autoSyncCensus: true, invoiceOcrAutoApprove: false })
    await pool.query("INSERT INTO facility_settings (facility_id,key,value,updated_by) VALUES ('fixture-unowned','integrations',$1,NULL)", [legacy])
    await pool.query("INSERT INTO facility_settings (facility_id,key,value,updated_by) VALUES ('fixture-operator','integrations',$1,'operator-test')", [legacy])
    await pool.query("INSERT INTO facility_settings (facility_id,key,value,updated_by) VALUES ('custom-unowned','integrations',$1,NULL)", [JSON.stringify({ primaryDistributor: 'custom', distributorCustomerNumber: 'operator-supplied' })])
    await pool.query("DELETE FROM _migrations WHERE name = '034_remove_unowned_fixture_settings'")
    await runMigrations()
    const remaining = await pool.query('SELECT facility_id, updated_by FROM facility_settings ORDER BY facility_id')
    assert.deepEqual(remaining.rows.map(row => row.facility_id), ['custom-unowned', 'fixture-operator'])
    assert.equal(remaining.rows[1].updated_by, 'operator-test')
  } finally {
    await pool.end()
  }
})
