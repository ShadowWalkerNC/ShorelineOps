import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Structural regression for unified production build separation
// (scripts/build_unified_site.mjs). No database, network, container,
// secret, or shared-build access: the builder source is asserted statically
// and its real productionEnv helper is executed against hostile parent envs.
// Safe to run alongside other workstreams; it never touches dist/.
//
// Incident: the live /app bundle shipped with import.meta.env.DEV=true
// (inherited NODE_ENV=development), so AuthContext/seed demo branches
// compiled in: a synthetic demo user appeared in sessionStorage and
// /app/login <-> /app looped forever. Vite derives DEV from NODE_ENV,
// not from --mode, and a .env file carrying NODE_ENV=development can
// also downgrade the build — so the builder must pin NODE_ENV and
// VITE_USER_NODE_ENV to production for every production child.

const repoRoot = path.resolve(__dirname, '..', '..')
assert.ok(
  fs.existsSync(path.join(repoRoot, 'package.json')) && fs.existsSync(path.join(repoRoot, 'server', 'package.json')),
  `repoRoot resolved to ${repoRoot}, which is not the repository root.`
)
const builderPath = path.join(repoRoot, 'scripts', 'build_unified_site.mjs')
const src = fs.readFileSync(builderPath, 'utf8')

// Execute the REAL helper verbatim (extracted from the builder source) with
// a fake `process`, so the env matrix below tests builder code, not a copy.
const helperMatch = src.match(/function productionEnv\s*\(\s*extra\s*\)\s*\{([\s\S]*?)\n\}/)
assert.ok(helperMatch, 'builder defines productionEnv(extra)')
const helperBody = helperMatch[1] as string
type Env = Record<string, string | undefined>
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const productionEnv = new Function('extra', 'process', helperBody) as unknown as (
  extra: Env,
  proc: { env: Env },
) => Env

