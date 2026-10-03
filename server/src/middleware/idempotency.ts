import crypto from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import type { AuthRequest } from './requireAuth'

interface CachedResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  /** How the original response was written: res.json (JSON) or res.send (raw). */
  kind: 'json' | 'send'
  body: any
  bodyHash: string
  createdAt: number
}

interface InProgressEntry {
  bodyHash: string
  createdAt: number
}

/**
 * Secure idempotency middleware for mutating healthcare operations.
 *
 * Security contract (remediation 2026-09-30):
 * - Mount AFTER requireAuth AND the route's requireCapability/requireTier
 *   gates. Replay never precedes authentication or current authorization; a
 *   missing principal skips caching entirely so downstream auth fails closed.
 * - Explicit eligible routes only (owned operational routers). Auth, setup,
 *   webhook, billing-webhook, EHR-webhook, and other credential flows are
 *   never eligible, even if this middleware is mounted by mistake.
 * - Cache scope binds user + facility + role + operation + query + body.
 *   A different principal, role, operation, or query misses and executes
 *   fresh; the same key with a changed body is rejected 422; concurrent
 *   duplicates conflict 409.
 * - Only 2xx successes are cached. 4xx/5xx failures never populate the cache
 *   so denied or failed requests cannot replay or be replayed.
 * - One logical response is captured per key. Express implements res.json on
 *   top of res.send, so a single res.json call fires both hooks: the first
 *   writer wins and records how it was written (json vs send). Replays use
 *   the same writer, preserving object/array/string types and 204 semantics
 *   without double serialization.
 */
export class IdempotencyStore {
  private cache = new Map<string, CachedResponse>()
  private inProgress = new Map<string, InProgressEntry>()
  private ttlMs: number

  constructor(ttlMs: number = 15 * 60 * 1000) {
    this.ttlMs = ttlMs
  }

  get(key: string): CachedResponse | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key)
      return null
    }
    return entry
  }

  set(key: string, res: Omit<CachedResponse, 'createdAt' | 'bodyHash' | 'kind'> & { bodyHash?: string; kind?: 'json' | 'send' }): void {
    if (this.cache.size >= 1000) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, { ...res, kind: res.kind ?? 'json', bodyHash: res.bodyHash ?? '', createdAt: Date.now() })
  }

  getInProgress(key: string): InProgressEntry | null {
    const entry = this.inProgress.get(key)
    if (!entry) return null
    if (Date.now() - entry.createdAt > 30000) {
      this.inProgress.delete(key)
      return null
    }
    return entry
  }

  isProcessing(key: string): boolean {
    return this.getInProgress(key) !== null
  }

  start(key: string, bodyHash = ''): void {
    this.inProgress.set(key, { bodyHash, createdAt: Date.now() })
  }

  finish(key: string): void {
    this.inProgress.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.inProgress.clear()
  }
}

export const globalIdempotencyStore = new IdempotencyStore()

const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Mutating routers explicitly eligible for scoped replay. */
const ELIGIBLE_PREFIXES = [
  '/api/residents',
  '/api/kitchen',
  '/api/reporting',
  '/api/hardware',
  '/api/production',
  '/api/enterprise',
] as const

/** Credential and signature flows that must never replay or cache. */
const EXCLUDED_PREFIXES = [
  '/api/auth',
  '/api/setup',
  '/api/webhooks',
  '/api/billing',
  '/api/ehr/webhook',
  '/api/mcp',
  '/api/timecard',
] as const

function fullPathOf(req: Request): string {
  return `${req.baseUrl || ''}${req.path || ''}` || req.path || ''
}

function matchesPrefix(fullPath: string, prefix: string): boolean {
  return fullPath === prefix || fullPath.startsWith(`${prefix}/`)
}

export function isIdempotentEligible(req: Request): boolean {
  if (!IDEMPOTENT_METHODS.has(req.method)) return false
  const fullPath = fullPathOf(req)
  for (const excluded of EXCLUDED_PREFIXES) {
    if (matchesPrefix(fullPath, excluded)) return false
  }
  return ELIGIBLE_PREFIXES.some((prefix) => matchesPrefix(fullPath, prefix))
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function hashRequestBody(body: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(body ?? null)).digest('hex')
}

export function hashRequestQuery(query: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(query ?? {})).digest('hex').slice(0, 32)
}

