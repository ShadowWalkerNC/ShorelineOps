import type { Request, Response, NextFunction } from 'express'

interface CachedResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: any
  createdAt: number
}

interface InProgressEntry {
  createdAt: number
}

/**
 * Enterprise Idempotency Middleware for Healthcare Dietary & Purchasing Operations.
 * 
 * Prevents accidental duplicate submissions (e.g. double meal tallies, duplicate purchase orders,
 * redundant credit memos) caused by network retries or double-taps on kitchen kiosks.
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

  set(key: string, res: Omit<CachedResponse, 'createdAt'>): void {
    // Evict oldest if cache grows above 1,000 entries
    if (this.cache.size >= 1000) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }
    this.cache.set(key, { ...res, createdAt: Date.now() })
  }

  isProcessing(key: string): boolean {
    const entry = this.inProgress.get(key)
    if (!entry) return false
    // If stuck in progress for over 30 seconds, treat as expired
    if (Date.now() - entry.createdAt > 30000) {
      this.inProgress.delete(key)
      return false
    }
    return true
  }

  start(key: string): void {
    this.inProgress.set(key, { createdAt: Date.now() })
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

/**
 * Express middleware that handles Idempotency-Key headers
 */
export function idempotencyMiddleware(store: IdempotencyStore = globalIdempotencyStore) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to mutating HTTP methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next()
    }

    const keyHeader = req.headers['idempotency-key'] || req.headers['x-idempotency-key']
    if (!keyHeader || typeof keyHeader !== 'string' || !keyHeader.trim()) {
      return next()
    }

    const key = `${req.method}:${req.baseUrl || ''}${req.path}:${keyHeader.trim()}`

    // Check for cached idempotent response
    const cached = store.get(key)
    if (cached) {
      res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT')
      res.setHeader('X-Idempotency-Replay', 'true')
      return res.status(cached.statusCode).json(cached.body)
    }

    // Check for concurrent in-flight execution
    if (store.isProcessing(key)) {
      return res.status(409).json({
        error: 'A request with this idempotency key is currently processing',
        code: 'IDEMPOTENCY_CONFLICT',
        requestId: req.headers['x-request-id'],
      })
    }

    store.start(key)

    // Intercept res.json to capture response
    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      // Only cache successful or client error outcomes (avoid caching 5xx errors)
      if (res.statusCode < 500) {
        store.set(key, {
          statusCode: res.statusCode,
          headers: { 'content-type': 'application/json' },
          body,
        })
      }
      store.finish(key)
      return originalJson(body)
    }

    // Clean up if request terminates or errors before res.json
    res.on('finish', () => store.finish(key))
    res.on('close', () => store.finish(key))

    next()
  }
}
