"use strict";
/**
 * In-Flight Request Deduplicator & Concurrency Coalescer
 *
 * Coalesces duplicate simultaneous asynchronous operations (e.g. 10 kitchen tablets
 * requesting the active cycle menu week simultaneously at shift start) into a single execution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalDeduplicator = exports.RequestDeduplicator = void 0;
class RequestDeduplicator {
    inFlight = new Map();
    /**
     * Execute or join an existing in-flight promise for the given key
     */
    async deduplicate(key, producer) {
        const existing = this.inFlight.get(key);
        if (existing) {
            return existing;
        }
        const promise = producer()
            .finally(() => {
            this.inFlight.delete(key);
        });
        this.inFlight.set(key, promise);
        return promise;
    }
    get activeCount() {
        return this.inFlight.size;
    }
    clear() {
        this.inFlight.clear();
    }
}
exports.RequestDeduplicator = RequestDeduplicator;
exports.globalDeduplicator = new RequestDeduplicator();