/** Snapshot a res.json payload so later handler mutation cannot corrupt the replay. */
function cloneJsonBody(body: any): any {
  if (body === null || typeof body !== 'object') return body
  try {
    return structuredClone(body)
  } catch {
    try {
      return JSON.parse(JSON.stringify(body))
    } catch {
      return body
    }
  }
}

function idempotencyKeyHeader(req: Request): string | null {
  const header = req.headers['idempotency-key'] || req.headers['x-idempotency-key']
  if (!header || typeof header !== 'string' || !header.trim()) return null
  const trimmed = header.trim()
  if (trimmed.length > 128) return null
  return trimmed
}

export function buildIdempotencyKey(req: AuthRequest, keyHeader: string, fullPath: string): string {
  const queryHash = hashRequestQuery(req.query ?? {})
  return `${req.method}:${fullPath}:${req.facilityId}:${req.userId}:${req.userRole}:${queryHash}:${keyHeader}`
}

/**
 * Scoped replay middleware. Must be mounted after requireAuth and the route's
 * capability/tier gates so replay observes the current principal, role, and
 * permission. In-handler clinical checks (NPO hard-blocks, dietitian-only
 * field gates) still run on execution; replay returns a prior 2xx without
 * re-executing, and failures are never cached.
 */
export function idempotencyMiddleware(store: IdempotencyStore = globalIdempotencyStore) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!isIdempotentEligible(req)) {
      return next()
    }

    // Authentication before replay: without a verified principal this layer
    // does nothing and lets downstream auth fail closed. It never replays.
    const userId = req.userId
    const facilityId = req.facilityId
    if (!userId || !req.userRole || !facilityId) {
      return next()
    }

    const keyHeader = idempotencyKeyHeader(req)
    if (!keyHeader) {
      return next()
    }

    const fullPath = fullPathOf(req)
    const bodyHash = hashRequestBody(req.body ?? null)
    const key = buildIdempotencyKey(req, keyHeader, fullPath)

    const cached = store.get(key)
    if (cached) {
      if (cached.bodyHash !== bodyHash) {
        return res.status(422).json({
          error: 'Idempotency key was already used with a different request body',
          code: 'IDEMPOTENCY_KEY_REUSED',
          requestId: req.headers['x-request-id'],
        })
      }
      res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT')
      res.setHeader('X-Idempotency-Replay', 'true')
      if (cached.statusCode === 204) {
        return res.status(204).send()
      }
      if (cached.kind === 'send') {
        if (cached.body === null || cached.body === undefined) {
          return res.status(cached.statusCode).send()
        }
        return res.status(cached.statusCode).send(cached.body)
      }
      return res.status(cached.statusCode).json(cached.body)
    }

    const inflight = store.getInProgress(key)
    if (inflight) {
      if (inflight.bodyHash !== bodyHash) {
        return res.status(422).json({
          error: 'Idempotency key is already in use with a different request body',
          code: 'IDEMPOTENCY_KEY_REUSED',
          requestId: req.headers['x-request-id'],
        })
      }
      return res.status(409).json({
        error: 'A request with this idempotency key is currently processing',
        code: 'IDEMPOTENCY_CONFLICT',
        requestId: req.headers['x-request-id'],
      })
    }

    store.start(key, bodyHash)

    // Capture one logical response: the first writer (json or send) wins.
    // Without this guard, Express's res.json -> res.send delegation would let
    // the send hook overwrite the cached object with its serialized string,
    // and replays would double-serialize.
    let captured = false
    const capture = (kind: 'json' | 'send', body: any) => {
      if (captured) return
      captured = true
      // Only 2xx successes are cached. Denied (401/403/422), validation
      // failures, and server errors never populate the cache.
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(key, {
          statusCode: res.statusCode,
          headers: { 'content-type': kind === 'json' ? 'application/json' : 'text/html; charset=utf-8' },
          kind,
          body: kind === 'json' ? cloneJsonBody(body) : body,
          bodyHash,
        })
      }
      store.finish(key)
    }

    const originalJson = res.json.bind(res)
    res.json = ((body: any) => {
      capture('json', body)
      return originalJson(body)
    }) as typeof res.json

    const originalSend = res.send.bind(res)
    res.send = ((body: any) => {
      capture('send', body)
      return originalSend(body)
    }) as typeof res.send

    res.on('finish', () => store.finish(key))
    res.on('close', () => store.finish(key))

    next()
  }
}
