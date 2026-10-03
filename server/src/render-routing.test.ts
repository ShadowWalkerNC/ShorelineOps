import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Structural regression for the Render unified static origin (shoreline-demo).
// No database, network, container, or secret access: parses render.yaml and
// asserts the per-shell SPA rewrites plus the /api-suffixed app API base.
// Runs in the isolated suite as server/dist/render-routing.test.js.

const repoRoot = path.resolve(__dirname, '..', '..')
assert.ok(
  fs.existsSync(path.join(repoRoot, 'package.json')) && fs.existsSync(path.join(repoRoot, 'server', 'package.json')),
  `repoRoot resolved to ${repoRoot}, which is not the repository root.`
)
// js-yaml ships with the root dev toolchain (no new installs allowed), so it
// is loaded by absolute path rather than as a server dependency.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require(path.join(repoRoot, 'node_modules', 'js-yaml')) as { load(s: string): any }

const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8')

interface RenderRoute {
  type: string
  source: string
  destination: string
}

interface RenderEnvVar {
  key: string
  value?: unknown
  generateValue?: boolean
  fromDatabase?: unknown
}

interface RenderService {
  name: string
  runtime?: string
  buildCommand?: string
  staticPublishPath?: string
  healthCheckPath?: string
  routes?: RenderRoute[]
  envVars?: RenderEnvVar[]
}

function manifestServices(): RenderService[] {
  const manifest = yaml.load(read('render.yaml')) as { services: RenderService[] }
  assert.ok(Array.isArray(manifest.services), 'render.yaml defines services')
  return manifest.services
}

function findService(name: string): RenderService {
  const svc = manifestServices().find((s) => s.name === name)
  assert.ok(svc, `render.yaml keeps the ${name} service`)
  return svc as RenderService
}

function envValue(svc: RenderService, key: string): unknown {
  return svc.envVars?.find((e) => e.key === key)?.value
}

test('unified static service keeps ordered per-shell SPA fallbacks', () => {
  const demo = findService('shoreline-demo')
  assert.equal(demo.buildCommand, 'npm install && npm run build:demo', 'unified builder still produces dist/')
  assert.equal(demo.staticPublishPath, 'dist')
  // Exact order: demo bare + deep links, then app bare + deep links.
  assert.deepEqual(demo.routes, [
    { type: 'rewrite', source: '/demo', destination: '/demo/index.html' },
    { type: 'rewrite', source: '/demo/*', destination: '/demo/index.html' },
    { type: 'rewrite', source: '/app', destination: '/app/index.html' },
    { type: 'rewrite', source: '/app/*', destination: '/app/index.html' },
  ])
})

test('no blanket root rewrite shadows the app shells', () => {
  const demo = findService('shoreline-demo')
  assert.ok(demo.routes && demo.routes.length > 0, 'routes present')
  for (const route of demo.routes as RenderRoute[]) {
    assert.equal(route.type, 'rewrite', `${route.source}: rewrite, never redirect`)
    // The blanket rule (source /*, destination /index.html) served the
    // marketing homepage for every /demo/* and /app/* refresh.
    assert.notEqual(route.source, '/*', 'no blanket catch-all source')
    assert.notEqual(route.destination, '/index.html', 'no marketing-shell fallback')
    assert.match(route.source, /^\/(demo|app)(\/\*)?$/, `${route.source}: scoped to one shell`)
    assert.match(route.destination, /^\/(demo|app)\/index\.html$/, `${route.destination}: shell-local fallback`)
  }
})

test('app API base carries the /api suffix the clients append to', () => {
  const demo = findService('shoreline-demo')
  const apiUrl = envValue(demo, 'VITE_API_URL')
  assert.equal(typeof apiUrl, 'string', 'VITE_API_URL is a static value')
  // src/api/client.ts sets baseURL to VITE_API_URL and posts /auth/*;
  // src/security/tokenManager.ts and src/api/auth.ts append /auth/* the
  // same way, so an external base without /api misses every endpoint.
  assert.match(apiUrl as string, /^https:\/\/.+\/api$/, 'external API base ends with /api')
})

test('api readiness and security fields are retained', () => {
  const api = findService('shoreline-api')
  assert.equal(api.healthCheckPath, '/ready', 'readiness probe retained')
  const keys = (api.envVars ?? []).map((e) => e.key)
  for (const key of ['JWT_SECRET', 'DATABASE_URL', 'FRONTEND_URL', 'NODE_ENV', 'PORT']) {
    assert.ok(keys.includes(key), `shoreline-api keeps ${key}`)
  }
})

test('deployment docs describe the scoped rewrites and the /api base', () => {
  const docs = read('docs/RenderDeployment.md')
  for (const marker of ['/demo', '/demo/*', '/demo/index.html', '/app', '/app/*', '/app/index.html']) {
    assert.ok(docs.includes(marker), `docs mention ${marker}`)
  }
  assert.ok(
    docs.includes('https://shoreline-api.onrender.com/api'),
    'docs show the /api-suffixed API base'
  )
})
