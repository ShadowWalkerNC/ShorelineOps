import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Bounded security-review regression: EHR PHI reads + backup/restore.
// Each child gets a private temp database and synthetic JWT secret only.
// No real facility data, no shared builds, no network, no secrets files.
function runIsolated(source: string, overrides: NodeJS.ProcessEnv = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'shoreline-recovery-access-'))
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    NODE_ENV: 'test',
    DATABASE_URL: '',
    SQLITE_PATH: path.join(directory, 'test.sqlite'),
    JWT_SECRET: 'synthetic-recovery-access-test-secret-32-chars-min',
    ...overrides,
  }
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: directory, env, encoding: 'utf8', timeout: 60_000,
  })
  assert.equal(result.error, undefined, result.error?.message)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
}

const ehrModule = JSON.stringify(path.join(__dirname, 'routes', 'ehr.js'))
const adminModule = JSON.stringify(path.join(__dirname, 'routes', 'admin.js'))
const authModule = JSON.stringify(path.join(__dirname, 'middleware', 'requireAuth.js'))
const poolModule = JSON.stringify(path.join(__dirname, 'db', 'pool.js'))
const migrateModule = JSON.stringify(path.join(__dirname, 'db', 'migrate.js'))
const expressModule = JSON.stringify(require.resolve('express'))
const fixtureModule = JSON.stringify(path.join(__dirname, 'test-support', 'accessToken.js'))

test('distributor denied EHR queue/census before querying (manager also denied)', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const express = require(${expressModule});
    const { issueTestAccessToken } = require(${fixtureModule});
    const { pool } = require(${poolModule});
    const { ehrRouter } = require(${ehrModule});
    const { runMigrations } = require(${migrateModule});
    (async () => {
      await runMigrations();
      const credentials = new Map();
      for (const role of ['distributor', 'manager']) credentials.set(role, await issueTestAccessToken({ sub: 'synthetic-' + role, role }));
      const seen = [];
      const rawQuery = pool.query.bind(pool);
      pool.query = async (sql, params) => {
        if (/FROM users u JOIN refresh_tokens rt/i.test(String(sql))) return rawQuery(sql, params);
        seen.push(String(sql)); return { rows: [] };
      };
      pool.connect = async () => { throw new Error('denied path must not open a transaction'); };
      const app = express();
      app.use(express.json());
      app.use('/api/ehr', ehrRouter);
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      const get = (url, role) => fetch(base + url, { headers: { authorization: 'Bearer ' + credentials.get(role) } });
      try {
        assert.equal((await get('/api/ehr/reconciliation-queue', 'distributor')).status, 403);
        assert.equal((await get('/api/ehr/census', 'distributor')).status, 403);
        assert.equal((await get('/api/ehr/reconciliation-queue', 'manager')).status, 403);
        assert.equal((await get('/api/ehr/census', 'manager')).status, 403);
        const clinical = seen.filter(sql => /residents|reconciliation_queue|census/i.test(sql));
        assert.deepEqual(clinical, []);
      } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `)
})

test('admin restore disabled: 503 with no clinical write; dryRun inspection-only cannot restore', () => {
  runIsolated(`
    const assert = require('node:assert/strict');
    const express = require(${expressModule});
    const { issueTestAccessToken } = require(${fixtureModule});
    const { pool } = require(${poolModule});
    const { runMigrations } = require(${migrateModule});
    const { requireAuth } = require(${authModule});
    const { adminRouter } = require(${adminModule});
    (async () => {
      await runMigrations();
      const app = express();
      app.use(express.json());
      app.use('/api/admin', requireAuth, adminRouter);
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      const adminToken = await issueTestAccessToken({ sub: 'synthetic-admin', role: 'admin' });
      const crafted = { meta: { application: 'Shoreline Care OS', facilityName: 'Synthetic', exportedAt: new Date().toISOString() },
        data: { residents: [{ id: 'synthetic-1', name: 'Synthetic Patient', is_npo: true, allergies: ['Peanut'], diet_type: 'NPO', texture: 'Minced' }],
        recipes: [], inventory: [] } };
      let clinicalWrites = 0;
      const rawQuery = pool.query.bind(pool);
      pool.query = async (sql, params) => {
        if (/^\\s*(INSERT|UPDATE|DELETE)/i.test(String(sql)) && /residents/i.test(String(sql))) clinicalWrites++;
        return rawQuery(sql, params);
      };
      const postRestore = (qs) => fetch(base + '/api/admin/backup/restore' + qs, { method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + adminToken },
        body: JSON.stringify(crafted) });
      try {
        const blocked = await postRestore('');
        assert.equal(blocked.status, 503);
        const body = await blocked.json();
        assert.equal(body.restorable, false);
        assert.match(String(body.code || body.error), /RECOVERY_UNAVAILABLE|Recovery unavailable/);
        assert.match(String(body.guidance || ''), /controlled full database recovery/i);
        assert.equal(clinicalWrites, 0);
        assert.equal((await rawQuery('SELECT * FROM residents')).rows.length, 0);
        const dry = await postRestore('?dryRun=true');
        assert.equal(dry.status, 200);
        const report = await dry.json();
        assert.equal(report.inspectionOnly, true);
        assert.equal(report.restorable, false);
        assert.equal(report.valid, false);
        assert.equal(report.summary.residentsToRestore, 1);
        assert.equal(clinicalWrites, 0);
        assert.equal((await rawQuery('SELECT * FROM residents')).rows.length, 0);
      } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `)
})
