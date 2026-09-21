"use strict";
/**
 * Circuit Breaker & External API Resilience Engine
 *
 * Protects external vendor and clinical integrations (PointClickCare, Dennis, Sysco, USDA)
 * against network timeouts, slow responses, and external outages by failing fast and
 * providing graceful fallback degradation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
class CircuitBreaker {
    name;
    state = 'CLOSED';
    failureCount = 0;
    lastFailureTime = 0;
    failureThreshold;
    recoveryTimeoutMs;
    timeoutMs;
    constructor(name, options = {}) {
        this.name = name;
        this.failureThreshold = options.failureThreshold || 3;
        this.recoveryTimeoutMs = options.recoveryTimeoutMs || 10000;
        this.timeoutMs = options.timeoutMs || 3000;
    }
    getState() {
        // If OPEN and recovery timeout has passed, transition to HALF_OPEN
        if (this.state === 'OPEN' && Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
            this.state = 'HALF_OPEN';
        }
        return this.state;
    }
    /**
     * Execute an asynchronous task protected by the circuit breaker
     */
    async execute(action, fallback) {
        const currentState = this.getState();
        if (currentState === 'OPEN') {
            if (fallback) {
                return fallback();
            }
            throw new Error(`[CircuitBreaker: ${this.name}] Circuit is OPEN. Fast-failing request.`);
        }
        try {
            // Execute action with strict timeout
            const result = await this.withTimeout(action(), this.timeoutMs);
            this.onSuccess();
            return result;
        }
        catch (err) {
            this.onFailure();
            if (fallback) {
                return fallback();
            }
            throw err;
        }
    }
    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
        }
    }
    withTimeout(promise, ms) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`[CircuitBreaker: ${this.name}] Operation timed out after ${ms}ms`));
            }, ms);
            promise
                .then(res => {
                clearTimeout(timer);
                resolve(res);
            })
                .catch(err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    /** Force reset for testing or manual recovery */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
