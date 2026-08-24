/**
 * Clinical EHR & Nutrition Router (V3 Milestone)
 *
 * Exposes endpoints for EHR census synchronization, inbound ADT/diet webhooks,
 * dynamic meal validation, and therapeutic nutritional analysis.
 */

import { Router, Request, Response } from 'express'
import { PointClickCareConnector } from '../integrations/pointclickcare'
import { USDAFoodDataConnector } from '../integrations/usda'
import { requireAuth } from '../middleware/requireAuth'
import { requireTier } from '../middleware/requireTier'

export const ehrRouter = Router()
const pcc = new PointClickCareConnector()
const usda = new USDAFoodDataConnector()

/**
 * GET /api/ehr/census
 * Pulls current active census from connected EHR
 */
ehrRouter.get('/census', requireAuth, requireTier('enterprise'), async (_req: Request, res: Response) => {
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

/**
 * POST /api/ehr/nutrients/usda
 * Comprehensive USDA FoodData Central meal breakdown & clinical compliance flags
 */
ehrRouter.post('/nutrients/usda', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dietOrder = 'Regular', items = [] } = req.body
    const analysis = await usda.analyzeMeal(items, dietOrder)
    res.json(analysis)
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'USDA nutrient analysis failed' })
  }
})

import { pool } from '../db/pool'

/**
 * GET /api/ehr/reconciliation-queue
 * Lists all pending, approved, and rejected inbound EHR triage items for Registered Dietitians
 */
ehrRouter.get('/reconciliation-queue', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status = 'PENDING_TRIAGE' } = req.query
    const { rows } = await pool.query(`
      SELECT * FROM ehr_reconciliation_queue 
      WHERE status = $1 
      ORDER BY created_at DESC
    `, [String(status)])

    res.json({
      totalPending: rows.length,
      items: rows,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch reconciliation queue' })
  }
})

/**
 * POST /api/ehr/reconciliation-queue/:id/resolve
 * RD resolves an inbound EHR change (APPROVE or REJECT)
 */
ehrRouter.post('/reconciliation-queue/:id/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { action, resolvedBy = 'Registered Dietitian' } = req.body // 'APPROVED_BY_RD' | 'REJECTED_BY_RD'

    if (!action || !['APPROVED_BY_RD', 'REJECTED_BY_RD'].includes(action)) {
      return res.status(400).json({ error: "action must be 'APPROVED_BY_RD' or 'REJECTED_BY_RD'" })
    }

    const { rows: [triageItem] } = await pool.query(
      'SELECT * FROM ehr_reconciliation_queue WHERE id = $1',
      [id]
    )

    if (!triageItem) {
      return res.status(404).json({ error: 'Triage item not found' })
    }

    await pool.query(`
      UPDATE ehr_reconciliation_queue
      SET status = $1, resolved_by = $2, resolved_at = NOW()
      WHERE id = $3
    `, [action, resolvedBy, id])

    // If approved, commit change to resident record and increment profile version
    if (action === 'APPROVED_BY_RD' && triageItem.resident_id) {
      const payload = typeof triageItem.incoming_payload === 'string' 
        ? JSON.parse(triageItem.incoming_payload) 
        : triageItem.incoming_payload

      if (triageItem.change_type === 'DIET_ORDER' && payload.dietOrder) {
        await pool.query(`
          UPDATE residents 
          SET diet_type = $1, profile_version = profile_version + 1, updated_at = NOW() 
          WHERE id = $2
        `, [payload.dietOrder, triageItem.resident_id])
      } else if (triageItem.change_type === 'TEXTURE_UPDATE' && payload.texture) {
        await pool.query(`
          UPDATE residents 
          SET texture = $1, profile_version = profile_version + 1, updated_at = NOW() 
          WHERE id = $2
        `, [payload.texture, triageItem.resident_id])
      } else if (triageItem.change_type === 'NPO_ORDER') {
        await pool.query(`
          UPDATE residents 
          SET is_npo = true, npo_reason = 'EHR Physician Order', profile_version = profile_version + 1, updated_at = NOW() 
          WHERE id = $2
        `, [triageItem.resident_id])
      }
    }

    res.json({
      success: true,
      resolvedId: id,
      action,
      resolvedBy,
      resolvedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to resolve reconciliation item' })
  }
})

/**
 * POST /api/ehr/simulate-inbound-triage
 * Simulates inbound EHR webhook with automated RD triage evaluation
 */
ehrRouter.post('/simulate-inbound-triage', async (req: Request, res: Response) => {
  try {
    const { residentId, incomingDiet, incomingTexture, newAllergens = [] } = req.body

    const { rows: [resident] } = await pool.query(
      'SELECT id, name, diet_type, texture, allergies, is_npo FROM residents WHERE id = $1',
      [residentId]
    )

    if (!resident) {
      return res.status(404).json({ error: 'Resident not found' })
    }

    const incomingUpdate = {
      residentExternalId: `PCC-${resident.id.slice(0, 8)}`,
      firstName: resident.name.split(' ')[0] || 'Resident',
      lastName: resident.name.split(' ').slice(1).join(' ') || 'Patient',
      room: '101',
      status: 'active' as const,
      dietOrder: incomingDiet || resident.diet_type,
      texture: incomingTexture || resident.texture,
      allergies: [...(resident.allergies || []), ...newAllergens],
      supplements: [],
      effectiveAt: new Date().toISOString(),
    }

    const triageItem = pcc.evaluateInboundTriage(incomingUpdate, {
      id: resident.id,
      dietType: resident.diet_type,
      texture: resident.texture,
      allergies: resident.allergies || [],
      isNpo: resident.is_npo,
    })

    if (triageItem) {
      await pool.query(`
        INSERT INTO ehr_reconciliation_queue
          (resident_id, resident_name, external_ehr_id, source_ehr, change_type, incoming_payload, conflict_reason, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_TRIAGE')
      `, [
        resident.id,
        resident.name,
        triageItem.externalEhrId,
        triageItem.sourceEhr,
        triageItem.changeType,
        JSON.stringify(triageItem.incomingPayload),
        triageItem.conflictReason,
      ])
    }

    res.json({
      triageRequired: !!triageItem,
      triageItem,
    })
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Simulation failed' })
  }
})
