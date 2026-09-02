/**
 * Webhook Routes — Shoreline v6.0
 *
 * POST   /api/webhooks/subscribe         Register a new webhook endpoint
 * DELETE /api/webhooks/subscribe/:id     Unregister a webhook endpoint
 * GET    /api/webhooks/subscriptions     List all registered subscriptions
 * POST   /api/webhooks/test             Fire a test event to all subscribers
 */

import { Router, Request, Response, NextFunction } from 'express'
import { globalWebhookEmitter } from '../webhooks/emitter'
import type { HaccpTempViolationEvent } from '../webhooks/events'
import crypto from 'crypto'

export const webhooksRouter = Router()

// ── POST /api/webhooks/subscribe ─────────────────────────────────────────────

webhooksRouter.post('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, secret, description } = req.body as {
      url?: string
      secret?: string
      description?: string
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' })
    }

    // Basic URL validation
    try {
      new URL(url)
    } catch {
      return res.status(400).json({ error: 'url must be a valid HTTP/HTTPS URL' })
    }

    const sub = globalWebhookEmitter.subscribe(url, secret, description)
    return res.status(201).json({
      message: 'Webhook subscription registered',
      subscription: sub,
    })
  } catch (err) {
    next(err)
  }
})

// ── DELETE /api/webhooks/subscribe/:id ───────────────────────────────────────

webhooksRouter.delete('/subscribe/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const removed = globalWebhookEmitter.unsubscribe(id)
    if (!removed) {
      return res.status(404).json({ error: `Subscription ${id} not found` })
    }
    return res.json({ message: 'Webhook subscription removed', id })
  } catch (err) {
    next(err)
  }
})

// ── GET /api/webhooks/subscriptions ──────────────────────────────────────────

webhooksRouter.get('/subscriptions', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subs = globalWebhookEmitter.listSubscriptions().map((s) => ({
      ...s,
      secret: s.secret ? '***' : undefined, // Mask secrets in list response
    }))
    return res.json({ count: subs.length, subscriptions: subs })
  } catch (err) {
    next(err)
  }
})

// ── POST /api/webhooks/test ───────────────────────────────────────────────────

webhooksRouter.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const testEvent: HaccpTempViolationEvent = {
      event: 'haccp.temp.violation',
      eventId: crypto.randomUUID(),
      facilityId: 'FAC-TEST',
      emittedAt: new Date().toISOString(),
      payload: {
        probeId: 'PROBE-TEST',
        stationId: 'STATION-TEST',
        itemName: 'Test Food Item',
        measuredTempF: 130,
        requiredMinTempF: 140,
        violationType: 'hot_hold_below_140',
        loggedBy: 'webhook_test',
        correctionRequired: true,
      },
    }

    const results = await globalWebhookEmitter.emit(testEvent)
    return res.json({
      message: 'Test event emitted',
      event: testEvent.event,
      deliveries: results,
    })
  } catch (err) {
    next(err)
  }
})
