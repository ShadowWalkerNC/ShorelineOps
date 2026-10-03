import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  DEMO_API_UNAVAILABLE_CODE,
  DEMO_API_UNAVAILABLE_STATUS,
  applyRequestPolicy,
  createDemoUnavailableError,
  handleResponseError,
  isDemoBuild,
  isDemoUnavailableError,
} from './apiClientPolicy'

// Demo/live API-client isolation regression. No database, network, browser, or
// secret access: the real policy functions are replayed with counting probes
// that are reset per case. Guards the public-demo redirect loop (shared 401
// interceptor refreshing a real token and navigating /demo/login, followed by
// LoginPage auto-navigation to the dashboard).

const repoRoot = path.resolve(__dirname, '..', '..')

function countingProbes() {
  const calls = {
    getAccessToken: 0,
    getLicenseKey: 0,
    refresh: 0,
    clear: 0,
    redirect: 0,
    retry: 0,
  }
  return {
    calls,
    creds: {
      getAccessToken: () => {
        calls.getAccessToken++
        return 'live-access-token'
      },
      getLicenseKey: () => {
        calls.getLicenseKey++
        return 'SH_ENT_probe'
      },
    },
    unauthorized: (opts?: { refreshFails?: boolean; retryFails?: unknown }) => ({
      refreshAccessToken: async () => {
        calls.refresh++
        if (opts?.refreshFails) throw new Error('refresh failed')
      },
      getAccessToken: () => {
        calls.getAccessToken++
        return 'refreshed-token'
      },
      clearSession: () => {
        calls.clear++
      },
      redirectToLogin: () => {
        calls.redirect++
      },
      retryRequest: async (config: Record<string, unknown>) => {
        calls.retry++
        if (opts && 'retryFails' in opts) throw opts.retryFails
        return { retried: true, config }
      },
    }),
  }
}

function unauthorizedError(config: unknown) {
  return { response: { status: 401, data: { error: 'Unauthorized' } }, config }
}

// --- Build flag ---

test('demo build matches only explicit VITE_DEMO_MODE=true', () => {
  assert.equal(isDemoBuild({ VITE_DEMO_MODE: 'true' }), true)
  for (const env of [
    undefined,
    null,
    {},
    { VITE_DEMO_MODE: 'false' },
    { VITE_DEMO_MODE: '' },
    { VITE_DEMO_MODE: true },
    { VITE_DEMO_MODE: '1' },
  ]) {
    assert.equal(isDemoBuild(env), false, JSON.stringify(env))
  }
})

// --- Request policy ---

test('demo requests never read or attach live JWT or license', () => {
  const { calls, creds } = countingProbes()
  const config: { headers: Record<string, unknown> } = { headers: {} }
  const out = applyRequestPolicy(config, true, creds)
  assert.equal(out, config)
  assert.deepEqual(config.headers, {})
  assert.deepEqual(calls, {
    getAccessToken: 0,
    getLicenseKey: 0,
    refresh: 0,
    clear: 0,
    redirect: 0,
    retry: 0,
  })
})

test('live requests attach JWT and license (unchanged)', () => {
  const { calls, creds } = countingProbes()
  const config: { headers: Record<string, unknown> } = { headers: {} }
  applyRequestPolicy(config, false, creds)
  assert.equal(config.headers.Authorization, 'Bearer live-access-token')
  assert.equal(config.headers['X-Shoreline-License-Key'], 'SH_ENT_probe')
  assert.equal(calls.getAccessToken, 1)
  assert.equal(calls.getLicenseKey, 1)
})

test('live requests tolerate a missing headers object', () => {
  const { creds } = countingProbes()
  const config = {} as { headers?: Record<string, unknown> }
  applyRequestPolicy(config, false, creds)
  assert.equal(config.headers?.Authorization, 'Bearer live-access-token')
})

// --- Response policy: demo ---

