/**
 * In-Flight Request Deduplicator & Concurrency Coalescer
 * 
 * Coalesces duplicate simultaneous asynchronous operations (e.g. 10 kitchen tablets
 * requesting the active cycle menu week simultaneously at shift start) into a single execution.
 */

export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<any>>()

  /**
   * Execute or join an existing in-flight promise for the given key
   */
  async deduplicate<T>(key: string, producer: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key)
    if (existing) {
      return existing as Promise<T>
    }

    const promise = producer()
      .finally(() => {
        this.inFlight.delete(key)
      })

    this.inFlight.set(key, promise)
    return promise
  }

  get activeCount(): number {
    return this.inFlight.size
  }

  clear(): void {
    this.inFlight.clear()
  }
}

export const globalDeduplicator = new RequestDeduplicator()
