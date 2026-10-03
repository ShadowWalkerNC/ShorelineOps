import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  MISSING_APP_BUNDLE_BODY,
  MISSING_ASSET_BODY,
  MISSING_DEMO_BUNDLE_BODY,
  isAssetPath,
  isPassthroughPath,
  resolveStaticRequest,
  shellForPath,
} from './shellRouting'

// Static marketing/demo/app separation regression. No database, network, or
// secret access: synthetic temp bundles stand in for dist/, and vercel.json is
// asserted structurally. Safe to run alongside other workstreams.

const repoRoot = path.resolve(__dirname, '..', '..')
const MARKETING = '<html><body>marketing home</body></html>'
const DEMO = '<html><body>demo shell</body></html>'
const APP = '<html><body>app shell</body></html>'

function makeDist(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-static-'))
  for (const [rel, body] of Object.entries(files)) {
    const file = path.join(root, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, body)
  }
  return root
}

function fullDist(): string {
  return makeDist({
    'index.html': MARKETING,
    'demo/index.html': DEMO,
    'app/index.html': APP,
    'demo/assets/demo-abc123.js': 'console.log("demo")',
    'app/assets/app-def456.js': 'console.log("app")',
    '_astro/entry-789.js': 'console.log("astro")',
  })
}

function readFile(decision: { kind: string; file?: string }): string {
  assert.equal(decision.kind, 'file')
  return fs.readFileSync((decision as { file: string }).file, 'utf8')
}

test('direct open and reload paths resolve to distinct shells', () => {
  const dist = fullDist()
  for (const pathname of ['/demo', '/demo/', '/demo/login', '/demo/menu/week-1']) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(readFile(decision), DEMO, pathname)
  }
  for (const pathname of ['/app', '/app/', '/app/login', '/app/residents/r1']) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(readFile(decision), APP, pathname)
  }
  for (const pathname of ['/', '/pricing', '/story', '/distributors/acme']) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(readFile(decision), MARKETING, pathname)
  }
})

test('present bundle assets resolve to the file itself', () => {
  const dist = fullDist()
  const demoAsset = resolveStaticRequest(dist, '/demo/assets/demo-abc123.js')
  assert.equal(demoAsset.kind, 'file')
  assert.match(readFile(demoAsset), /demo/)
  const appAsset = resolveStaticRequest(dist, '/app/assets/app-def456.js')
  assert.equal(appAsset.kind, 'file')
  assert.match(readFile(appAsset), /app/)
})

test('missing shell bundles never fall back to marketing HTML', () => {
  const dist = makeDist({ 'index.html': MARKETING })
  for (const pathname of ['/demo', '/demo/', '/demo/menu']) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(decision.kind, 'status', pathname)
    assert.equal((decision as { status: number }).status, 503, pathname)
    assert.equal((decision as { body: string }).body, MISSING_DEMO_BUNDLE_BODY, pathname)
  }
  for (const pathname of ['/app', '/app/', '/app/login']) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(decision.kind, 'status', pathname)
    assert.equal((decision as { status: number }).status, 503, pathname)
    assert.equal((decision as { body: string }).body, MISSING_APP_BUNDLE_BODY, pathname)
  }
})

test('missing assets return 404, never marketing HTML as scripts', () => {
  const dist = fullDist()
  for (const pathname of [
    '/demo/assets/missing-chunk.js',
    '/app/assets/missing-chunk.css',
    '/demo/assets/missing.map',
    '/favicon.ico',
    '/_astro/missing-entry.js',
    '/logo.png',
  ]) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(decision.kind, 'status', pathname)
    assert.equal((decision as { status: number }).status, 404, pathname)
    assert.equal((decision as { body: string }).body, MISSING_ASSET_BODY, pathname)
  }
})