test('demo 401 rejects untouched: no refresh, retry, clear, or redirect', async () => {
  const { calls, unauthorized } = countingProbes()
  const original = { headers: {} as Record<string, unknown>, url: '/residents' }
  const error = unauthorizedError(original)
  await assert.rejects(handleResponseError(error, true, unauthorized()), (rejected: unknown) => {
    assert.equal(rejected, error)
    return true
  })
  assert.equal(original.headers.Authorization, undefined)
  assert.deepEqual(calls, {
    getAccessToken: 0,
    getLicenseKey: 0,
    refresh: 0,
    clear: 0,
    redirect: 0,
    retry: 0,
  })
})

test('demo non-401 rejects untouched', async () => {
  const { calls, unauthorized } = countingProbes()
  const error = { response: { status: 500 }, config: { headers: {} } }
  await assert.rejects(handleResponseError(error, true, unauthorized()))
  assert.deepEqual(calls, {
    getAccessToken: 0,
    getLicenseKey: 0,
    refresh: 0,
    clear: 0,
    redirect: 0,
    retry: 0,
  })
})

// --- Response policy: live (unchanged) ---

test('live first 401 refreshes once, re-attaches the token, and retries', async () => {
  const { calls, unauthorized } = countingProbes()
  const original: Record<string, unknown> = { headers: {}, url: '/menu/weeks' }
  const result = (await handleResponseError(unauthorizedError(original), false, unauthorized())) as {
    retried: boolean
    config: Record<string, unknown>
  }
  assert.equal(result.retried, true)
  assert.equal(result.config, original)
  const retriedHeaders = original.headers as Record<string, unknown>
  assert.equal(retriedHeaders.Authorization, 'Bearer refreshed-token')
  assert.equal(original._retry, true)
  assert.equal(calls.refresh, 1)
  assert.equal(calls.retry, 1)
  assert.equal(calls.clear, 0)
  assert.equal(calls.redirect, 0)
})

test('live 401 replay on an already-retried request rejects without a second refresh', async () => {
  const { calls, unauthorized } = countingProbes()
  const original = { headers: {} as Record<string, unknown>, _retry: true }
  const error = unauthorizedError(original)
  await assert.rejects(handleResponseError(error, false, unauthorized()), (rejected: unknown) => {
    assert.equal(rejected, error)
    return true
  })
  assert.deepEqual(calls, {
    getAccessToken: 0,
    getLicenseKey: 0,
    refresh: 0,
    clear: 0,
    redirect: 0,
    retry: 0,
  })
})

test('live refresh failure clears the session, redirects, and rejects the original error', async () => {
  const { calls, unauthorized } = countingProbes()
  const original = { headers: {} as Record<string, unknown> }
  const error = unauthorizedError(original)
  await assert.rejects(
    handleResponseError(error, false, unauthorized({ refreshFails: true })),
    (rejected: unknown) => {
      assert.equal(rejected, error)
      return true
    }
  )
  assert.equal(calls.refresh, 1)
  assert.equal(calls.retry, 0)
  assert.equal(calls.clear, 1)
  assert.equal(calls.redirect, 1)
})

test('live retry 500 after successful refresh rejects the retry error without clearing', async () => {
  const { calls, unauthorized } = countingProbes()
  const original: Record<string, unknown> = { headers: {} as Record<string, unknown> }
  const error = unauthorizedError(original)
  const retryError = {
    isAxiosError: true,
    message: 'Request failed with status code 500',
    config: original,
    response: { status: 500, data: { error: 'Internal error' } },
  }
  await assert.rejects(
    handleResponseError(error, false, unauthorized({ retryFails: retryError })),
    (rejected: unknown) => {
      assert.equal(rejected, retryError)
      return true
    }
  )
  assert.equal(calls.refresh, 1)
  assert.equal(calls.retry, 1)
  assert.equal(calls.clear, 0)
  assert.equal(calls.redirect, 0)
  assert.equal(original._retry, true)
  assert.equal((original.headers as Record<string, unknown>).Authorization, 'Bearer refreshed-token')
})

