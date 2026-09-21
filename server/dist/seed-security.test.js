"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
// Each child gets a private database and cwd, preventing dotenv or a developer's
// DATABASE_URL from turning these regression tests into real facility writes.
function runIsolated(source, overrides = {}) {
    const directory = (0, node_fs_1.mkdtempSync)(node_path_1.default.join(node_os_1.default.tmpdir(), 'shoreline-seed-security-'));
    const env = {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        NODE_ENV: 'test',
        DATABASE_URL: '',
        SQLITE_PATH: node_path_1.default.join(directory, 'test.sqlite'),
        JWT_SECRET: 'synthetic-seed-test-jwt-secret-at-least-32-characters',
        SETUP_BOOTSTRAP_SECRET: 'synthetic-bootstrap-test-secret',
        ...overrides,
    };
    const result = (0, node_child_process_1.spawnSync)(process.execPath, ['-e', source], {
        cwd: directory, env, encoding: 'utf8', timeout: 60_000,
    });
    strict_1.default.equal(result.error, undefined, result.error?.message);
    strict_1.default.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return result.stdout + result.stderr;
}
const seedModule = JSON.stringify(node_path_1.default.join(__dirname, 'db', 'seed.js'));
const migrateModule = JSON.stringify(node_path_1.default.join(__dirname, 'db', 'migrate.js'));
const poolModule = JSON.stringify(node_path_1.default.join(__dirname, 'db', 'pool.js'));
const setupModule = JSON.stringify(node_path_1.default.join(__dirname, 'routes', 'setup.js'));
const authModule = JSON.stringify(node_path_1.default.join(__dirname, 'routes', 'auth.js'));
const expressModule = JSON.stringify(require.resolve('express'));
for (const scenario of [
    { name: 'unconfigured development', env: { NODE_ENV: 'development' } },
    { name: 'ordinary production', env: { NODE_ENV: 'production' } },
    { name: 'production with demo opt-in', env: { NODE_ENV: 'production', SHORELINE_DEMO_SEED: 'true' } },
]) {
    (0, node_test_1.test)(`exported seed refuses ${scenario.name} before database access`, () => {
        runIsolated(`
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      const { runSeed } = require(${seedModule});
      (async () => {
        await assert.rejects(runSeed(), error => error.status === 403);
        assert.equal(fs.existsSync(process.env.SQLITE_PATH), false);
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `, scenario.env);
    });
}
(0, node_test_1.test)('direct seed CLI cannot bypass production refusal', () => {
    runIsolated(`
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, [${seedModule}], { env: process.env, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /forbidden in production/);
    assert.equal(fs.existsSync(process.env.SQLITE_PATH), false);
  `, { NODE_ENV: 'production', SHORELINE_DEMO_SEED: 'true' });
});
(0, node_test_1.test)('explicit non-production demo opt-in allows the guarded seed entry', () => {
    // Stop at the first DB call: this tests the real exported entry without making
    // the regression depend on the unrelated large sample-data schema.
    runIsolated(`
    const assert = require('node:assert/strict');
    const { pool } = require(${poolModule});
    const { runSeed, isDemoSeedEnabled } = require(${seedModule});
    let writes = 0;
    pool.query = async () => { writes++; throw new Error('fixture-db-boundary'); };
    (async () => {
      assert.equal(isDemoSeedEnabled(), true);
      await assert.rejects(runSeed(), /fixture-db-boundary/);
      assert.equal(writes, 1);
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { SHORELINE_DEMO_SEED: 'true' });
});
(0, node_test_1.test)('explicit demo seeding still populates a disposable SQLite database without credential logging', () => {
    const output = runIsolated(`
    const assert = require('node:assert/strict');
    const { pool } = require(${poolModule});
    const { runMigrations } = require(${migrateModule});
    const { runSeed } = require(${seedModule});
    (async () => {
      await runMigrations();
      await runSeed();
      assert.equal((await pool.query('SELECT id FROM users')).rows.length, 5);
      assert.equal((await pool.query('SELECT id FROM residents')).rows.length, 54);
      assert.ok((await pool.query('SELECT id FROM recipes')).rows.length > 0);
      await pool.end();
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { SHORELINE_DEMO_SEED: 'true' });
    strict_1.default.doesNotMatch(output, /default password|password:/i);
});
(0, node_test_1.test)('protected production setup rejects sample flags without writes and creates a usable clean owner', () => {
    runIsolated(`
    const assert = require('node:assert/strict');
    const express = require(${expressModule});
    const { pool } = require(${poolModule});
    const { runMigrations } = require(${migrateModule});
    const { setupRouter } = require(${setupModule});
    const { authRouter } = require(${authModule});
    (async () => {
      await runMigrations();
      const app = express();
      app.use(express.json());
      app.use('/api/setup', setupRouter);
      app.use('/api/auth', authRouter);
      app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port;
      const body = {
        facilityName: 'Synthetic Test Facility', primaryContactEmail: 'contact@example.test',
        facilityType: 'Assisted Living', wings: ['Test Wing'], diningRooms: ['Test Room'],
        adminName: 'Test Owner', adminEmail: 'owner@example.test',
        adminPassword: 'SyntheticOnly-Password123!', baaSigneeName: 'Test Owner', initMode: 'clean'
      };
      const postSetup = (payload, authorized = true) => fetch(base + '/api/setup/initialize', {
        method: 'POST', headers: { 'content-type': 'application/json',
          ...(authorized ? { 'x-setup-secret': process.env.SETUP_BOOTSTRAP_SECRET } : {}) },
        body: JSON.stringify(payload)
      });
      try {
        assert.equal((await postSetup(body, false)).status, 401);
        assert.equal((await postSetup({ ...body, initMode: 'sample' })).status, 403);
        assert.equal((await postSetup({ ...body, loadDemoData: true })).status, 403);
        assert.equal((await pool.query('SELECT * FROM users')).rows.length, 0);
        assert.equal((await pool.query('SELECT * FROM residents')).rows.length, 0);
        const configs = (await pool.query('SELECT is_initialized FROM facility_config')).rows;
        assert.equal(configs.some(row => !!row.is_initialized), false);
        const created = await postSetup(body);
        assert.equal(created.status, 200, await created.text());
        const owners = (await pool.query('SELECT id, email, role FROM users')).rows;
        assert.equal(owners.length, 1);
        assert.match(owners[0].id, /^[0-9a-f-]{36}$/i);
        assert.equal(owners[0].role, 'admin');
        const login = await fetch(base + '/api/auth/login', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: body.adminEmail, password: body.adminPassword })
        });
        const session = await login.json();
        assert.equal(login.status, 200, JSON.stringify(session));
        assert.equal(session.user.id, owners[0].id);
        assert.ok(session.accessToken || session.mfaEnrollmentRequired);
        assert.equal((await postSetup(body)).status, 400);
        assert.equal((await pool.query('SELECT * FROM residents')).rows.length, 0);
      } finally {
        await new Promise(resolve => server.close(resolve));
        await pool.end();
      }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, { NODE_ENV: 'production', SHORELINE_DEMO_SEED: 'true' });
});
