import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Explicitly opt into an isolated local test database, never inherit a
// developer/production DATABASE_URL or silently fall back to SQLite.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const configured = process.env.SHORELINE_TEST_POSTGRES_URL
let url
try { url = new URL(configured || '') } catch { throw new Error('Configure SHORELINE_TEST_POSTGRES_URL for a disposable local database') }
if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/shoreline_acceptance(?:_[a-z0-9_]+)?$/.test(url.pathname) || url.search) {
  throw new Error('Only a loopback shoreline_acceptance database without URL options is allowed')
}
url.searchParams.set('sslmode', 'disable') // disposable loopback service only
const require = createRequire(import.meta.url)
const { Client } = require('pg')
const client = new Client({ connectionString: url.toString(), ssl: false, connectionTimeoutMillis: 5000 })
try {
  await client.connect()
  const { rows } = await client.query("SELECT COUNT(*)::int AS count FROM pg_tables WHERE schemaname = 'public'")
  if (rows[0].count !== 0) throw new Error('Test database is not empty')
} catch {
  throw new Error('Acceptance requires an accessible, empty disposable local PostgreSQL database')
} finally { await client.end() }
const env = {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP, TMP: process.env.TMP,
  NODE_ENV: 'test', DATABASE_URL: url.toString(),
  JWT_SECRET: randomBytes(32).toString('hex'), SHORELINE_FACILITY_ID: 'default',
}
for (const args of [
  [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', path.join(root, 'server/tsconfig.json')],
  ['--test', path.join(root, 'server/dist/postgres-acceptance.test.js')],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', timeout: 180000 })
  if (result.error) throw new Error('PostgreSQL acceptance process failed or timed out')
  if (result.status !== 0) process.exit(result.status ?? 1)
}
