/**
 * Demo-only raw-fetch network boundary.
 *
 * Security review found many raw `fetch()` call sites (kitchen, admin,
 * setup, scanners) that bypass the shared Axios client and could attach live
 * credentials (Authorization / license headers) to real backend requests.
 * Fixing every call site individually is fragile: any missed or future raw
 * fetch re-opens the hole. A single page-scope `fetch` guard is the smallest
 * change that closes ALL raw-fetch paths at once, synchronously, before ANY
 * headers or bytes are transmitted.
 *
 * Scope of THIS module (other owners cover the rest):
 * - Raw `fetch()` only. Axios runs over XMLHttpRequest in browsers, so it is
 *   NOT affected by this guard — the api/client.ts owner blocks Axios
 *   separately. No XHR/prototype patching here.
 * - Demo builds only (`VITE_DEMO_MODE === 'true'`). Live builds never
 *   install the guard (see src/main.tsx compile-time gate) and behave
 *   exactly as before.
 * - Page scope only. The service worker keeps its own fetch handling.
 *
 * Behavior when enabled:
 * - Blocks same-origin `/api` (exact) and `/api/...` (prefix) requests.
 * - Blocks the configured `VITE_API_URL` target: a same-origin/relative
 *   target blocks only its path prefix (never the whole origin, so assets,
 *   fonts, navigation keep working); a remote target blocks its origin +
 *   path prefix, or the whole remote origin when the configured target is
 *   the API-base root (path `/`), which also covers the token-refresh URL.
 * - Blocked requests REJECT with an Error whose `code` is
 *   `DEMO_API_UNAVAILABLE`. They NEVER resolve with a synthetic success
 *   Response — no fake clinical data is ever returned.
 * - Everything else (assets, fonts, `/apiary`, marketing pages, navigation)
 *   delegates to the original fetch untouched.
 *
 * Installation is idempotent: installing twice keeps a single wrapper, and
 * the returned restore function unwraps exactly once.
 *
 * This module is dependency-free and side-effect-free so it can be loaded
 * from source by the server test suite (see
 * server/src/demo-network-boundary.test.ts) and tree-shaken from live
 * bundles. It reads no secrets, storage, or environment on import; all
 * configuration is injected via function arguments.
 */

export const DEMO_API_UNAVAILABLE = 'DEMO_API_UNAVAILABLE' as const

export const DEMO_API_UNAVAILABLE_MESSAGE = 'backend workflow unavailable in public demo' as const

export type DemoApiUnavailableCode = typeof DEMO_API_UNAVAILABLE

export interface DemoApiUnavailableError extends Error {
  code: DemoApiUnavailableCode
}

export function createDemoApiUnavailableError(): DemoApiUnavailableError {
  const error = new Error(
    `Demo API unavailable: ${DEMO_API_UNAVAILABLE_MESSAGE}`,
  ) as DemoApiUnavailableError
  error.code = DEMO_API_UNAVAILABLE
  return error
}

/** fetch-compatible signature without DOM types, so tests can inject spies. */
export type FetchLike = (input: any, init?: any) => Promise<any>

/** Minimal global-scope shape; the browser passes `globalThis`. */
export interface DemoNetworkBoundaryScope {
  fetch: FetchLike
  location?: { href?: string; origin?: string }
  [key: string]: unknown
}

export interface DemoApiMatchConfig {
  /** Configured API base (`VITE_API_URL`). Defaults to `/api`. */
  apiUrl?: string | null
  /** Page base URL used to resolve relative refs. Defaults to a dummy base. */
  baseUrl?: string | null
}

export interface InstallDemoNetworkBoundaryOptions extends DemoApiMatchConfig {
  scope: DemoNetworkBoundaryScope
  /** Enable only for `true` / `'true'` (i.e. `VITE_DEMO_MODE === 'true'`). */
  demoMode: unknown
  /** Original fetch override for tests; defaults to `scope.fetch`. */
  fetchImpl?: FetchLike | null
}

export type DemoFetchInput = string | URL | Request

const INSTALLED_FLAG = '__shorelineDemoFetchBoundaryInstalled'
const DEFAULT_API_PATH = '/api'
const DUMMY_BASE = 'http://demo-boundary.invalid/'

export function isDemoModeEnabled(demoMode: unknown): boolean {
  return demoMode === true || demoMode === 'true'
}

function readInputUrl(input: DemoFetchInput): string | null {
  if (typeof input === 'string') return input
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href
  if (typeof input === 'object' && input !== null) {
    // Request instances expose `.url`; duck-typing also covers cross-realm
    // Request objects where `instanceof Request` may fail.
    const maybeUrl = (input as { url?: unknown }).url
    if (typeof maybeUrl === 'string') return maybeUrl
  }
  return null
}

function isRelativeRef(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed.startsWith('//')) return false
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
}

function normalizeApiPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  const stripped = pathname.replace(/\/+$/, '')
  return stripped === '' ? '/' : stripped
}

function pathMatchesPrefix(requestPath: string, apiPath: string): boolean {
  if (apiPath === '/') return true
  return requestPath === apiPath || requestPath.startsWith(`${apiPath}/`)
}

function matchDemoApiRequest(input: DemoFetchInput, config: DemoApiMatchConfig): boolean {
  const raw = readInputUrl(input)
  if (raw === null || raw === '') return false

  const base = config.baseUrl || DUMMY_BASE
  const usedDummyBase = !config.baseUrl

  let target: URL
  try {
    target = new URL(raw, base)
  } catch {
    // Unparseable ref: only a same-origin-looking relative `/api` path can
    // still be classified safely without a base.
    return raw === '/api' || raw.startsWith('/api/') || raw.startsWith('/api?') || raw.startsWith('/api#')
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false

  // Page origin: known from the injected base; for relative refs resolved
  // against the dummy base, same-origin holds by construction.
  let pageOrigin: string | null = null
  if (!usedDummyBase) {
    try {
      pageOrigin = new URL(base).origin
    } catch {
      pageOrigin = null
    }
  } else if (isRelativeRef(raw)) {
    pageOrigin = target.origin
  }

  const targetIsSameOrigin = pageOrigin !== null && target.origin === pageOrigin

  // Rule 1: same-origin `/api` exact/prefix is always an API request.
  // The '/'-boundary check keeps `/apiary`, `/api-docs`, etc. allowed.
  if (targetIsSameOrigin && pathMatchesPrefix(target.pathname, DEFAULT_API_PATH)) {
    return true
  }

  // Rule 2: configured API target (`VITE_API_URL || '/api'`).
  const configured = (config.apiUrl ?? '').trim() || DEFAULT_API_PATH
  let api: URL
  try {
    api = new URL(configured, base)
  } catch {
    return false
  }
  const apiPath = normalizeApiPath(api.pathname)
  const apiIsSameOrigin = pageOrigin !== null && api.origin === pageOrigin

  if (apiIsSameOrigin) {
    // Relative (or same-origin absolute) config: block ONLY the configured
    // path prefix on the page origin. Never block the whole origin — that
    // would take down assets, fonts, and site navigation. A same-origin
    // root config ('/') is nonsensical for an API base, so it falls back to
    // the safe Rule 1 default already checked above.
    if (apiPath === '/') return false
    return targetIsSameOrigin && pathMatchesPrefix(target.pathname, apiPath)
  }

  // Remote configured host.
  if (apiPath === '/') {
    // Dedicated API-base root: block the entire remote origin regardless of
    // path. This also covers `${API_BASE}/auth/refresh` (token refresh).
    return target.origin === api.origin
  }
  return target.origin === api.origin && pathMatchesPrefix(target.pathname, apiPath)
}

/**
 * Pure predicate: is this fetch input a demo-blocked API request?
 * Never throws; unclassifiable inputs fail open (not API requests).
 */
export function isDemoApiRequest(
  input: DemoFetchInput,
  config: DemoApiMatchConfig = {},
): boolean {
  try {
    return matchDemoApiRequest(input, config || {})
  } catch {
    return false
  }
}

/**
 * Install the demo fetch guard on an injected scope. Safe to call when
 * disabled (live builds): the scope is left untouched. Idempotent: a second
 * install while active is a no-op. The guard rejects blocked requests
 * BEFORE the original fetch runs, so no headers/credentials are transmitted.
 */
export function installDemoNetworkBoundary(
  options: InstallDemoNetworkBoundaryOptions,
): () => void {
  const noop = (): void => undefined
  const scope = options?.scope
  if (!scope) return noop
  const original: unknown = options.fetchImpl ?? scope.fetch
  if (typeof original !== 'function') return noop
  if (!isDemoModeEnabled(options.demoMode)) return noop
  const flags = scope as unknown as Record<string, unknown>
  if (flags[INSTALLED_FLAG] === true) return noop

  const baseUrl = options.baseUrl ?? scope.location?.href ?? scope.location?.origin ?? null
  const apiUrl = options.apiUrl ?? null
  const matchConfig: DemoApiMatchConfig = { apiUrl, baseUrl }
  const originalFetch = original as FetchLike

  const guardedFetch: FetchLike = (input: unknown, init?: unknown) => {
    if (isDemoApiRequest(input as DemoFetchInput, matchConfig)) {
      return Promise.reject(createDemoApiUnavailableError())
    }
    return originalFetch.call(scope, input, init)
  }

  const previous = scope.fetch
  flags[INSTALLED_FLAG] = true
  scope.fetch = guardedFetch

  let restored = false
  return () => {
    if (restored) return
    restored = true
    if (scope.fetch === guardedFetch) scope.fetch = previous
    delete flags[INSTALLED_FLAG]
  }
}