test('every production step routes its child env through productionEnv', () => {
  const execCount = (src.match(/execSync\(/g) || []).length
  const helperUses = (src.match(/productionEnv\(\{/g) || []).length
  assert.equal(execCount, 3, 'marketing + demo + app execSync calls')
  assert.equal(helperUses, execCount, 'each step wraps its env in productionEnv()')
})

test('productionEnv pins are authoritative over inherited env and extras', () => {
  const iParent = helperBody.indexOf('...process.env')
  const iExtra = helperBody.indexOf('...extra')
  const iNode = helperBody.indexOf("NODE_ENV: 'production'")
  const iUser = helperBody.indexOf("VITE_USER_NODE_ENV: 'production'")
  assert.ok(iParent !== -1, 'passes hosting env through (...process.env)')
  assert.ok(iExtra !== -1, 'applies per-build extras (...extra)')
  assert.ok(iNode !== -1 && iUser !== -1, 'pins NODE_ENV and VITE_USER_NODE_ENV')
  assert.ok(iParent < iExtra, 'per-build extras override inherited env')
  assert.ok(iExtra < iNode && iExtra < iUser, 'production pins come last: nothing can downgrade them')
})

test('all production vite builds pin --mode production', () => {
  const viteCmds = src.match(/npx vite build [^\n'"]*/g) || []
  assert.equal(viteCmds.length, 2, 'demo + app vite builds')
  for (const cmd of viteCmds) assert.ok(cmd.includes('--mode production'), cmd)
})

test('demo/app bases and demo flags stay separated', () => {
  const demoIdx = src.indexOf('--base=/demo/')
  const appIdx = src.indexOf('--base=/app/')
  assert.ok(demoIdx !== -1 && appIdx !== -1 && demoIdx < appIdx, 'demo build precedes app build')
  const marketingBlock = src.slice(0, demoIdx)
  const demoBlock = src.slice(demoIdx, appIdx)
  const appBlock = src.slice(appIdx)
  assert.ok(marketingBlock.includes("PUBLIC_DEMO_URL: '/demo'"), 'marketing keeps PUBLIC_DEMO_URL')
  assert.ok(marketingBlock.includes("PUBLIC_APP_URL: '/app'"), 'marketing keeps PUBLIC_APP_URL')
  assert.ok(!marketingBlock.includes('VITE_DEMO_MODE'), 'marketing takes no demo flag')
  assert.ok(demoBlock.includes("VITE_BASE_PATH: '/demo/'"), 'demo keeps base /demo/')
  assert.ok(demoBlock.includes("VITE_DEMO_MODE: 'true'"), 'demo keeps demo flag on')
  assert.ok(!demoBlock.includes("VITE_DEMO_MODE: 'false'"), 'demo flag never off in demo block')
  assert.ok(appBlock.includes("VITE_BASE_PATH: '/app/'"), 'app keeps base /app/')
  assert.ok(appBlock.includes("VITE_DEMO_MODE: 'false'"), 'app keeps demo flag off')
  assert.ok(!appBlock.includes("VITE_DEMO_MODE: 'true'"), 'demo flag never on in app block')
})

test('builder never selects a development build', () => {
  // Strip comments: prose may name the hostile value, executable code must not.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
  assert.ok(!code.includes('--mode development'), 'no dev mode flag')
  assert.ok(!code.includes("NODE_ENV: 'development'"), 'no dev NODE_ENV pin')
  assert.ok(!code.includes('NODE_ENV=development'), 'no dev NODE_ENV assignment')
})

test('hostile parent env cannot downgrade production pins (matrix)', () => {
  const hostileParents: Env[] = [
    // Worst case: dev shell + dev leak + demo-flag/base leak.
    { NODE_ENV: 'development', VITE_USER_NODE_ENV: 'development', VITE_DEMO_MODE: 'true', VITE_BASE_PATH: '/evil/' },
    // Reported incident: inherited dev NODE_ENV, shell otherwise clean.
    { NODE_ENV: 'development' },
    { NODE_ENV: 'test' },
    // Shell NODE_ENV unset: .env NODE_ENV=development must still not win.
    {},
    { VITE_USER_NODE_ENV: 'development' },
    { NODE_ENV: 'production', VITE_USER_NODE_ENV: 'production' },
  ]
  const buildExtras: Array<{ name: string; extra: Env; expect: Env }> = [
    {
      name: 'marketing',
      extra: { PUBLIC_DEMO_URL: '/demo', PUBLIC_APP_URL: '/app' },
      expect: { PUBLIC_DEMO_URL: '/demo', PUBLIC_APP_URL: '/app' },
    },
    {
      name: 'demo',
      extra: { VITE_BASE_PATH: '/demo/', VITE_DEMO_MODE: 'true' },
      expect: { VITE_BASE_PATH: '/demo/', VITE_DEMO_MODE: 'true' },
    },
    {
      name: 'app',
      extra: { VITE_BASE_PATH: '/app/', VITE_DEMO_MODE: 'false' },
      expect: { VITE_BASE_PATH: '/app/', VITE_DEMO_MODE: 'false' },
    },
  ]
  for (const parent of hostileParents) {
    for (const { name, extra, expect } of buildExtras) {
      // Benign hosting config must pass through untouched.
      const withHosting = { ...parent, VITE_API_URL: 'https://api.example.com' }
      const child = productionEnv(extra, { env: withHosting })
      const label = `${name} <- ${JSON.stringify(parent)}`
      assert.equal(child.NODE_ENV, 'production', `${label}: NODE_ENV pinned`)
      assert.equal(child.VITE_USER_NODE_ENV, 'production', `${label}: VITE_USER_NODE_ENV pinned`)
      for (const [key, value] of Object.entries(expect)) {
        assert.equal(child[key], value, `${label}: ${key} kept`)
      }
      assert.equal(child.VITE_API_URL, 'https://api.example.com', `${label}: hosting passthrough kept`)
    }
  }
})

test('live app env can never carry a demo flag or dev base', () => {
  const appExtra = { VITE_BASE_PATH: '/app/', VITE_DEMO_MODE: 'false' }
  const child = productionEnv(appExtra, {
    env: { NODE_ENV: 'development', VITE_DEMO_MODE: 'true', VITE_BASE_PATH: '/demo/' },
  })
  assert.equal(child.VITE_DEMO_MODE, 'false', 'app demo flag stays off under a demo-flag leak')
  assert.equal(child.VITE_BASE_PATH, '/app/', 'app base stays /app/ under a base leak')
  assert.equal(child.NODE_ENV, 'production', 'app NODE_ENV stays production under a dev leak')
})
