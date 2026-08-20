/**
 * Clinical EHR & Nutrition Router (V3 Milestone)
 *
 * Exposes endpoints for EHR census synchronization, inbound ADT/diet webhooks,
 * dynamic meal validation, and therapeutic nutritional analysis.
 */

import { Router, Request, Response } from 'express'
import { PointClickCareConnector } from '../integrations/pointclickcare'
import { requireAuth } from '../middleware/requireAuth'

export const ehrRouter = Router()
const pcc = new PointClickCareConnector()

/**
 * GET /api/ehr/census
 * Pulls current active census from connected EHR
 */
ehrRouter.get('/census', requireAuth, async (_req: Request, res: Response) => {
  try {
    const census = await pcc.getCensus('FAC-DEFAULT')
    res.json({ system: pcc.systemName, count: census.length, residents: census })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch EHR census' })
  }
})

/**
 * POST /api/ehr/webhook
 * Ingests inbound diet order, texture, or ADT update from PointClickCare / MatrixCare
 */
ehrRouter.post('/webhook', async (req: Request, res: Response) => {
  try {
    const update = await pcc.processInboundUpdate(req.body)
    const validation = await pcc.validateResidentMeals(update)

    res.json({
      success: true,
      processedAt: new Date().toISOString(),
      resident: update,
      validation,
    })
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Webhook processing failed' })
  }
})

/**
 * POST /api/ehr/nutrients/analyze
 * Computes therapeutic nutritional analysis for a planned meal & diet order
 */
ehrRouter.post('/nutrients/analyze', requireAuth, (req: Request, res: Response) => {
  try {
    const { dietOrder = 'Regular', items = [] } = req.body
    const breakdown = pcc.calculateNutrients(dietOrder, items)
    res.json({ dietOrder, breakdown })
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Nutrient analysis failed' })
  }
})