test('live retry 403 after successful refresh rejects the retry error without clearing', async () => {
  const { calls, unauthorized } = countingProbes()
  const original: Record<string, unknown> = { headers: {} as Record<string, unknown> }
  const error = unauthorizedError(original)
  const retryError = {
    isAxiosError: true,
    message: 'Request failed with status code 403',
    config: original,
    response: { status: 403, data: { error: 'Forbidden' } },
  }
  await assert.rejects(
    handleResponseError(error, false, unauthorized({ retryFails: retryError })),
    (rejected: unknown) => {
      assert.equal(rejected, retryError)
      return true
    }
  )
  assert.equal(calls.refresh, 1)
  assert.equal(calls.retry, 1)
  assert.equal(calls.clear, 0)
  assert.equal(calls.redirect, 0)
  assert.equal((original.headers as Record<string, unknown>).Authorization, 'Bearer refreshed-token')
})

test('live retry network failure after successful refresh rejects the retry error without clearing', async () => {
  const { calls, unauthorized } = countingProbes()
  const original: Record<string, unknown> = { headers: {} as Record<string, unknown> }
  const error = unauthorizedError(original)
  const retryError = Object.assign(new Error('Network Error'), {
    code: 'ERR_NETWORK',
    isAxiosError: true,
    config: original,
  })
  await assert.rejects(
    handleResponseError(error, false, unauthorized({ retryFails: retryError })),
    (rejected: unknown) => {
      assert.equal(rejected, retryError)
      return true
    }
  )
  assert.equal(calls.refresh, 1)
  assert.equal(calls.retry, 1)
  assert.equal(calls.clear, 0)
  assert.equal(calls.redirect, 0)
  assert.equal((original.headers as Record<string, unknown>).Authorization, 'Bearer refreshed-token')
})

test('live non-401 rejects untouched', async () => {
  const { calls, unauthorized } = countingProbes()
  const error = { response: { status: 403 }, config: { headers: {} } }
  await assert.rejects(handleResponseError(error, false, unauthorized()))
  assert.deepEqual(calls, {
    getAccessToken: 0,
    getLicenseKey: 0,
    refresh: 0,
    clear: 0,
    redirect: 0,
    retry: 0,
  })
})

test('malformed originals reject safely with no side effects', async () => {
  for (const error of [
    null,
    undefined,
    'boom',
    {},
    { response: { status: 401 }, config: undefined },
    { response: { status: 401 }, config: null },
    { response: { status: 401 }, config: 'not-an-object' },
    { response: undefined, config: { headers: {} } },
  ]) {
    for (const isDemo of [true, false]) {
      const { calls, unauthorized } = countingProbes()
      await assert.rejects(handleResponseError(error, isDemo, unauthorized()))
      assert.deepEqual(calls, {
        getAccessToken: 0,
        getLicenseKey: 0,
        refresh: 0,
        clear: 0,
        redirect: 0,
        retry: 0,
      })
    }
  }
})

// --- Demo unavailable error ---

test('demo unavailable error is honest, structured, and detectable', () => {
  const error = createDemoUnavailableError({ method: 'get', url: '/menu/weeks' })
  assert.equal(error.code, DEMO_API_UNAVAILABLE_CODE)
  assert.equal(error.response.status, DEMO_API_UNAVAILABLE_STATUS)
  assert.match(error.message, /public demo/)
  assert.match(error.message, /GET/)
  assert.match(error.message, /\/menu\/weeks/)
  assert.equal(error.response.data.error, error.message)
  assert.equal(isDemoUnavailableError(error), true)
  assert.equal(isDemoUnavailableError(new Error('other')), false)
  assert.equal(isDemoUnavailableError(null), false)
  const fallback = createDemoUnavailableError(null)
  assert.match(fallback.message, /unknown endpoint/)
})

// --- Wiring: the shipped client must use this policy ---

test('src/api/client.ts wires the policy with a demo-only rejecting adapter', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'src', 'api', 'client.ts'), 'utf8')
  assert.match(source, /from '\.\.\/\.\.\/server\/src\/apiClientPolicy'/, 'imports the shared policy')
  assert.match(source, /isDemoBuild\(import\.meta\.env\)/, 'demo flag from build env')
  assert.match(source, /api\.defaults\.adapter\s*=/, 'installs a demo adapter')
  assert.match(source, /createDemoUnavailableError/, 'adapter rejects with the unavailable error')
  assert.match(source, /applyRequestPolicy\(config, isDemo,/, 'request path goes through the policy')
  assert.match(
    source,
    /handleResponseError\(error, isDemo,/,
    'response path goes through the policy'
  )
})
