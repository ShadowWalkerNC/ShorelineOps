/**
 * WebhookEmitter — Shoreline v6.0
 *
 * In-memory webhook dispatcher with HMAC-SHA256 request signing,
 * 3-retry exponential backoff, and typed event payloads.
 *
 * Uses only Node.js built-in modules (https, crypto) — zero new deps.
 */

import crypto from 'crypto'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import type { WebhookEvent } from './events'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebhookSubscription {
  id: string
  url: string
  secret?: string
  createdAt: string
  description?: string
}

export interface EmitResult {
  subscriptionId: string
  url: string
  success: boolean
  statusCode?: number
  attempts: number
  error?: string
}

// ── Emitter ───────────────────────────────────────────────────────────────────

export class WebhookEmitter {
  private subscriptions: Map<string, WebhookSubscription> = new Map()

  // ── Subscription Management ────────────────────────────────────────────────

  subscribe(url: string, secret?: string, description?: string): WebhookSubscription {
    const id = crypto.randomUUID()
    const sub: WebhookSubscription = {
      id,
      url,
      secret,
      createdAt: new Date().toISOString(),
      description,
    }
    this.subscriptions.set(id, sub)
    return sub
  }

  unsubscribe(id: string): boolean {
    return this.subscriptions.delete(id)
  }

  listSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values())
  }

  getSubscription(id: string): WebhookSubscription | undefined {
    return this.subscriptions.get(id)
  }

  // ── Signature ──────────────────────────────────────────────────────────────

  /**
   * Generate HMAC-SHA256 signature for a payload using the subscriber secret.
   * Header format: `sha256=<hex-digest>`
   */
  static sign(payload: string, secret: string): string {
    return (
      'sha256=' +
      crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
    )
  }

  // ── HTTP Delivery ──────────────────────────────────────────────────────────

  /**
   * Deliver a single POST request to a subscriber URL.
   * Returns the HTTP status code or throws on network error.
   */
  private static deliverOnce(
    url: string,
    body: string,
    signature: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const isHttps = parsed.protocol === 'https:'
      const transport = isHttps ? https : http

      const options: http.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Shoreline-Signature': signature,
          'X-Shoreline-Event': 'webhook',
          'User-Agent': 'Shoreline-Webhook/6.0',
        },
      }

      const req = transport.request(options, (res) => {
        // Drain the body so the socket can be reused
        res.resume()
        res.on('end', () => resolve(res.statusCode ?? 0))
      })

      req.on('error', reject)
      req.setTimeout(10000, () => {
        req.destroy(new Error('Webhook delivery timeout'))
      })

      req.write(body)
      req.end()
    })
  }

  /**
   * Deliver with exponential backoff: delays 1s, 2s, 4s on failure.
   */
  private static async deliverWithRetry(
    url: string,
    body: string,
    signature: string,
    maxAttempts = 3
  ): Promise<{ success: boolean; statusCode?: number; attempts: number; error?: string }> {
    let lastError: string | undefined
    let lastStatus: number | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const status = await WebhookEmitter.deliverOnce(url, body, signature)
        if (status >= 200 && status < 300) {
          return { success: true, statusCode: status, attempts: attempt }
        }
        lastStatus = status
        lastError = `HTTP ${status}`
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err)
      }

      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      }
    }

    return {
      success: false,
      statusCode: lastStatus,
      attempts: maxAttempts,
      error: lastError,
    }
  }

  // ── Emit ──────────────────────────────────────────────────────────────────

  /**
   * Emit an event to all registered subscribers in parallel.
   * Each subscriber is retried independently with exponential backoff.
   */
  async emit(event: WebhookEvent): Promise<EmitResult[]> {
    if (this.subscriptions.size === 0) return []

    const body = JSON.stringify(event)

    const deliveries = Array.from(this.subscriptions.values()).map(async (sub) => {
      const signature = sub.secret
        ? WebhookEmitter.sign(body, sub.secret)
        : 'sha256=unsigned'

      const result = await WebhookEmitter.deliverWithRetry(sub.url, body, signature)

      if (!result.success) {
        console.warn(
          `[Webhook] FAILED to deliver ${event.event} to ${sub.url} after ${result.attempts} attempt(s): ${result.error}`
        )
      }

      return {
        subscriptionId: sub.id,
        url: sub.url,
        ...result,
      } as EmitResult
    })

    return Promise.all(deliveries)
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const globalWebhookEmitter = new WebhookEmitter()
