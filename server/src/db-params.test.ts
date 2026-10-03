/**
 * SQLite numbered-parameter binding regression tests (pool.ts translateQuery).
 *
 * Guards the $1/$2 -> ?1/?2 mapping through the real exported pool.query API
 * against a disposable synthetic SQLite database. No real database, no PHI:
 * the probe table and rows below are synthetic fixtures only.
 */

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Force the disposable synthetic SQLite database BEFORE the pool module loads:
// pool.ts resolves SQLITE_PATH/DATABASE_URL once at import time.
if (!process.env.SQLITE_PATH) {
  process.env.SQLITE_PATH = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-dbparams-')),
    'params.sqlite'
  )
}
process.env.DATABASE_URL = ''

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { pool } = require('./db/pool')

const ids = (rows: any[]): string[] => rows.map((r: any) => r.id)

before(async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS synthetic_param_probe (
    id TEXT PRIMARY KEY, label TEXT, qty INTEGER, note TEXT, created TEXT
  )`)
  await pool.query('DELETE FROM synthetic_param_probe')
  const rows: Array<[string, string, number, string | null, string]> = [
    ['p1', 'apple', 5, null, '2026-01-10'],
    ['p2', 'Banana Bread', 10, 'b-note', '2026-03-15'],
    ['p3', 'apple pie', 20, null, '2026-06-20'],
  ]
  for (const row of rows) {
    await pool.query(
      'INSERT INTO synthetic_param_probe (id, label, qty, note, created) VALUES ($1, $2, $3, $4, $5)',
      [...row]
    )
  }
})

after(async () => {
  await pool.query('DROP TABLE IF EXISTS synthetic_param_probe')
  await pool.end()
})

test('repeated parameter binds every occurrence ($1 ... $1)', async () => {
  const { rows } = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE qty > $1 OR qty < $1 ORDER BY id',
    [10]
  )
  assert.deepEqual(ids(rows), ['p1', 'p3'])
})

test('reordered parameters bind by number, not position ($2 ... $1)', async () => {
  const { rows } = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE qty > $2 AND qty < $1 ORDER BY id',
    [20, 5]
  )
  assert.deepEqual(ids(rows), ['p2'])
})

test('null parameter binds as SQL NULL, including optional-filter pattern', async () => {
  const isNull = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE note IS $1 ORDER BY id',
    [null]
  )
  assert.deepEqual(ids(isNull.rows), ['p1', 'p3'])

  const isValue = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE note IS $1 ORDER BY id',
    ['b-note']
  )
  assert.deepEqual(ids(isValue.rows), ['p2'])

  const unfiltered = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE ($1 IS NULL OR created >= $1) ORDER BY id',
    [null]
  )
  assert.deepEqual(ids(unfiltered.rows), ['p1', 'p2', 'p3'])

  const filtered = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE ($1 IS NULL OR created >= $1) ORDER BY id',
    ['2026-03-01']
  )
  assert.deepEqual(ids(filtered.rows), ['p2', 'p3'])
})

test('repeated LIKE search parameter matches on every disjunct', async () => {
  // Only the second disjunct (note LIKE) matches; anonymous '?' binding
  // leaves it unbound (NULL) and returns zero rows.
  const { rows } = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE label LIKE $1 OR note LIKE $1 ORDER BY id',
    ['%note%']
  )
  assert.deepEqual(ids(rows), ['p2'])
})

test('reordered date-range filter parameters bind by number', async () => {
  const { rows } = await pool.query(
    'SELECT id FROM synthetic_param_probe WHERE created >= $2 AND created < $1 ORDER BY id',
    ['2026-06-01', '2026-01-01']
  )
  assert.deepEqual(ids(rows), ['p1', 'p2'])
})
