import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = mkdtempSync(path.join(tmpdir(), 'shoreline-regression-'))
const dist = path.join(root, 'server', 'dist')
// Do not inherit database credentials or load a developer's .env in tests.
const env = {
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP, TMP: process.env.TMP, NODE_ENV: 'test',
  DATABASE_URL: '', SQLITE_PATH: path.join(directory, 'system.sqlite'),
  JWT_SECRET: randomBytes(32).toString('hex'), SHORELINE_FACILITY_ID: 'default',
}
function run(args, cwd, childEnv = env) {
  const result = spawnSync(process.execPath, args, { cwd, env: childEnv, stdio: 'inherit', timeout: 180_000 })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
run([path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', path.join(root, 'server', 'tsconfig.json')], root)
run([path.join(dist, 'system.test.js')], directory)
const cases = readdirSync(dist).filter(name => name.endsWith('.test.js') && !['system.test.js', 'compliance.test.js'].includes(name))
run(['--test', ...cases.map(name => path.join(dist, name))], directory)
