/**
 * Commercial Billing & Stripe Webhook Routes
 * Shoreline Care OS v6.2
 */

import { Router, Request, Response, NextFunction } from 'express'
import { StripeBillingEngine } from '../billing/stripeEngine'

export const billingRouter = Router()

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
 * Ingests Stripe payment lifecycle events
 */
billingRouter.post('/webhook', (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = req.body || { type: 'unknown', data: { object: {} } }
    const result = StripeBillingEngine.handleStripeWebhookEvent(event)
    res.json({ received: true, result })
  } catch (err) {
    next(err)
  }
})