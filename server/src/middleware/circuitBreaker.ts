/**
 * Circuit Breaker & External API Resilience Engine
 * 
 * Protects external vendor and clinical integrations (PointClickCare, Dennis, Sysco, USDA)
 * against network timeouts, slow responses, and external outages by failing fast and
 * providing graceful fallback degradation.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  failureThreshold?: number // Number of failures before tripping (default: 3)
  recoveryTimeoutMs?: number // Time to wait in OPEN before trying HALF_OPEN (default: 10000ms)
  timeoutMs?: number // Max execution time for an operation before timeout (default: 3000ms)
}

export class CircuitBreaker {
  readonly name: string
  private state: CircuitState = 'CLOSED'
  private failureCount: number = 0
  private lastFailureTime: number = 0
  private failureThreshold: number
  private recoveryTimeoutMs: number
  private timeoutMs: number

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name
    this.failureThreshold = options.failureThreshold || 3
    this.recoveryTimeoutMs = options.recoveryTimeoutMs || 10000
    this.timeoutMs = options.timeoutMs || 3000
  }

  getState(): CircuitState {
    // If OPEN and recovery timeout has passed, transition to HALF_OPEN
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
      this.state = 'HALF_OPEN'
    }
    return this.state
  }

  /**
   * Execute an asynchronous task protected by the circuit breaker
   */
  async execute<T>(action: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState()

    if (currentState === 'OPEN') {
      if (fallback) {
        return fallback()
      }
      throw new Error(`[CircuitBreaker: ${this.name}] Circuit is OPEN. Fast-failing request.`)
    }

    try {
      // Execute action with strict timeout
      const result = await this.withTimeout(action(), this.timeoutMs)
      this.onSuccess()
      return result
    } catch (err: any) {
      this.onFailure()
      if (fallback) {
        return fallback()
      }
      throw err
    }
  }

  private onSuccess() {
    this.failureCount = 0
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[CircuitBreaker: ${this.name}] Operation timed out after ${ms}ms`))
      }, ms)

      promise
        .then(res => {
          clearTimeout(timer)
          resolve(res)
        })
        .catch(err => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  /** Force reset for testing or manual recovery */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.lastFailureTime = 0
  }
}
