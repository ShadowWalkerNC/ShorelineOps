import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { IdempotencyStore, idempotencyMiddleware } from './middleware/idempotency'
import type { ApiRole } from './middleware/requireAuth'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), 'shoreline-idempotency-auth-')), 'test.sqlite')
let requireAuth: typeof import('./middleware/requireAuth')['requireAuth']
let requireCapability: typeof import('./middleware/permissions')['requireCapability']
let pool: typeof import('./db/pool')['pool']
let issueTestAccessToken: typeof import('./test-support/accessToken')['issueTestAccessToken']

before(async () => {
  ;({ pool } = await import('./db/pool'))
  ;({ requireAuth } = await import('./middleware/requireAuth'))
  ;({ requireCapability } = await import('./middleware/permissions'))
  ;({ issueTestAccessToken } = await import('./test-support/accessToken'))
  const { runMigrations } = await import('./db/migrate')
  await runMigrations()
})
after(async () => { await pool.end() })

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'synthetic-idempotency-test-jwt-secret-32-chars!'
}

async function tokenFor(sub: string, role: ApiRole, facilityId = 'FAC-TEST'): Promise<string> {
  // Scope changes in this fixture are authoritative account changes, not forged
  // JWT claims. Fresh sessions follow the updated role/facility and version.
  await pool.query(
    'UPDATE users SET role = $2, facility_id = $3, auth_version = auth_version + 1 WHERE id = $1 AND (role <> $2 OR facility_id <> $3)',
    [sub, role, facilityId],
  )
  return issueTestAccessToken({ sub, role, facilityId })
}

interface Counters {
  obj: number
  arr: number
  str: number
  raw: number
  item: number
  fail: number
  slow: number
  get: number
  login: number
  open: number
}

function buildApp(store: IdempotencyStore): { app: express.Express; counters: Counters; gate: { release: () => void } } {
  const app = express()
  app.use(express.json())
  const counters: Counters = { obj: 0, arr: 0, str: 0, raw: 0, item: 0, fail: 0, slow: 0, get: 0, login: 0, open: 0 }
  let releaseSlow: () => void = () => {}
  const slowGate = new Promise<void>((resolve) => { releaseSlow = resolve })

  // Eligible operational routes: real auth + real capability gate, with
  // idempotency mounted AFTER both (the remediation contract).
  const kitchen = express.Router()
  kitchen.post('/__idem/obj',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (req, res) => {
      counters.obj++
      res.status(201).json({ orderId: `PO-${counters.obj}`, total: (req.body as any)?.total ?? null, nested: { tags: ['a', 'b'], n: 3 } })
    })
  kitchen.post('/__idem/arr',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (_req, res) => {
      counters.arr++
      res.json([1, 'two', { three: 3 }])
    })
  kitchen.post('/__idem/str',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (_req, res) => {
      counters.str++
      res.json('hello-string')
    })
  kitchen.post('/__idem/raw',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (_req, res) => {
      counters.raw++
      res.send('plain-text-body')
    })
  kitchen.delete('/__idem/item',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (_req, res) => {
      counters.item++
      res.status(204).send()
    })
  kitchen.post('/__idem/fail',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (_req, res) => {
      counters.fail++
      res.status(400).json({ error: 'synthetic validation failure' })
    })
  kitchen.post('/__idem/slow',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    async (_req, res) => {
      counters.slow++
      await slowGate
      res.json({ slow: counters.slow })
    })
  // GET is never idempotent-eligible even with a key header.
  kitchen.get('/__idem/obj-get',
    requireAuth, requireCapability('kitchen.write'), idempotencyMiddleware(store),
    (_req, res) => {
      counters.get++
      res.json({ n: counters.get })
    })
  // Eligible path but no authenticated principal: the middleware must skip
  // caching entirely (no replay) and let the handler run.
  kitchen.post('/__idem/open',
    idempotencyMiddleware(store),
    (_req, res) => {
      counters.open++
      res.json({ n: counters.open })
    })
  app.use('/api/kitchen', kitchen)

  // Credential flows are never eligible, even with the middleware mounted.
  const auth = express.Router()
  auth.post('/__idem/login',
    idempotencyMiddleware(store),
    (_req, res) => {
      counters.login++
      res.json({ ok: true, n: counters.login })
    })
  app.use('/api/auth', auth)

  return { app, counters, gate: { release: () => releaseSlow() } }
}

