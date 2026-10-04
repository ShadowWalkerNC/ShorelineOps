import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

test('PostgreSQL acceptance rejects missing, production and URL-override targets before any database work', () => {
  const script = path.resolve(__dirname, '../../scripts/run-postgres-acceptance.mjs')
  for (const target of ['',
    'postgresql://example.invalid/shoreline_acceptance',
    'postgresql://127.0.0.1/production',
    'postgresql://127.0.0.1/shoreline_acceptance?host=example.invalid',
  ]) {
    const result = spawnSync(process.execPath, [script], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
        SHORELINE_TEST_POSTGRES_URL: target },
      encoding: 'utf8', timeout: 5000,
    })
    assert.equal(result.status, 1)
    assert.match(result.stderr, /Configure SHORELINE_TEST_POSTGRES_URL|Only a loopback/)
    assert.doesNotMatch(result.stdout, /migrate|SQLite|PASS/)
  }
})
