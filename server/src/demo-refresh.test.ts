import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEMO_API_UNAVAILABLE_CODE,
  createDemoUnavailableError,
  isDemoBuild,
  isDemoUnavailableError,
} from './apiClientPolicy'

// tokenManager.refresh demo isolation. Executes the REAL frontend source
// (src/security/tokenManager.ts) via a minimal transpile with injected
// storage/axios/env — no text-match assertions. Demo refresh must reject with
// the shared unavailable contract before any credential read, session write,
// or network call; live refresh behavior is unchanged.

const repoRoot = path.resolve(__dirname, '..', '..')

interface TokenManagerShape {
  getAccessToken: () => string | null
  set: (accessToken: string, refreshToken: string) => void
  refresh: () => Promise<void>
  clear: () => void
  hasRefreshToken: () => boolean
}

interface CountingStorage {
  getCalls: number
  setCalls: number
  removeCalls: number
  store: Map<string, string>
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function makeStorage(seed?: Record<string, string>): CountingStorage {
  const store = new Map<string, string>(Object.entries(seed ?? {}))
  const storage = {} as CountingStorage
  storage.getCalls = 0
  storage.setCalls = 0
  storage.removeCalls = 0
  storage.store = store
  storage.getItem = (key: string) => {
    storage.getCalls++
    return store.has(key) ? (store.get(key) as string) : null
  }
  storage.setItem = (key: string, value: string) => {
    storage.setCalls++
    store.set(key, value)
  }
  storage.removeItem = (key: string) => {
    storage.removeCalls++
    store.delete(key)
  }
  return storage
}

interface AxiosMock {
  postCalls: number
  lastUrl: unknown
  lastBody: unknown
  post: (url: string, body: unknown) => Promise<{ data: { accessToken: string; refreshToken: string } }>
}

function makeAxios(
  handler?: (url: string, body: unknown) => Promise<{ data: { accessToken: string; refreshToken: string } }>
): AxiosMock {
  const mock = {} as AxiosMock
  mock.postCalls = 0
  mock.lastUrl = undefined
  mock.lastBody = undefined
  mock.post = async (url: string, body: unknown) => {
    mock.postCalls++
    mock.lastUrl = url
    mock.lastBody = body
    if (handler) return handler(url, body)
    throw new Error('axios.post must not be called in this case')
  }
  return mock
}

function loadRealTokenManager(
  env: Record<string, unknown>,
  storage: CountingStorage,
  axiosMock: AxiosMock
): { tokenManager: TokenManagerShape; apiBase: string } {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'security', 'tokenManager.ts'), 'utf8')
  let body = source
    .replace(/^import\s+axios\s+from\s+['"]axios['"]\s*;?\r?$/m, '')
    .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*apiClientPolicy['"]\s*;?/s, '')
    .split('import.meta.env')
    .join('__ENV__')
    .replace('let _accessToken: string | null = null', 'let _accessToken = null')
    .replace('(accessToken: string, refreshToken: string)', '(accessToken, refreshToken)')
    .replace('async (): Promise<void> =>', 'async () =>')
    .replace('export const tokenManager =', 'const tokenManager =')
  if (/^\s*import\s/m.test(body)) throw new Error('demo-refresh harness: unhandled import in tokenManager source')
  if (/\bexport\s/.test(body)) throw new Error('demo-refresh harness: unhandled export in tokenManager source')
  const factory = new Function(
    '__ENV__',
    'sessionStorage',
    'axios',
    'isDemoBuild',
    'createDemoUnavailableError',
    `${body}\nreturn { tokenManager, apiBase: API_BASE };`
  ) as (
    envArg: unknown,
    storageArg: unknown,
    axiosArg: unknown,
    isDemoArg: unknown,
    demoErrArg: unknown
  ) => { tokenManager: TokenManagerShape; apiBase: string }
  return factory(env, storage, axiosMock, isDemoBuild, createDemoUnavailableError)
}

test('demo refresh rejects before storage, network, or session mutation', async () => {
  const storage = makeStorage({ _rt: 'probe-must-never-be-read' })
  const axiosMock = makeAxios(async () => ({ data: { accessToken: 'x', refreshToken: 'y' } }))
  const { tokenManager } = loadRealTokenManager({ VITE_DEMO_MODE: 'true', VITE_API_URL: '/api' }, storage, axiosMock)
  await assert.rejects(tokenManager.refresh(), (rejected: unknown) => {
    assert.equal(isDemoUnavailableError(rejected), true)
    assert.equal((rejected as { code?: unknown }).code, DEMO_API_UNAVAILABLE_CODE)
    assert.match((rejected as Error).message, /public demo/)
    return true
  })
  assert.equal(storage.getCalls, 0)
  assert.equal(storage.setCalls, 0)
  assert.equal(storage.removeCalls, 0)
  assert.equal(axiosMock.postCalls, 0)
  assert.equal(tokenManager.getAccessToken(), null)
})

test('live refresh exchanges the stored token (unchanged)', async () => {
  const storage = makeStorage({ _rt: 'live-refresh-token' })
  const axiosMock = makeAxios(async () => ({ data: { accessToken: 'new-access', refreshToken: 'new-refresh' } }))
  const { tokenManager, apiBase } = loadRealTokenManager({ VITE_API_URL: '/api' }, storage, axiosMock)
  assert.equal(apiBase, '/api')
  await tokenManager.refresh()
  assert.equal(axiosMock.postCalls, 1)
  assert.equal(axiosMock.lastUrl, '/api/auth/refresh')
  assert.deepEqual(axiosMock.lastBody, { refreshToken: 'live-refresh-token' })
  assert.equal(tokenManager.getAccessToken(), 'new-access')
  assert.equal(storage.store.get('_rt'), 'new-refresh')
  assert.equal(storage.getCalls, 1)
  assert.equal(storage.setCalls, 1)
})

test('live refresh without a stored token rejects without network (unchanged)', async () => {
  const storage = makeStorage()
  const axiosMock = makeAxios()
  const { tokenManager } = loadRealTokenManager({ VITE_DEMO_MODE: 'false' }, storage, axiosMock)
  await assert.rejects(tokenManager.refresh(), /No refresh token/)
  assert.equal(axiosMock.postCalls, 0)
  assert.equal(tokenManager.getAccessToken(), null)
})
