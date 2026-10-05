import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Deliberately accepts no URLs, passwords, production identities or arbitrary SQL.
const [containerId, sourceDb = 'shoreline_acceptance', ...extra] = process.argv.slice(2)
if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'linux' ||
    !/^[a-f0-9]{64}$/.test(containerId || '') || !/^shoreline_acceptance(?:_[a-z0-9_]+)?$/.test(sourceDb) || extra.length ||
    process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) {
  throw new Error('Restore drill requires GitHub Linux CI, its explicit disposable service container ID and a shoreline_acceptance database')
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024, ...options })
  if (result.error || result.status !== 0) throw new Error(`Restore drill command failed: ${command} (exit ${result.status ?? 'unavailable'})`)
  return result.stdout.trim()
}
if (run('docker', ['context', 'show']) !== 'default') throw new Error('Remote/custom Docker contexts are refused')
const inspected = JSON.parse(run('docker', ['inspect', containerId]))[0]
const env = new Set(inspected.Config.Env)
if (!['postgres:16', 'docker.io/library/postgres:16'].includes(inspected.Config.Image) || !inspected.State.Running ||
    !env.has('POSTGRES_USER=shoreline_test') || !env.has('POSTGRES_PASSWORD=disposable_test_only') ||
    !env.has(`POSTGRES_DB=${sourceDb}`) || inspected.Mounts.some(mount => mount.Type === 'bind')) {
  throw new Error('Container is not the disposable PostgreSQL 16 acceptance service')
}
const containerName = inspected.Name.replace(/^\//, '')
const dbUser = 'shoreline_test'
const psql = (database, sql) => run('docker', ['exec', '-i', containerId, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', database], { input: `SET TIME ZONE 'UTC';\n${sql}` })
const tables = JSON.parse(psql(sourceDb, "SELECT json_agg(tablename ORDER BY tablename) FROM pg_tables WHERE schemaname='public';"))
if (!tables || !['residents', 'ehr_reconciliation_queue', 'audit_log', 'tray_events'].every(name => tables.includes(name)) ||
    tables.some(name => !/^[a-z_][a-z0-9_]*$/.test(name))) throw new Error('Expected migrated synthetic acceptance fixture missing')
const clinicalSql = `SELECT json_build_object(
  'residents', (SELECT count(*) FROM residents),
  'npo', (SELECT count(*) FROM residents WHERE name='Patient Concurrency Test' AND is_npo AND profile_version=2),
  'allergens', (SELECT count(*) FROM residents WHERE name='Concurrent Resident' AND profile_version=2 AND allergies=ARRAY['Fish','Shellfish']::text[]),
  'decisions', (SELECT count(*) FROM ehr_reconciliation_queue WHERE status='APPROVED_BY_RD'),
  'audit', (SELECT count(*) FROM audit_log),
  'assembled', (SELECT count(*) FROM tray_events WHERE event='assembled'),
  'dispatched', (SELECT count(*) FROM tray_events WHERE event='dispatched'));`
const clinical = JSON.parse(psql(sourceDb, clinicalSql))
if (clinical.residents !== 2 || clinical.npo !== 1 || clinical.allergens !== 1 || clinical.decisions !== 1 ||
    clinical.audit < 1 || clinical.assembled !== 1 || clinical.dispatched !== 0) throw new Error('Synthetic clinical/EHR/audit fixture did not meet safety invariants')
// Compare every table's row count and canonical full-row fingerprint, without logging records.
const dataSql = tables.map(name => `SELECT '${name}' AS name, count(*) AS rows, md5(coalesce(string_agg(to_jsonb(t)::text, E'\\n' ORDER BY to_jsonb(t)::text), '')) AS digest FROM "${name}" t`).join('\nUNION ALL\n') + '\nORDER BY name;'
const schemaSql = `SELECT md5(string_agg(kind || ':' || definition, E'\\n' ORDER BY kind, definition)) FROM (
  SELECT 'column' kind, table_name || ':' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default,'') definition FROM information_schema.columns WHERE table_schema='public'
  UNION ALL SELECT 'constraint', c.relname || ':' || con.conname || ':' || pg_get_constraintdef(con.oid) FROM pg_constraint con JOIN pg_class c ON con.conrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public'
  UNION ALL SELECT 'trigger', pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON t.tgrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND NOT t.tgisinternal
) s;`
const originalData = psql(sourceDb, dataSql), originalSchema = psql(sourceDb, schemaSql)
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-ci-restore-'))
fs.chmodSync(work, 0o700)
const backupDir = path.join(work, 'artifacts'), keyFile = path.join(work, 'escrow.key')
fs.writeFileSync(keyFile, randomBytes(32).toString('hex'), { mode: 0o600 })
const restoreDb = `shoreline_restore_${randomBytes(8).toString('hex')}`
let created = false
const started = performance.now()
try {
  // Existing scheduled backup path, real pg_dump inside the same PostgreSQL image.
  run('bash', [path.join(root, 'scripts/backup.sh')], { env: { ...process.env, BACKUP_DIR: backupDir, BACKUP_KEY_FILE: keyFile, CONTAINER_NAME: containerName, DB_USER: dbUser, DB_NAME: sourceDb, DATABASE_URL: '' } })
  const artifacts = fs.readdirSync(backupDir).filter(name => name.endsWith('.sql.gz.enc'))
  if (artifacts.length !== 1) throw new Error('Expected one encrypted logical backup')
  const recoveredGzip = path.join(work, 'recovered.gz')
  run(process.execPath, [path.join(root, 'scripts/backup-tool.mjs'), 'decrypt', '--key-file', keyFile, path.join(backupDir, artifacts[0]), recoveredGzip])
  const dump = gunzipSync(fs.readFileSync(recoveredGzip))
  if (!dump.length) throw new Error('Authenticated dump was empty')
  // CREATE DATABASE fails if name already exists; never DROP/replace existing databases.
  psql('postgres', `CREATE DATABASE "${restoreDb}" TEMPLATE template0;`)
  created = true
  run('docker', ['exec', '-i', containerId, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', restoreDb], { input: dump })
  if (psql(restoreDb, dataSql) !== originalData || psql(restoreDb, schemaSql) !== originalSchema) throw new Error('Full table/schema restoration comparison failed')
  if (JSON.stringify(JSON.parse(psql(restoreDb, clinicalSql))) !== JSON.stringify(clinical)) throw new Error('Restored clinical acceptance invariants differ')
  // Real database guard remains append-only after restoration.
  const forbidden = spawnSync('docker', ['exec', '-i', containerId, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', restoreDb], { input: 'UPDATE audit_log SET action=action;', encoding: 'utf8', timeout: 30000 })
  if (forbidden.error || forbidden.status === 0 || !forbidden.stderr.includes('append-only')) throw new Error('Restored audit immutability guard was not enforced')
  console.log(JSON.stringify({ status: 'PASS', postgres: 16, tables: tables.length, clinicalInvariants: clinical, logicalRestoreMilliseconds: Math.round(performance.now() - started), scope: 'synthetic CI logical backup/restore; not facility RPO/RTO or off-host recovery' }))
} finally {
  try {
    if (created) psql('postgres', `DROP DATABASE "${restoreDb}";`)
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}