test('api, health, and readiness pass through to Express (never shells)', () => {
  const dist = fullDist()
  for (const pathname of ['/api', '/api/', '/api/residents', '/api/docs', '/health', '/ready']) {
    assert.equal(resolveStaticRequest(dist, pathname).kind, 'next', pathname)
  }
})

test('shell, asset, and passthrough classifiers', () => {
  assert.equal(shellForPath('/demo'), 'demo')
  assert.equal(shellForPath('/demo/menu'), 'demo')
  assert.equal(shellForPath('/DEMO/menu'), 'demo')
  assert.equal(shellForPath('/app'), 'app')
  assert.equal(shellForPath('/app/login'), 'app')
  assert.equal(shellForPath('/'), 'marketing')
  assert.equal(shellForPath('/pricing'), 'marketing')
  assert.equal(shellForPath('/demolition'), 'marketing')

  assert.equal(isAssetPath('/demo/assets/x.js'), true)
  assert.equal(isAssetPath('/app/assets/x.css'), true)
  assert.equal(isAssetPath('/_astro/x.js'), true)
  assert.equal(isAssetPath('/favicon.ico'), true)
  assert.equal(isAssetPath('/demo/missing.map'), true)
  assert.equal(isAssetPath('/demo'), false)
  assert.equal(isAssetPath('/demo/'), false)
  assert.equal(isAssetPath('/demo/menu'), false)
  assert.equal(isAssetPath('/app/login'), false)
  assert.equal(isAssetPath('/pricing'), false)
  assert.equal(isAssetPath('/'), false)

  assert.equal(isPassthroughPath('/api'), true)
  assert.equal(isPassthroughPath('/api/residents'), true)
  assert.equal(isPassthroughPath('/health'), true)
  assert.equal(isPassthroughPath('/ready'), true)
  assert.equal(isPassthroughPath('/demo'), false)
  assert.equal(isPassthroughPath('/app/login'), false)
  assert.equal(isPassthroughPath('/'), false)
})

test('path traversal outside dist is a 404, never a file', () => {
  const dist = fullDist()
  for (const pathname of ['/demo/assets/../../secret.txt', '/../secret.txt']) {
    const decision = resolveStaticRequest(dist, pathname)
    assert.equal(decision.kind, 'status', pathname)
    assert.equal((decision as { status: number }).status, 404, pathname)
  }
})

test('vercel.json routes both shells distinctly with honest static /api', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8')) as {
    outputDirectory: string
    rewrites: Array<{ source: string; destination: string }>
  }
  assert.equal(vercel.outputDirectory, 'dist')
  assert.ok(Array.isArray(vercel.rewrites) && vercel.rewrites.length > 0, 'rewrites present')
  const bySource = new Map(vercel.rewrites.map((r) => [r.source, r.destination]))
  assert.equal(bySource.get('/demo'), '/demo/index.html', 'exact /demo')
  assert.equal(bySource.get('/demo/:path*'), '/demo/index.html', 'nested /demo/*')
  assert.equal(bySource.get('/app'), '/app/index.html', 'exact /app')
  assert.equal(bySource.get('/app/:path*'), '/app/index.html', 'nested /app/*')
  for (const rewrite of vercel.rewrites) {
    assert.ok(
      rewrite.destination.startsWith('/demo/') || rewrite.destination.startsWith('/app/'),
      `no marketing fallback rewrite: ${rewrite.source} -> ${rewrite.destination}`
    )
    assert.ok(
      !rewrite.source.startsWith('/api'),
      `no /api rewrite to static HTML: ${rewrite.source}`
    )
  }
})

test('server static handlers resolve through the shared helper', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'server', 'src', 'index.ts'), 'utf8')
  assert.match(source, /from '\.\/shellRouting'/, 'index.ts imports the helper')
  assert.match(
    source,
    /resolveStaticRequest\(clientDistPath, req\.path\)/,
    'handlers resolve through the helper'
  )
  assert.ok(
    !source.includes('fall back to root index'),
    'marketing fallback for missing shells is gone'
  )
})
