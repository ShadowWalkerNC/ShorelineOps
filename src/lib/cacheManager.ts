/**
 * Client-Side SWR (Stale-While-Revalidate) & Hybrid Cache Manager
 * 
 * Provides:
 * 1. 0ms instant UI rendering from in-memory / IndexedDB cache
 * 2. Silent background network revalidation
 * 3. Cache change listeners for reactive UI stores
 * 4. Offline resilience for kitchen tablet workstations
 */

import { getCachedKitchenData, cacheKitchenData } from './offlineQueue'

export interface SwrOptions<T> {
  ttlSeconds?: number
  onFreshData?: (data: T) => void
}

class ClientCacheManager {
  private memoryCache = new Map<string, { data: any; cachedAt: number }>()
  private subscribers = new Map<string, Set<(data: any) => void>>()

  /**
   * Stale-While-Revalidate fetch wrapper
   */
  async swr<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: SwrOptions<T> = {}
  ): Promise<T> {
    const { ttlSeconds = 120, onFreshData } = options
    const now = Date.now()

    // 1. Check in-memory cache
    const mem = this.memoryCache.get(key)
    if (mem && now - mem.cachedAt < ttlSeconds * 1000) {
      // Trigger background revalidate if older than 30s
      if (now - mem.cachedAt > 30000) {
        this.revalidateInBackground(key, fetcher, onFreshData)
      }
      return mem.data as T
    }

    // 2. Check IndexedDB persistent cache
    try {
      const persisted = await getCachedKitchenData<T>(key)
      if (persisted) {
        this.memoryCache.set(key, { data: persisted, cachedAt: now })
        this.revalidateInBackground(key, fetcher, onFreshData)
        return persisted
      }
    } catch {
      // IndexedDB unavailable, proceed with direct network fetch
    }

    // 3. Fresh network fetch
    const fresh = await fetcher()
    this.memoryCache.set(key, { data: fresh, cachedAt: now })
    try {
      await cacheKitchenData(key, fresh)
    } catch {
      // ignore storage error
    }
    return fresh
  }

  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    callback?: (data: T) => void
  ) {
    try {
      const fresh = await fetcher()
      const current = this.memoryCache.get(key)
      
      // Update cache
      this.memoryCache.set(key, { data: fresh, cachedAt: Date.now() })
      await cacheKitchenData(key, fresh)

      // Notify subscribers if payload changed
      if (JSON.stringify(current?.data) !== JSON.stringify(fresh)) {
        if (callback) callback(fresh)
        this.notify(key, fresh)
      }
    } catch {
      // Silent network error in background — user continues using stale cache
    }
  }

  subscribe(key: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set())
    }
    this.subscribers.get(key)!.add(callback)

    return () => {
      this.subscribers.get(key)?.delete(callback)
    }
  }

  private notify(key: string, data: any) {
    const subs = this.subscribers.get(key)
    if (subs) {
      subs.forEach(cb => cb(data))
    }
  }

  invalidate(key: string): void {
    this.memoryCache.delete(key)
  }
}

export const clientCache = new ClientCacheManager()
