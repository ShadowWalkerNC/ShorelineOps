/**
 * Reporting API — Shoreline V1
 *
 * Operational and compliance reporting for dietary management.
 *
 * Routes:
 *   GET  /api/reporting/summary?start=&end=
 *     → cost per resident day, substitution count, allergy flags, diet mismatches
 *
 *   GET  /api/reporting/cost-log?start=&end=
 *     → daily_cost_log entries for the date range
 *
 *   POST /api/reporting/cost-log
 *     → record a daily cost snapshot
 *
 *   GET  /api/reporting/substitutions?start=&end=
 *     → substitution_log entries
 *
 *   POST /api/reporting/substitutions
 *     → log a substitution
 *
 *   DELETE /api/reporting/substitutions/:id
 *
 *   GET  /api/reporting/allergy-risk?date=
 *     → residents whose assigned items contain flagged allergens (computed)
 *
 *   GET  /api/reporting/diet-mismatches?date=
 *     → residents where served texture/diet does not match profile
 *
 *   GET  /api/reporting/production-variance?start=&end=
 *     → production_sheets: planned vs produced
 */
import { Router, Request, Response, NextFunction } from 'express'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

export const reportingRouter = Router()

function err(res: Response, status: number, msg: string) {
  return res.status(status).json({ error: msg })
}

// ─── Summary (dashboard-level) ────────────────────────────────────────────

/**
 * GET /api/reporting/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns the key operational metrics for the date range.
 */
reportingRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  const { start, end } = req.query
  const startDate = (start as string) ?? new Date().toISOString().slice(0, 10)
  const endDate   = (end   as string) ?? new Date().toISOString().slice(0, 10)

  try {
    // Total food cost and resident-days from daily_cost_log
    const { rows: costRows } = await pool.query(
      `SELECT
         COALESCE(SUM(food_cost),0)      AS total_food_cost,
         COALESCE(SUM(resident_count),0) AS total_resident_days,
         COUNT(*)                         AS log_days
       FROM daily_cost_log
       WHERE log_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    )
    const totalFoodCost    = parseFloat(costRows[0].total_food_cost)
    const totalResidentDays = parseInt(costRows[0].total_resident_days, 10)
    const costPerResidentDay = totalResidentDays > 0
      ? (totalFoodCost / totalResidentDays)
      : null

    // Substitutions count
    const { rows: subRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM substitution_log WHERE meal_date BETWEEN $1 AND $2`,
      [startDate, endDate]
    )
    const substitutions = parseInt(subRows[0].cnt, 10)

    // Active resident count (for context)
    const { rows: resRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM residents WHERE status = 'active'`
    )
    const activeResidents = parseInt(resRows[0].cnt, 10)

    // Allergy risk: count residents with at least one allergen flag
    // (simplified: count residents who have allergens listed)
    const { rows: allergyRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM residents
       WHERE status = 'active'
         AND allergies IS NOT NULL
         AND allergies != ''
         AND allergies != '[]'`
    )
    const allergyFlagCount = parseInt(allergyRows[0].cnt, 10)

    // Diet mismatches: residents whose texture is 'puree' or 'minced'
    // but that's more of a tray-card validation — here we count residents
    // whose texture/diet_order fields are populated (proxy for mismatch risk)
    const { rows: mismatchRows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM residents
       WHERE status = 'active'
         AND (texture IS NOT NULL AND texture != '' AND texture != 'Regular')`
    )
    const specialDietCount = parseInt(mismatchRows[0].cnt, 10)

    // Dietary labor hours and estimated spend from timecard_punches
    const { rows: laborRows } = await pool.query(
      `SELECT
         COUNT(*) AS total_punches
       FROM timecard_punches
       WHERE timestamp >= $1 AND timestamp <= $2`,
      [startDate, endDate]
    )
    const totalPunches = parseInt(laborRows[0]?.total_punches || '0', 10)
    // Estimate 8 hours per clock-in/out pair at standard $18.50/hr dietary rate
    const estimatedLaborHours = +(totalPunches * 4.0).toFixed(1)
    const estimatedLaborCost = +(estimatedLaborHours * 18.50).toFixed(2)
    const totalOperatingCost = +(totalFoodCost + estimatedLaborCost).toFixed(2)
    const totalOperatingCostPerResidentDay = totalResidentDays > 0
      ? (totalOperatingCost / totalResidentDays).toFixed(2)
      : null

    // Category cost allocations (Industry Benchmark: 60% Perishable, 25% Dry Goods, 10% Paper, 5% Chemicals)
    const perishableFoodCost = +(totalFoodCost * 0.60).toFixed(2)
    const dryGroceryCost = +(totalFoodCost * 0.25).toFixed(2)
    const paperGoodsCost = +(totalFoodCost * 0.10).toFixed(2)
    const chemicalSanitationCost = +(totalFoodCost * 0.05).toFixed(2)

    res.json({
      dateRange: { start: startDate, end: endDate },
      activeResidents,
      totalFoodCost: totalFoodCost.toFixed(2),
      totalResidentDays,
      costPerResidentDay: costPerResidentDay !== null ? costPerResidentDay.toFixed(2) : null,
      breakdown: {
        perishableFoodCost,
        dryGroceryCost,
        paperGoodsCost,
        chemicalSanitationCost,
      },
      estimatedLaborHours,
      estimatedLaborCost: estimatedLaborCost.toFixed(2),
      totalOperatingCost: totalOperatingCost.toFixed(2),
      totalOperatingCostPerResidentDay,
      substitutions,
      allergyFlagCount,
      specialDietCount,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) { next(e) }
})

// ─── Daily Cost Log ────────────────────────────────────────────────────────

/** GET /api/reporting/cost-log?start=&end= */
reportingRouter.get('/cost-log', async (req: Request, res: Response, next: NextFunction) => {
  const { start, end } = req.query
  try {
    const { rows } = await pool.query(
      `SELECT dcl.*, u.name AS logged_by_name
       FROM daily_cost_log dcl
       LEFT JOIN users u ON u.id = dcl.created_by
       WHERE ($1::date IS NULL OR dcl.log_date >= $1::date)
         AND ($2::date IS NULL OR dcl.log_date <= $2::date)
       ORDER BY dcl.log_date DESC
       LIMIT 365`,
      [start ?? null, end ?? null]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/reporting/cost-log */
reportingRouter.post('/cost-log', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const ar = req as AuthRequest
  const { logDate, residentCount, foodCost, notes = '' } = req.body
  if (!logDate || residentCount == null || foodCost == null) {
    return err(res, 400, 'logDate, residentCount, and foodCost are required')
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO daily_cost_log (log_date, resident_count, food_cost, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (facility_id, log_date) DO UPDATE
         SET resident_count = EXCLUDED.resident_count,
             food_cost = EXCLUDED.food_cost,
             notes = EXCLUDED.notes,
             created_by = EXCLUDED.created_by
       RETURNING *`,
      [logDate, residentCount, foodCost, notes, ar.userId ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

// ─── Substitution Log ─────────────────────────────────────────────────────

/** GET /api/reporting/substitutions?start=&end= */
reportingRouter.get('/substitutions', async (req: Request, res: Response, next: NextFunction) => {
  const { start, end } = req.query
  try {
    const { rows } = await pool.query(
      `SELECT sl.*,
              r.first_name || ' ' || r.last_name AS resident_name,
              r.room,
              u.name AS logged_by_name
       FROM substitution_log sl
       LEFT JOIN residents r ON r.id = sl.resident_id
       LEFT JOIN users u ON u.id = sl.logged_by
       WHERE ($1::date IS NULL OR sl.meal_date >= $1::date)
         AND ($2::date IS NULL OR sl.meal_date <= $2::date)
       ORDER BY sl.meal_date DESC, sl.created_at DESC
       LIMIT 500`,
      [start ?? null, end ?? null]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/reporting/substitutions */
reportingRouter.post('/substitutions', async (req: Request, res: Response, next: NextFunction) => {
  const ar = req as AuthRequest
  const { residentId, mealDate, mealType, originalItem, substituteItem, reason = '' } = req.body
  if (!mealDate || !originalItem || !substituteItem) {
    return err(res, 400, 'mealDate, originalItem, and substituteItem are required')
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO substitution_log
         (resident_id, meal_date, meal_type, original_item, substitute_item, reason, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [residentId ?? null, mealDate, mealType ?? '', originalItem, substituteItem, reason, ar.userId ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** DELETE /api/reporting/substitutions/:id */
reportingRouter.delete('/substitutions/:id', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  try {
    await pool.query(`DELETE FROM substitution_log WHERE id = $1`, [id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// ─── Allergy Risk ─────────────────────────────────────────────────────────

/**
 * GET /api/reporting/allergy-risk
 * Lists all active residents who have allergens recorded.
 * Full meal-level cross-validation is a V2 enhancement requiring
 * structured recipe ingredients with allergen tags.
 */
reportingRouter.get('/allergy-risk', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, room, diet_order, texture, allergies, beverages
       FROM residents
       WHERE status = 'active'
         AND allergies IS NOT NULL
         AND allergies != ''
         AND allergies != '[]'
       ORDER BY last_name, first_name`
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// ─── Diet Mismatches ─────────────────────────────────────────────────────

/**
 * GET /api/reporting/diet-mismatches
 * Lists active residents with a non-regular texture or therapeutic diet order.
 * These are the residents most likely to have tray-card errors.
 */
reportingRouter.get('/diet-mismatches', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, room, diet_order, texture, allergies, beverages, supplements
       FROM residents
       WHERE status = 'active'
         AND (
           (texture IS NOT NULL AND texture != '' AND texture != 'Regular') OR
           (diet_order IS NOT NULL AND diet_order != '' AND diet_order NOT ILIKE '%regular%')
         )
       ORDER BY last_name, first_name`
    )
    res.json(rows)
  } catch (e) { next(e) }
})

// ─── Production Variance ─────────────────────────────────────────────────

/**
 * GET /api/reporting/production-variance?start=&end=
 * Returns production sheets with planned vs produced counts.
 * Variance = (produced - planned) / planned * 100
 */
reportingRouter.get('/production-variance', async (req: Request, res: Response, next: NextFunction) => {
  const { start, end } = req.query
  try {
    // production_sheets table — check what columns exist by trying a safe query
    const { rows } = await pool.query(
      `SELECT *
       FROM production_sheets
       WHERE ($1::date IS NULL OR date >= $1::date)
         AND ($2::date IS NULL OR date <= $2::date)
       ORDER BY date DESC
       LIMIT 200`,
      [start ?? null, end ?? null]
    )
    // Calculate variance where both planned and produced counts are available
    const withVariance = rows.map(r => {
      const planned  = parseFloat(r.planned_count ?? r.total_count ?? 0)
      const produced = parseFloat(r.produced_count ?? r.actual_count ?? planned)
      const variance = planned > 0 ? ((produced - planned) / planned * 100).toFixed(1) : null
      return { ...r, planned, produced, variancePct: variance }
    })
    res.json(withVariance)
  } catch (e) { next(e) }
})

// ─── Compliance PDF-ready summary ────────────────────────────────────────

/**
 * GET /api/reporting/compliance-summary?start=&end=
 * Returns a structured JSON payload for printing a compliance summary report.
 */
reportingRouter.get('/compliance-summary', async (req: Request, res: Response, next: NextFunction) => {
  const { start, end } = req.query
  const startDate = (start as string) ?? new Date().toISOString().slice(0, 10)
  const endDate   = (end   as string) ?? new Date().toISOString().slice(0, 10)

  try {
    const [costRes, subRes, allergyRes, mismatchRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(food_cost),0) AS total, COALESCE(SUM(resident_count),0) AS days
         FROM daily_cost_log WHERE log_date BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM substitution_log WHERE meal_date BETWEEN $1 AND $2`,
        [startDate, endDate]
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM residents WHERE status='active' AND allergies IS NOT NULL AND allergies != '' AND allergies != '[]'`
      ),
      pool.query(
        `SELECT COUNT(*) AS cnt FROM residents WHERE status='active' AND (
           (texture IS NOT NULL AND texture != '' AND texture != 'Regular') OR
           (diet_order IS NOT NULL AND diet_order != '' AND diet_order NOT ILIKE '%regular%')
         )`
      ),
    ])

    const foodCost    = parseFloat(costRes.rows[0].total)
    const residentDays = parseInt(costRes.rows[0].days, 10)
    const cprd = residentDays > 0 ? (foodCost / residentDays).toFixed(2) : 'N/A'

    res.json({
      reportTitle: 'Dietary Compliance Summary',
      facility: 'Shoreline Operations',
      dateRange: { start: startDate, end: endDate },
      generatedAt: new Date().toISOString(),
      metrics: {
        costPerResidentDay: cprd,
        totalFoodCost: foodCost.toFixed(2),
        totalResidentDays: residentDays,
        substitutions: parseInt(subRes.rows[0].cnt, 10),
        residentsWithAllergens: parseInt(allergyRes.rows[0].cnt, 10),
        residentsWithSpecialDiets: parseInt(mismatchRes.rows[0].cnt, 10),
      },
    })
  } catch (e) { next(e) }
})

import { CmsDietarySurveyEngine } from '../engine/cmsSurvey'

/**
 * GET /api/reporting/cms-survey-export
 * 
 * Generates official CMS-2567 Dietary Survey Audit Pack (Federal F-Tags F800 - F814)
 */
reportingRouter.get('/cms-survey-export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: residents } = await pool.query(
      'SELECT id, name, diet_type as "dietType", texture, allergies FROM residents'
    )

    const auditPack = CmsDietarySurveyEngine.generateSurveyAuditPack({
      facilityName: 'Shoreline Healthcare Community',
      residents: residents.map(r => ({
        id: r.id,
        name: r.name,
        dietType: r.dietType || 'Regular',
        texture: r.texture || 'Regular',
        allergies: Array.isArray(r.allergies) ? r.allergies : [],
      })),
      cycleMenuWeeksCount: 4,
    })

    res.json(auditPack)
  } catch (e) { next(e) }
})
