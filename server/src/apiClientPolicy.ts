/**
 * ShorelineOps — API client auth policy (isomorphic, dependency-free).
 *
 * Single source of truth for demo-vs-live Axios behavior. Imported by the
 * browser client (`src/api/client.ts`) and by the maintained node:test suite,
 * so both runtimes execute the exact same logic. Keep this module free of
 * imports (no axios, no DOM, no node APIs).
 *
 * Demo contract (VITE_DEMO_MODE=true):
 * - never read or attach the live JWT access token or license key,
 * - never issue network requests (the client installs a rejecting adapter),
 * - never attempt token refresh, session clear, or location redirects on 401.
 *
 * Live behavior is unchanged: attach credentials, refresh once on the first
 * 401 and retry, otherwise clear the session and redirect to login.
 */

/** Build-time demo flag. Pass `import.meta.env` (browser) or a probe object. */
export function isDemoBuild(env: unknown): boolean {
  if (!env || typeof env !== 'object') return false
  return (env as { VITE_DEMO_MODE?: unknown }).VITE_DEMO_MODE === 'true'
}

export const DEMO_API_UNAVAILABLE_CODE = 'DEMO_API_UNAVAILABLE'
export const DEMO_API_UNAVAILABLE_STATUS = 503

export interface DemoRequestProbe {
  method?: unknown
  url?: unknown
}

export interface DemoUnavailableError extends Error {
  code: typeof DEMO_API_UNAVAILABLE_CODE
  isAxiosError: true
  config: unknown
  response: {
    status: typeof DEMO_API_UNAVAILABLE_STATUS
    data: { error: string }
    headers: Record<string, string>
    config: unknown
  }
}

/**
 * Honest rejection for demo builds: an Axios-compatible 503 error that is
 * thrown before any network access. Callers keep their existing local-adapter
 * fallbacks; features without one surface this message instead of a fake
 * success or a redirect loop.
 */
export function createDemoUnavailableError(
  probe: DemoRequestProbe | null | undefined
): DemoUnavailableError {
  const method =
    probe && typeof probe.method === 'string' && probe.method
      ? probe.method.toUpperCase()
      : 'REQUEST'
  const url =
    probe && typeof probe.url === 'string' && probe.url ? probe.url : 'unknown endpoint'
  const message = `Not available in the public demo (no network API access): ${method} ${url}.`
  const error = new Error(message) as DemoUnavailableError
  error.code = DEMO_API_UNAVAILABLE_CODE
  error.isAxiosError = true
  error.config = probe ?? null
  error.response = {
    status: DEMO_API_UNAVAILABLE_STATUS,
    data: { error: message },
    headers: {},
    config: probe ?? null,
  }
  return error
}

export function isDemoUnavailableError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { code?: unknown }).code === DEMO_API_UNAVAILABLE_CODE
  )
}

export interface RequestCredentialProbes {
  getAccessToken: () => string | null | undefined
  getLicenseKey: () => string | null | undefined
}

/**
 * Request interceptor logic. In demo mode the config is returned untouched
 * and neither probe is invoked (no live credential reads). Live mode attaches
 * the JWT and license key exactly as before.
 */
export function applyRequestPolicy<T>(config: T, isDemo: boolean, probes: RequestCredentialProbes): T {
  if (!config || typeof config !== 'object') return config
  if (isDemo) return config
  const target = config as { headers?: unknown }
  const token = probes.getAccessToken()
  if (token) {
    const headers = ensureHeaders(target)
    headers.Authorization = `Bearer ${token}`
  }
  const licenseKey = probes.getLicenseKey()
  if (licenseKey) {
    const headers = ensureHeaders(target)
    headers['X-Shoreline-License-Key'] = licenseKey
  }
  return config
}

function ensureHeaders(target: { headers?: unknown }): Record<string, unknown> {
  if (!target.headers || typeof target.headers !== 'object') target.headers = {}
  return target.headers as Record<string, unknown>
}

export interface UnauthorizedProbes {
  refreshAccessToken: () => Promise<unknown>
  getAccessToken: () => string | null | undefined
  clearSession: () => void
  redirectToLogin: () => void
  retryRequest: (config: Record<string, unknown>) => Promise<unknown>
}

/**
 * Response interceptor logic. Demo mode always rejects untouched (no refresh,
 * no retry, no redirect). Live mode refreshes once on the first 401 and
 * retries; anything else — non-401, malformed original, replayed 401, or a
 * failed refresh — rejects, clearing the session and redirecting only when a
 * refresh was attempted and failed. A failed retry after a successful refresh
 * propagates its own error unchanged (no clear, no redirect).
 */
export async function handleResponseError(
  error: unknown,
  isDemo: boolean,
  probes: UnauthorizedProbes
): Promise<unknown> {
  if (isDemo) return Promise.reject(error)
  if (!error || typeof error !== 'object') return Promise.reject(error)
  const response = (error as { response?: unknown }).response
  const status =
    response && typeof response === 'object'
      ? (response as { status?: unknown }).status
      : undefined
  if (status !== 401) return Promise.reject(error)
  const original = (error as { config?: unknown }).config
  if (!original || typeof original !== 'object') return Promise.reject(error)
  const target = original as Record<string, unknown>
  if (target._retry) return Promise.reject(error)
  target._retry = true
  try {
    await probes.refreshAccessToken()
  } catch {
    probes.clearSession()
    probes.redirectToLogin()
    return Promise.reject(error)
  }
  const headers = ensureHeaders(target as { headers?: unknown })
  headers.Authorization = `Bearer ${probes.getAccessToken()}`
  return probes.retryRequest(target)
}
