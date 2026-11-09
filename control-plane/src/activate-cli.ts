import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { activateFacility, type ActivationInspector } from './activation'
import { getPool, closePool } from './db/pool'
import { migrate } from './db/migrate'

const execute = promisify(execFile)
const inspector: ActivationInspector = {
  async variables(project, environment, service) {
    // Capture privately: Railway variable output contains credentials.
    const executable = process.env.CONTROL_RAILWAY_EXECUTABLE || (process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@railway', 'cli', 'bin', 'railway.exe') : 'railway')
    const { stdout } = await execute(executable, ['variable', 'list', '--project', project, '--environment', environment, '--service', service, '--json'], {
      timeout: 30000, maxBuffer: 1024 * 1024, windowsHide: true,
    })
    const parsed: unknown = JSON.parse(stdout)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.values(parsed).some(value => value !== null && typeof value !== 'string')) throw new Error('INVALID_PROVIDER_RESPONSE')
    return parsed as Record<string, string | null>
  },
  async readiness(origin) {
    const check = async (pathname: string) => {
      const response = await fetch(origin + pathname, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error('PRODUCTION_READINESS_REQUIRED')
      return response.json() as Promise<Record<string, unknown>>
    }
    const [ready, setup] = await Promise.all([check('/api/ready'), check('/api/setup/status')])
    if (typeof setup.isInitialized !== 'boolean') throw new Error('INVALID_SETUP_STATUS')
    return { ready: ready.status === 'ready' && ready.database === 'connected', initialized: setup.isInitialized, demo: setup.sampleSeedAllowed === true }
  },
}

async function main() {
  if (process.argv[2] === '--help') {
    console.log('Owner only: node dist/activate-cli.js --activate metadata.json\nRequires authenticated Railway CLI, CONTROL_DATABASE_URL and CONTROL_OUTBOX_ENC_KEY.\nChecks pre-created customer resources; does not create resources, charge cards or issue licenses.')
    return
  }
  if (process.argv.length !== 4 || process.argv[2] !== '--activate') throw new Error('EXPLICIT_ACTIVATION_ARGUMENT_REQUIRED')
  const metadata: unknown = JSON.parse(await readFile(process.argv[3], 'utf8'))
  const pool = getPool()
  await migrate(pool)
  const result = await activateFacility(pool, metadata, inspector)
  console.log(JSON.stringify(result))
}

if (require.main === module) {
  main().catch(() => {
    // Never print provider stderr, URLs containing passwords or encryption input.
    console.error('Activation failed. Check verified account, requested plan, isolated production resources and operator configuration. No automatic provisioning was performed.')
    process.exitCode = 1
  }).finally(() => closePool())
}
