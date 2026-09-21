/**
 * Commercial Billing & Stripe Webhook Routes
 * Shoreline Care OS v6.2
 */

import crypto from 'crypto'
import { Router, Request, Response, NextFunction } from 'express'
import { StripeBillingEngine } from '../billing/stripeEngine'

export const billingRouter = Router()

/**
 * A08: fail-closed secret gate. Without STRIPE_WEBHOOK_SECRET the Stripe webhook
 * cannot verify event authenticity, so it must refuse traffic. Boot warning emitted
 * once at module load; requests are rejected with 503 (mirrors KIOSK_API_SECRET).
 */
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
if (!stripeWebhookSecret || stripeWebhookSecret.length < 16) {
  console.info(
    '[billing] STRIPE_WEBHOOK_SECRET missing or <16 chars — ' +
    'POST /api/billing/webhook will refuse traffic (fail closed) until it is set'
  )
}

/** Stripe-Signature timestamps must be within ±5 minutes of now (same as Stripe's default). */
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

/**
 * Verifies the `Stripe-Signature` header against the RAW request body using the
 * webhook signing secret. Throws on missing/malformed/expired signature or a
 * signature mismatch. Equivalent to Stripe's constructEvent signature check.
 */
export function verifyStripeWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | string[] | undefined,
  secret: string,
): void {
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader
  if (!header) {
    throw new Error('missing Stripe-Signature header')
  }

  let timestamp: string | undefined
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't' && timestamp === undefined) timestamp = value
    else if (key === 'v1') signatures.push(value)
  }
  if (!timestamp || signatures.length === 0) {
    throw new Error('malformed Stripe-Signature header')
  }

  const signedAt = Number.parseInt(timestamp, 10)
  const ageSeconds = Math.floor(Date.now() / 1000) - signedAt
  if (!Number.isFinite(signedAt) || Math.abs(ageSeconds) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error('Stripe-Signature timestamp outside tolerance')
  }

  // Signed payload is `<timestamp>.<raw body bytes>` — byte-exact, never re-serialized.
  const expected = crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]))
    .digest()

  const matched = signatures.some((sig) => {
    let candidate: Buffer
    try {
      candidate = Buffer.from(sig, 'hex')
    } catch {
      return false
    }
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  })
  if (!matched) {
    throw new Error('Stripe-Signature mismatch')
  }
}

/**
 * GET /api/billing/estimate
 * Computes monthly SaaS fee based on licensed bed count
 */
billingRouter.get('/estimate', (req: Request, res: Response) => {
  const beds = parseInt(req.query.beds as string, 10) || 60
  const census = parseInt(req.query.census as string, 10) || beds
  const fee = StripeBillingEngine.calculateMonthlyFee(beds, census)
  res.json(fee)
})

/**
 * POST /api/billing/webhook
 * Ingests Stripe payment lifecycle events.
 *
 * The raw request body (preserved via express.raw in index.ts) is signature-checked
 * with STRIPE_WEBHOOK_SECRET before any processing. Forged events are rejected.
 */
billingRouter.post('/webhook', (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret || secret.length < 16) {
      console.error('[billing] Stripe webhook refused — STRIPE_WEBHOOK_SECRET not configured')
      return res.status(503).json({ error: 'Stripe webhook disabled — set STRIPE_WEBHOOK_SECRET (min 16 chars)' })
    }

    // Signature must be verified against the raw bytes; a parsed/re-serialized
    // body is never trusted for verification (fail closed if raw body is missing).
    const rawBody = req.body as Buffer | undefined
    if (!Buffer.isBuffer(rawBody)) {
      console.error('[billing] Stripe webhook refused — raw request body unavailable')
      return res.status(500).json({ error: 'Stripe webhook misconfigured' })
    }

    try {
      verifyStripeWebhookSignature(rawBody, req.headers['stripe-signature'], secret)
    } catch (err) {
      console.warn(`[billing] Rejected Stripe webhook: ${(err as Error).message}`)
      return res.status(400).json({ error: 'Invalid Stripe webhook signature' })
    }

    const event = JSON.parse(rawBody.toString('utf8'))
    const result = StripeBillingEngine.handleStripeWebhookEvent(event)
    res.json({ received: true, result })
  } catch (err) {
    next(err)
  }
})