async function withServer(fn: (base: string, counters: Counters, gate: { release: () => void }) => Promise<void>): Promise<void> {
  const store = new IdempotencyStore(60000)
  const { app, counters, gate } = buildApp(store)
  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  try {
    await fn(`http://127.0.0.1:${port}`, counters, gate)
  } finally {
    server.close()
  }
}

interface CallOpts {
  key?: string
  body?: unknown
  token?: string
  method?: string
  query?: string
}

async function call(base: string, path: string, opts: CallOpts = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (opts.method !== 'GET' && opts.method !== 'DELETE') headers['content-type'] = 'application/json'
  if (opts.key) headers['idempotency-key'] = opts.key
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`
  return fetch(base + path + (opts.query ?? ''), {
    method: opts.method ?? 'POST',
    headers,
    body: opts.method === 'GET' || opts.method === 'DELETE' ? undefined : JSON.stringify(opts.body ?? {}),
  })
}

test('IdempotencyStore stores, expires, and tracks in-progress entries', () => {
  const store = new IdempotencyStore(50)
  assert.equal(store.get('missing'), null)
  store.set('k1', { statusCode: 200, headers: { 'content-type': 'application/json' }, body: { ok: true } })
  const cached = store.get('k1')
  assert.ok(cached)
  assert.equal(cached.statusCode, 200)
  assert.equal(cached.kind, 'json')
  assert.deepEqual(cached.body, { ok: true })
  assert.equal(store.isProcessing('req-2'), false)
  store.start('req-2')
  assert.equal(store.isProcessing('req-2'), true)
  store.finish('req-2')
  assert.equal(store.isProcessing('req-2'), false)
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      assert.equal(store.get('k1'), null)
      resolve()
    }, 80)
  })
})

test('object replay deep-equals the original over real HTTP (no double serialization)', async () => {
  await withServer(async (base, counters) => {
    const token = await tokenFor('user-1', 'manager')
    const body = { total: 450.5 }
    const res1 = await call(base, '/api/kitchen/__idem/obj', { key: 'obj-key-1', body, token })
    assert.equal(res1.status, 201)
    const data1 = await res1.json()
    assert.deepEqual(data1, { orderId: 'PO-1', total: 450.5, nested: { tags: ['a', 'b'], n: 3 } })
    assert.equal(counters.obj, 1)

    const res2 = await call(base, '/api/kitchen/__idem/obj', { key: 'obj-key-1', body, token })
    assert.equal(res2.status, 201)
    assert.equal(res2.headers.get('x-idempotency-replay'), 'true')
    assert.deepEqual(await res2.json(), data1)
    assert.equal(counters.obj, 1)
  })
})

test('array and JSON-string replays preserve their types without double serialization', async () => {
  await withServer(async (base, counters) => {
    const token = await tokenFor('user-1', 'manager')

    const arr1 = await call(base, '/api/kitchen/__idem/arr', { key: 'arr-key-1', body: {}, token })
    assert.equal(arr1.status, 200)
    assert.deepEqual(await arr1.json(), [1, 'two', { three: 3 }])
    const arr2 = await call(base, '/api/kitchen/__idem/arr', { key: 'arr-key-1', body: {}, token })
    assert.equal(arr2.headers.get('x-idempotency-replay'), 'true')
    assert.deepEqual(await arr2.json(), [1, 'two', { three: 3 }])
    assert.equal(counters.arr, 1)

    // A res.json string must replay as the same JSON string: the raw wire
    // bytes are identical, not a stringified-string.
    const str1 = await call(base, '/api/kitchen/__idem/str', { key: 'str-key-1', body: {}, token })
    assert.equal(str1.status, 200)
    assert.equal(await str1.text(), '"hello-string"')
    const str2 = await call(base, '/api/kitchen/__idem/str', { key: 'str-key-1', body: {}, token })
    assert.equal(str2.headers.get('x-idempotency-replay'), 'true')
    const str2Text = await str2.text()
    assert.equal(str2Text, '"hello-string"')
    assert.deepEqual(JSON.parse(str2Text), 'hello-string')
    assert.equal(counters.str, 1)
  })
})

test('res.send replay preserves raw text (not JSON) and 204 replays empty', async () => {
  await withServer(async (base, counters) => {
    const token = await tokenFor('user-1', 'manager')

    const raw1 = await call(base, '/api/kitchen/__idem/raw', { key: 'raw-key-1', body: {}, token })
    assert.equal(raw1.status, 200)
    assert.match(raw1.headers.get('content-type') ?? '', /text\/html/)
    assert.equal(await raw1.text(), 'plain-text-body')
    const raw2 = await call(base, '/api/kitchen/__idem/raw', { key: 'raw-key-1', body: {}, token })
    assert.equal(raw2.headers.get('x-idempotency-replay'), 'true')
    assert.match(raw2.headers.get('content-type') ?? '', /text\/html/)
    assert.equal(await raw2.text(), 'plain-text-body')
    assert.equal(counters.raw, 1)

    const del1 = await call(base, '/api/kitchen/__idem/item', { key: 'del-key-1', token, method: 'DELETE' })
    assert.equal(del1.status, 204)
    assert.equal(await del1.text(), '')
    const del2 = await call(base, '/api/kitchen/__idem/item', { key: 'del-key-1', token, method: 'DELETE' })
    assert.equal(del2.status, 204)
    assert.equal(del2.headers.get('x-idempotency-replay'), 'true')
    assert.equal(await del2.text(), '')
    assert.equal(counters.item, 1)
  })
})

test('cache scope binds user, facility, role, query, and body', async () => {
  await withServer(async (base, counters) => {
    const body = { total: 10 }
    const first = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body, token: await tokenFor('user-1', 'manager', 'FAC-A') })
    assert.equal(first.status, 201)
    assert.equal(counters.obj, 1)

    // Same principal replay.
    const replay = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body, token: await tokenFor('user-1', 'manager', 'FAC-A') })
    assert.equal(replay.headers.get('x-idempotency-replay'), 'true')
    assert.equal(counters.obj, 1)

    // Different user executes fresh (no replay leak across principals).
    const otherUser = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body, token: await tokenFor('user-2', 'manager', 'FAC-A') })
    assert.equal(otherUser.status, 201)
    assert.equal(otherUser.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.obj, 2)

    // Different facility executes fresh.
    const otherFacility = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body, token: await tokenFor('user-1', 'manager', 'FAC-B') })
    assert.equal(otherFacility.status, 201)
    assert.equal(otherFacility.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.obj, 3)

    // Different role executes fresh (dietitian also holds kitchen.write).
    const otherRole = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body, token: await tokenFor('user-1', 'dietitian', 'FAC-A') })
    assert.equal(otherRole.status, 201)
    assert.equal(otherRole.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.obj, 4)

    // Different query executes fresh.
    const otherQuery = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body, token: await tokenFor('user-1', 'manager', 'FAC-A'), query: '?week=2026-09-21' })
    assert.equal(otherQuery.status, 201)
    assert.equal(otherQuery.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.obj, 5)

    // Same key with a changed body is rejected, never replayed.
    const reused = await call(base, '/api/kitchen/__idem/obj', { key: 'scope-key', body: { total: 999 }, token: await tokenFor('user-1', 'manager', 'FAC-A') })
    assert.equal(reused.status, 422)
    assert.equal((await reused.json() as any).code, 'IDEMPOTENCY_KEY_REUSED')
    assert.equal(counters.obj, 5)
  })
})

test('concurrent duplicates conflict and the winner replays afterwards', async () => {
  await withServer(async (base, counters, gate) => {
    const token = await tokenFor('user-1', 'manager')
    const body = { total: 1 }
    const pending = call(base, '/api/kitchen/__idem/slow', { key: 'slow-key', body, token })
    // Wait until the first request is inside the handler (in-progress).
    for (let i = 0; i < 200 && counters.slow === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    assert.equal(counters.slow, 1)

    const conflict = await call(base, '/api/kitchen/__idem/slow', { key: 'slow-key', body, token })
    assert.equal(conflict.status, 409)
    assert.equal((await conflict.json() as any).code, 'IDEMPOTENCY_CONFLICT')

    // Same key with a different body while in-flight is a reuse error, not a replay.
    const inflightReuse = await call(base, '/api/kitchen/__idem/slow', { key: 'slow-key', body: { total: 2 }, token })
    assert.equal(inflightReuse.status, 422)

    gate.release()
    const first = await pending
    assert.equal(first.status, 200)
    const firstBody = await first.json()

    const replay = await call(base, '/api/kitchen/__idem/slow', { key: 'slow-key', body, token })
    assert.equal(replay.headers.get('x-idempotency-replay'), 'true')
    assert.deepEqual(await replay.json(), firstBody)
    assert.equal(counters.slow, 1)
  })
})

test('failures are never cached and denied roles cannot populate or observe the cache', async () => {
  await withServer(async (base, counters) => {
    const token = await tokenFor('user-1', 'manager')
    const body = { total: 1 }

    // 400 responses never populate: the retry executes again.
    const fail1 = await call(base, '/api/kitchen/__idem/fail', { key: 'fail-key', body, token })
    assert.equal(fail1.status, 400)
    const fail2 = await call(base, '/api/kitchen/__idem/fail', { key: 'fail-key', body, token })
    assert.equal(fail2.status, 400)
    assert.equal(fail2.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.fail, 2)

    // A denied role (readonly lacks kitchen.write) is rejected by the
    // capability gate before idempotency: no cache entry is created, so an
    // authorized retry with the same key executes fresh.
    const denied = await call(base, '/api/kitchen/__idem/obj', { key: 'denied-key', body, token: await tokenFor('user-9', 'readonly') })
    assert.equal(denied.status, 403)
    assert.equal(counters.obj, 0)
    const authorized = await call(base, '/api/kitchen/__idem/obj', { key: 'denied-key', body, token })
    assert.equal(authorized.status, 201)
    assert.equal(authorized.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.obj, 1)

    // Unauthenticated requests are rejected by requireAuth before idempotency.
    const anonymous = await call(base, '/api/kitchen/__idem/obj', { key: 'anon-key', body })
    assert.equal(anonymous.status, 401)
    assert.equal(counters.obj, 1)
  })
})

test('excluded paths and methods never replay: auth flows, GET, and missing principals', async () => {
  await withServer(async (base, counters) => {
    const token = await tokenFor('user-1', 'manager')

    // Credential flow with the middleware mounted: executes every time.
    const login1 = await call(base, '/api/auth/__idem/login', { key: 'login-key', body: {}, token })
    const login2 = await call(base, '/api/auth/__idem/login', { key: 'login-key', body: {}, token })
    assert.equal(login1.status, 200)
    assert.equal(login2.status, 200)
    assert.equal(login2.headers.get('x-idempotency-replay'), null)
    assert.deepEqual(await login2.json(), { ok: true, n: 2 })
    assert.equal(counters.login, 2)

    // GET with a key header: never cached.
    const get1 = await call(base, '/api/kitchen/__idem/obj-get', { key: 'get-key', token, method: 'GET' })
    const get2 = await call(base, '/api/kitchen/__idem/obj-get', { key: 'get-key', token, method: 'GET' })
    assert.deepEqual(await get1.json(), { n: 1 })
    assert.deepEqual(await get2.json(), { n: 2 })
    assert.equal(get2.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.get, 2)

    // Eligible path without an authenticated principal: no replay, handler runs.
    const open1 = await call(base, '/api/kitchen/__idem/open', { key: 'open-key', body: {} })
    const open2 = await call(base, '/api/kitchen/__idem/open', { key: 'open-key', body: {} })
    assert.deepEqual(await open1.json(), { n: 1 })
    assert.deepEqual(await open2.json(), { n: 2 })
    assert.equal(open2.headers.get('x-idempotency-replay'), null)
    assert.equal(counters.open, 2)

    // Requests without any key header execute normally.
    const nokey = await call(base, '/api/kitchen/__idem/obj', { body: { total: 5 }, token })
    assert.equal(nokey.status, 201)
    assert.equal(nokey.headers.get('x-idempotency-replay'), null)
  })
})
