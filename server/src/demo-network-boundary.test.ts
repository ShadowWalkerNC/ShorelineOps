import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Focused tests for the demo-only raw-fetch boundary (`src/demo/networkBoundary.ts`).
// No database, network, container, or secret access: the client module is loaded
// from source text and transpiled with the repo's own TypeScript (same pattern
// as deployment-config.test.ts loading js-yaml by absolute path), then exercised
// through injected fake scopes/spies. The real global fetch is never touched.

const repoRoot = path.resolve(__dirname, '..', '..')
const boundaryPath = path.join(repoRoot, 'src', 'demo', 'networkBoundary.ts')
const mainPath = path.join(repoRoot, 'src', 'main.tsx')

interface DemoApiMatchConfig {
  apiUrl?: string | null
  baseUrl?: string | null
}

interface FakeScope {
  fetch: (input: unknown, init?: unknown) => Promise<unknown>
  location?: { href?: string; origin?: string }
  [key: string]: unknown
}

interface InstallOptions extends DemoApiMatchConfig {
  scope: FakeScope
  demoMode: unknown
  fetchImpl?: ((input: unknown, init?: unknown) => Promise<unknown>) | null
}

// Structural mirror of the client module's public API. No static import: the
// server tsconfig rootDir is ./src, so the client file is loaded from source.
interface BoundaryModule {
  DEMO_API_UNAVAILABLE: string
  DEMO_API_UNAVAILABLE_MESSAGE: string
  createDemoApiUnavailableError: () => Error & { code: string }
  isDemoModeEnabled: (demoMode: unknown) => boolean
  isDemoApiRequest: (input: string | URL | Request, config?: DemoApiMatchConfig) => boolean
  installDemoNetworkBoundary: (options: InstallOptions) => () => void
}

function loadBoundary(): BoundaryModule {
  assert.ok(fs.existsSync(boundaryPath), `missing client boundary module at ${boundaryPath}`)
  const source = fs.readFileSync(boundaryPath, 'utf8')
  assert.ok(
    source.includes('DEMO_API_UNAVAILABLE'),
    'client boundary source must define the demo error code',
  )
  // The repo's own TypeScript by absolute path (no new installs allowed).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ts = require(path.join(repoRoot, 'node_modules', 'typescript')) as {
    transpileModule(source: string, options: unknown): { outputText: string }
    ModuleKind: { CommonJS: unknown }
    ScriptTarget: { ES2022: unknown }
  }
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const moduleObj = { exports: {} as Record<string, unknown> }
  // Same-realm evaluation so instanceof URL/Request matches the test realm.
  const factory = new Function('exports', 'module', 'require', transpiled) as (
    exports: unknown,
    module: { exports: unknown },
    require: NodeRequire,
  ) => void
  factory(moduleObj.exports, moduleObj, require)
  return moduleObj.exports as unknown as BoundaryModule
}

const boundary = loadBoundary()

const PAGE = 'https://demo.example.com/app/menu'
const AUTH_INIT = { headers: { Authorization: 'Bearer live-token-must-never-transmit' } }
const FORWARDED = { ok: true, marker: 'forwarded-to-original-fetch' }

interface SpyCall {
  input: unknown
  init: unknown
}

function makeScope(href: string = PAGE): { scope: FakeScope; calls: SpyCall[] } {
  const calls: SpyCall[] = []
  const scope: FakeScope = {
    location: { href, origin: new URL(href).origin },
    fetch: (input: unknown, init?: unknown) => {
      calls.push({ input, init })
      return Promise.resolve(FORWARDED)
    },
  }
  return { scope, calls }
}

function installDemo(
  scope: FakeScope,
  overrides: Partial<InstallOptions> = {},
): () => void {
  return boundary.installDemoNetworkBoundary({
    scope,
    demoMode: 'true',
    apiUrl: '/api',
    ...overrides,
  })
}

