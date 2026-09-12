import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'
import { KitchenProductionEngine } from '../engine/production'

export const productionRouter = Router()

// ── Zod schemas ───────────────────────────────────────────────────────────────

const SheetUpdateSchema = z.object({
  rows: z.array(z.any()).optional(),
  counts: z.record(z.string(), z.any()).optional(),
})

// ── Mappers ────────────────────────────────────────────────────────────────────

function toSheet(row: any) {
  return {
    id: row.id,
    menuWeekId: row.menu_week_id,
    day: row.day,
    slot: row.slot,
    rows: row.rows,
    counts: row.counts,
    signedOffBy: row.signed_off_by ?? undefined,
    signedOffAt: row.signed_off_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Auto-generate a ProductionSheet from the REAL forecast (C05):
 * active menu week × active census × meal slot, with the census-trend buffer
 * and Opt1/Opt2 splits from real weekly_orders choices.
 *
 * Each row is one scheduled menu item for the slot: its portions come from
 * (census + buffer) × that item's choice share — never a fixed +5, never a
 * blind 50/50. Texture/diet/location counts are still census-derived for the
 * kitchen's batch-planning context.
 */
async function generateSheet(weekId: string, day: string, slot: string) {
  // 1. Build the scheduled-meals forecast for this exact day × slot.
  const forecast = await KitchenProductionEngine.buildScheduledMeals({
    weekId,
    days: [day],
    slots: [slot],
  })

  // 2. Active census rows for the texture / diet / location breakdowns
  //    (B03: status='Active' only).
  const { rows: residents } = await pool.query(
    `SELECT * FROM residents WHERE status = 'Active' ORDER BY name ASC`
  )

  const absent = await pool.query(
    `SELECT COUNT(*) FROM residents WHERE status IN ('Hospital', 'LOA')`
  )

  const mealType = KitchenProductionEngine.SLOT_TO_MEAL[slot] ?? null
  const choiceSplit = await KitchenProductionEngine.computeChoiceSplit(
    forecast.weekStartDate, day, mealType
  )

  const counts = {
    // Census-derived roster breakdown (unchanged semantics for the kitchen).
    total: residents.length,
    diningRoom: residents.filter((r: any) => r.serving_location === 'Dining Room').length,
    room: residents.filter((r: any) => r.serving_location === 'Room').length,
    assistedLiving: residents.filter((r: any) => r.serving_location === 'Assisted Living').length,
    memoryCare: residents.filter((r: any) => r.serving_location === 'Memory Care').length,
    absent: parseInt(absent.rows[0].count, 10),
    // C05 forecast provenance — the dietitian can explain every number.
    census: forecast.census,
    buffer: forecast.buffer,
    trendPct: forecast.trendPct,
    bufferFormula: forecast.bufferFormula,
    forecastPortionsPerSlot: forecast.forecastPortionsPerSlot,
    choiceSplit,
    weekStartDate: forecast.weekStartDate,
    weekName: forecast.weekName,
  }

  // 3. One production row per scheduled menu item.
  const rows = forecast.meals.map(m => {
    const textureCounts: Record<string, number> = {}
    const dietCounts: Record<string, number> = {}
    const locationCounts: Record<string, number> = {}

    for (const r of residents) {
      textureCounts[r.texture] = (textureCounts[r.texture] ?? 0) + 1
      dietCounts[r.diet_type] = (dietCounts[r.diet_type] ?? 0) + 1
      locationCounts[r.serving_location] = (locationCounts[r.serving_location] ?? 0) + 1
    }

    return {
      menuItemId: m.recipeLink.menuItemId,
      menuItemName: m.recipeLink.menuItemName,
      recipeId: m.recipeLink.recipeId,
      recipeName: m.recipeLink.recipeName,
      textureModified: false,
      textureCounts,
      dietCounts,
      locationCounts,
      // C05: the actual cook number — scheduled menu × census, buffered and
      // choice-split, with its derivation attached.
      total: m.projectedPortions,
      projectedPortions: m.projectedPortions,
      forecastNote: m.forecastNote,
    }
  })

  // Items on the menu with no recipe can't be forecasted — surface them so
  // the kitchen knows why they are absent, rather than silently dropping them.
  const skipped = forecast.skippedItems.map(s => ({ ...s }))

  return { rows, counts, skipped, forecast }
}

// ════════════════════════════════════════════════════════════════════════════
// SHEETS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/production/sheets[?weekId=]
productionRouter.get('/sheets', async (req: AuthRequest, res, next) => {
  try {
    const weekId = typeof req.query.weekId === 'string' ? req.query.weekId : null
    let queryResult
    if (weekId) {
      queryResult = await pool.query(
        'SELECT * FROM production_sheets WHERE menu_week_id = $1 ORDER BY day, slot',
        [weekId]
      )
    } else {
      queryResult = await pool.query(
        'SELECT * FROM production_sheets ORDER BY created_at DESC'
      )
    }
    res.json(queryResult.rows.map(toSheet))
  } catch (err) { next(err) }
})

// GET /api/production/sheets/generate?weekId=&day=&slot=
// Returns an existing sheet or auto-generates one on the fly (does NOT persist).
productionRouter.get('/sheets/generate', async (req: AuthRequest, res, next) => {
  try {
    const weekId = req.query.weekId as string
    const day    = req.query.day    as string
    const slot   = req.query.slot   as string

    if (!weekId || !day || !slot) {
      return res.status(400).json({ error: 'weekId, day, and slot are required' })
    }

    // Check if a saved sheet already exists
    const { rows: existing } = await pool.query(
      'SELECT * FROM production_sheets WHERE menu_week_id = $1 AND day = $2 AND slot = $3',
      [weekId, day, slot]
    )
    if (existing[0]) return res.json(toSheet(existing[0]))

    // Generate on-the-fly
    const { rows, counts } = await generateSheet(weekId, day, slot)

    // Persist generated sheet so subsequent GETs are instant.
    // Portable write (B05 inventory pattern): the pool's SQLite path drops
    // RETURNING rows, so write without RETURNING and re-read the row after.
    await pool.query(
      `INSERT INTO production_sheets (menu_week_id, day, slot, rows, counts)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (menu_week_id, day, slot) DO UPDATE
         SET rows = EXCLUDED.rows, counts = EXCLUDED.counts, updated_at = NOW()`,
      [weekId, day, slot, JSON.stringify(rows), JSON.stringify(counts)]
    )
    const { rows: saved } = await pool.query(
      'SELECT * FROM production_sheets WHERE menu_week_id = $1 AND day = $2 AND slot = $3',
      [weekId, day, slot]
    )
    res.json(toSheet(saved[0]))
  } catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    next(err)
  }
})

// PUT /api/production/sheets/:id
productionRouter.put('/sheets/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = SheetUpdateSchema.parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id FROM production_sheets WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Production sheet not found' })

    // Portable write: the pool's SQLite path drops RETURNING rows
    // (B05 inventory pattern), so re-read the row after the UPDATE.
    await pool.query(
      `UPDATE production_sheets SET
         rows       = COALESCE($1, rows),
         counts     = COALESCE($2, counts),
         updated_at = NOW()
       WHERE id = $3`,
      [
        data.rows   ? JSON.stringify(data.rows)   : null,
        data.counts ? JSON.stringify(data.counts) : null,
        req.params.id,
      ]
    )
    const { rows } = await pool.query(
      'SELECT * FROM production_sheets WHERE id = $1', [req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_PRODUCTION_SHEET', $1, $2, 'production_sheet', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toSheet(rows[0]))
  } catch (err) { next(err) }
})

