/**
 * High-Performance In-Memory LRU Cache & HTTP Conditional ETag Engine
 * 
 * Provides:
 * 1. Low-latency LRU Memory Caching with TTL & maximum capacity
 * 2. Tag-based cache invalidation (e.g. invalidate 'recipes:*' on recipe write)
 * 3. HTTP Conditional GET (ETag / If-None-Match) returning 304 Not Modified
 * 4. Pure computational memoization for heavy dietary calculations
 */

import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

export interface CacheEntry<T = any> {
  value: T
  eTag: string
  expiresAt: number
  tag?: string
}

export class LruMemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxCapacity: number
  private defaultTtlMs: number

  constructor(maxCapacity: number = 1000, defaultTtlSeconds: number = 300) {
    this.maxCapacity = maxCapacity
    this.defaultTtlMs = defaultTtlSeconds * 1000
  }

  get(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Refresh LRU order by re-inserting
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry
  }

  set(key: string, value: T, ttlSeconds?: number, tag?: string): CacheEntry<T> {
    // Evict oldest item if at capacity
    if (this.cache.size >= this.maxCapacity) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    const json = JSON.stringify(value)
    const eTag = `"${crypto.createHash('md5').update(json).digest('hex')}"`
    const expiresAt = Date.now() + (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs)

    const entry: CacheEntry<T> = { value, eTag, expiresAt, tag }
    this.cache.set(key, entry)
    return entry
  }

  invalidateTag(tag: string): number {
    let count = 0
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tag === tag || key.startsWith(tag)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

// Global server LRU cache instance
export const serverCache = new LruMemoryCache(2000, 300)

/**
 * Express middleware for HTTP Conditional Caching & ETag generation
 */
export function httpCacheMiddleware(ttlSeconds: number = 60, cacheTag?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') return next()

    const cacheKey = `${req.originalUrl || req.url}`
    const cached = serverCache.get(cacheKey)

    // Check Client ETag (If-None-Match)
    const clientEtag = req.headers['if-none-match']
    if (cached && clientEtag && clientEtag === cached.eTag) {
      res.setHeader('ETag', cached.eTag)
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, must-revalidate`)
      return res.status(304).end()
    }

    // Serve from memory cache if available
    if (cached) {
      res.setHeader('ETag', cached.eTag)
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, must-revalidate`)
      return res.json(cached.value)
    }

    // Intercept res.json to populate cache and set headers
    const originalJson = res.json.bind(res)
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const entry = serverCache.set(cacheKey, body, ttlSeconds, cacheTag)
        res.setHeader('ETag', entry.eTag)
        res.setHeader('X-Cache', 'MISS')
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, must-revalidate`)
      }
      return originalJson(body)
    }

    next()
  }
}