async function expectBlocked(
  fetchFn: (input: unknown, init?: unknown) => Promise<unknown>,
  input: unknown,
  init?: unknown,
): Promise<Error & { code?: unknown }> {
  const settled = await fetchFn(input, init).then(
    (value) => ({ resolved: true as const, value }),
    (error: unknown) => ({ resolved: false as const, error }),
  )
  assert.equal(settled.resolved, false, 'blocked API request must reject, never resolve')
  assert.ok(!settled.resolved)
  const error = settled.error as Error & { code?: unknown }
  assert.ok(error instanceof Error, 'rejection must be an Error')
  assert.equal(error.code, 'DEMO_API_UNAVAILABLE')
  assert.match(error.message, /backend workflow unavailable in public demo/)
  return error
}

test('loads the real client boundary module with the demo error contract', () => {
  assert.equal(boundary.DEMO_API_UNAVAILABLE, 'DEMO_API_UNAVAILABLE')
  assert.equal(boundary.DEMO_API_UNAVAILABLE_MESSAGE, 'backend workflow unavailable in public demo')
  const error = boundary.createDemoApiUnavailableError()
  assert.ok(error instanceof Error)
  assert.equal(error.code, 'DEMO_API_UNAVAILABLE')
  assert.match(error.message, /backend workflow unavailable in public demo/)
})

test('main.tsx installs the guard before React/AuthProvider mount behind VITE_DEMO_MODE', () => {
  const main = fs.readFileSync(mainPath, 'utf8')
  assert.ok(main.includes('./demo/networkBoundary'), 'main.tsx must import the boundary module')
  const gate = "import.meta.env.VITE_DEMO_MODE === 'true'"
  assert.ok(main.includes(gate), 'install must be gated on VITE_DEMO_MODE===true (not DEV alone)')
  const installAt = main.indexOf('installDemoNetworkBoundary(')
  assert.ok(installAt > 0, 'main.tsx must call installDemoNetworkBoundary')
  const gateAt = main.lastIndexOf(gate, installAt)
  assert.ok(gateAt >= 0 && gateAt < installAt, 'gate must precede the install call')
  const installBlock = main.slice(gateAt, installAt + 400)
  assert.ok(
    !installBlock.includes('import.meta.env.DEV'),
    'install block must not depend on DEV',
  )
  for (const marker of ['createRoot(', '<AuthProvider']) {
    const at = main.indexOf(marker)
    assert.ok(at > installAt, `install must precede ${marker}`)
  }
})

test('demo gate accepts only VITE_DEMO_MODE=true', () => {
  assert.equal(boundary.isDemoModeEnabled('true'), true)
  assert.equal(boundary.isDemoModeEnabled(true), true)
  for (const off of [false, 'false', undefined, null, '', '1', 1, 'TRUE', 'yes']) {
    assert.equal(boundary.isDemoModeEnabled(off), false, `demoMode ${String(off)} must not enable`)
  }
})

test('blocked string requests reject and never forward auth headers', async () => {
  const { scope, calls } = makeScope()
  installDemo(scope)
  const blocked = [
    '/api/residents',
    '/api',
    '/api/',
    '/api?boot=1',
    '/api/kitchen/sheet?week=1&day=mon&meal=lunch',
    '/api/trayruns/ensure',
    '/api/auth/refresh',
    'https://demo.example.com/api/residents',
    'https://demo.example.com/api/kitchen/orders?week=3',
  ]
  for (const input of blocked) {
    await expectBlocked(scope.fetch, input, AUTH_INIT)
  }
  assert.equal(calls.length, 0, 'blocked requests must not reach the original fetch')
})

test('Request and URL inputs are blocked without transmission', async () => {
  const { scope, calls } = makeScope()
  installDemo(scope)
  const req = new Request('https://demo.example.com/api/residents', {
    headers: { Authorization: 'Bearer live-token-must-never-transmit' },
  })
  await expectBlocked(scope.fetch, req)
  await expectBlocked(scope.fetch, new URL('https://demo.example.com/api/kitchen/orders?week=3'))
  await expectBlocked(
    scope.fetch,
    new Request('https://demo.example.com/api/auth/refresh', { method: 'POST' }),
  )
  assert.equal(calls.length, 0, 'Request/URL API inputs must not reach the original fetch')
})