// POST /api/production/sheets/:id/signoff
productionRouter.post('/sheets/:id/signoff', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const { staffName } = z.object({ staffName: z.string().min(1) }).parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id FROM production_sheets WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Production sheet not found' })

    // Portable write: the pool's SQLite path drops RETURNING rows
    // (B05 inventory pattern), so re-read the row after the UPDATE.
    await pool.query(
      `UPDATE production_sheets SET
         signed_off_by = $1,
         signed_off_at = NOW(),
         updated_at    = NOW()
       WHERE id = $2`,
      [staffName, req.params.id]
    )
    const { rows } = await pool.query(
      'SELECT * FROM production_sheets WHERE id = $1', [req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('SIGNOFF_PRODUCTION_SHEET', $1, $2, 'production_sheet', 'success', $3)`,
      [req.userId, req.params.id, JSON.stringify({ staffName })]
    )
    res.json(toSheet(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/production/sheets/:id
productionRouter.delete('/sheets/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM production_sheets WHERE id = $1', [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Production sheet not found' })
    await pool.query('DELETE FROM production_sheets WHERE id = $1', [req.params.id])
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_PRODUCTION_SHEET', $1, $2, 'production_sheet', 'success')`,
      [req.userId, req.params.id]
    )
    res.status(204).send()
  } catch (err) { next(err) }
})