test('non-API same-origin traffic is forwarded untouched', async () => {
  const { scope, calls } = makeScope()
  installDemo(scope)
  const allowed = [
    '/apiary/menu',
    '/apiary',
    '/api-docs',
    '/assets/app-123.js',
    '/fonts/inter.woff2',
    '/marketing/pricing',
    '/',
    '/login',
    '/menu',
    '/setup',
    'https://demo.example.com/assets/app.js',
    'https://demo.example.com/apiary/x',
    'https://cdn.example.com/lib.js',
    'https://cdn.example.com/api/x',
    'data:text/plain,hello',
  ]
  for (const input of allowed) {
    const result = await scope.fetch(input, { headers: { 'X-Keep': 'me' } })
    assert.deepEqual(result, FORWARDED, `${input} must delegate to the original fetch`)
  }
  assert.equal(calls.length, allowed.length)
  assert.deepEqual(calls[0].init, { headers: { 'X-Keep': 'me' } })
  assert.equal(calls[0].input, '/apiary/menu')
})

test('relative API config blocks only its path prefix, never the site', async () => {
  const { scope, calls } = makeScope()
  installDemo(scope, { apiUrl: '/custom/api' })
  for (const input of ['/custom/api/orders', '/custom/api', '/custom/api/auth/refresh']) {
    await expectBlocked(scope.fetch, input, AUTH_INIT)
  }
  // Default same-origin /api rule still applies alongside a custom prefix.
  await expectBlocked(scope.fetch, '/api/residents', AUTH_INIT)
  for (const input of ['/custom/apiary', '/custom/other', '/', '/menu', '/assets/x.js', '/custom']) {
    assert.deepEqual(await scope.fetch(input), FORWARDED, `${input} must stay allowed`)
  }
  assert.equal(calls.length, 6)
})

test('remote API-base root blocks the whole remote origin regardless of path', async () => {
  for (const apiUrl of ['https://api.example.com', 'https://api.example.com/']) {
    const { scope, calls } = makeScope()
    installDemo(scope, { apiUrl })
    for (const input of [
      'https://api.example.com/anything/at/all',
      'https://api.example.com/auth/refresh',
      'https://api.example.com/v1/orders?week=2',
      'https://api.example.com/',
    ]) {
      await expectBlocked(scope.fetch, input, AUTH_INIT)
    }
    // Same-origin /api rule still applies; the site and other hosts pass through.
    await expectBlocked(scope.fetch, '/api/residents', AUTH_INIT)
    for (const input of ['/menu', '/', 'https://other.example.com/api/x']) {
      assert.deepEqual(await scope.fetch(input), FORWARDED, `${input} must stay allowed`)
    }
    assert.equal(calls.length, 3, `apiUrl ${apiUrl} forwarded exactly the allowed set`)
  }
})

test('remote sub-path API blocks origin+prefix only', async () => {
  const { scope, calls } = makeScope()
  installDemo(scope, { apiUrl: 'https://api.example.com/v1' })
  for (const input of [
    'https://api.example.com/v1/orders',
    'https://api.example.com/v1/auth/refresh',
    'https://api.example.com/v1',
  ]) {
    await expectBlocked(scope.fetch, input, AUTH_INIT)
  }
  for (const input of [
    'https://api.example.com/v2/orders',
    'https://api.example.com/v1ary',
    'https://api.example.com/other',
    'https://api.example.com/',
  ]) {
    assert.deepEqual(await scope.fetch(input), FORWARDED, `${input} must stay allowed`)
  }
  assert.equal(calls.length, 4)
})

test('same-origin absolute API config behaves like a relative prefix', async () => {
  const { scope, calls } = makeScope()
  installDemo(scope, { apiUrl: 'https://demo.example.com/api' })
  await expectBlocked(scope.fetch, '/api/residents', AUTH_INIT)
  await expectBlocked(scope.fetch, 'https://demo.example.com/api/x', AUTH_INIT)
  assert.deepEqual(await scope.fetch('/'), FORWARDED)
  assert.deepEqual(await scope.fetch('/menu'), FORWARDED)
  assert.equal(calls.length, 2)
})

test('live-disabled installs leave fetch untouched and delegate everything', async () => {
  for (const demoMode of [false, 'false', undefined, null, '', 0]) {
    const { scope, calls } = makeScope()
    const original = scope.fetch
    const restore = boundary.installDemoNetworkBoundary({ scope, demoMode, apiUrl: '/api' })
    assert.equal(scope.fetch, original, `demoMode ${String(demoMode)} must not wrap fetch`)
    assert.deepEqual(await scope.fetch('/api/residents', AUTH_INIT), FORWARDED)
    assert.equal(calls.length, 1)
    restore()
    assert.equal(scope.fetch, original)
  }
  assert.equal(
    (globalThis as Record<string, unknown>).__shorelineDemoFetchBoundaryInstalled,
    undefined,
    'tests must not touch the real global scope',
  )
})

test('installation is idempotent and restore unwraps exactly once', async () => {
  const { scope, calls } = makeScope()
  const original = scope.fetch
  const restoreFirst = installDemo(scope)
  const guarded = scope.fetch
  assert.notEqual(guarded, original)
  const restoreSecond = installDemo(scope)
  assert.equal(scope.fetch, guarded, 'second install must not double-wrap')
  await expectBlocked(scope.fetch, '/api/residents', AUTH_INIT)
  assert.equal(calls.length, 0)
  restoreSecond()
  assert.equal(scope.fetch, guarded, 'redundant restore must be a no-op')
  restoreFirst()
  assert.equal(scope.fetch, original)
  assert.deepEqual(await scope.fetch('/api/residents', AUTH_INIT), FORWARDED)
  restoreFirst()
  assert.equal(scope.fetch, original, 'restore must be one-shot')
  // Re-install after restore works again.
  installDemo(scope)
  await expectBlocked(scope.fetch, '/api/residents', AUTH_INIT)
  assert.equal(calls.length, 1, 'only the post-restore request was forwarded')
})

test('fetchImpl injection wraps the injected fetch, not scope.fetch', async () => {
  const injectedCalls: SpyCall[] = []
  const scopeCalls: SpyCall[] = []
  const scope: FakeScope = {
    location: { href: PAGE },
    fetch: (input: unknown, init?: unknown) => {
      scopeCalls.push({ input, init })
      return Promise.resolve({ marker: 'scope-fetch' })
    },
  }
  installDemo(scope, {
    fetchImpl: (input: unknown, init?: unknown) => {
      injectedCalls.push({ input, init })
      return Promise.resolve(FORWARDED)
    },
  })
  await expectBlocked(scope.fetch, '/api/residents', AUTH_INIT)
  assert.deepEqual(await scope.fetch('/menu'), FORWARDED)
  assert.equal(injectedCalls.length, 1, 'allowed requests use the injected fetch')
  assert.equal(scopeCalls.length, 0, 'scope.fetch must not be called while guarded')
})

test('predicate boundary details are exact, not substring matches', () => {
  const baseUrl = PAGE
  const blocked: Array<[string | URL, DemoApiMatchConfig?]> = [
    ['/api'],
    ['/api/'],
    ['/api?x=1'],
    ['/api#frag'],
    ['/api/x'],
    [new URL('https://demo.example.com/api/x')],
  ]
  for (const [input, extra] of blocked) {
    assert.equal(
      boundary.isDemoApiRequest(input, { baseUrl, ...extra }),
      true,
      `${String(input)} must be classified as an API request`,
    )
  }
  const allowed: Array<[string, DemoApiMatchConfig?]> = [
    ['/apiary'],
    ['/apiary/x'],
    ['/api-docs'],
    ['/apis'],
    ['/API/x'],
    ['/assets/api/x.js'],
    ['https://other.example.com/api/x'],
    ['data:text/plain,hi'],
  ]
  for (const [input, extra] of allowed) {
    assert.equal(
      boundary.isDemoApiRequest(input, { baseUrl, ...extra }),
      false,
      `${input} must not be classified as an API request`,
    )
  }
  // Malformed inputs fail open to the original fetch (which throws its own TypeError).
  for (const bad of [null, undefined, 42, {}] as unknown as string[]) {
    assert.equal(boundary.isDemoApiRequest(bad, { baseUrl }), false)
  }
})
