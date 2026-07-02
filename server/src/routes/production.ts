import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

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
 * Auto-generate a ProductionSheet by joining the active menu week
 * against current resident dietary data.
 */
async function generateSheet(weekId: string, day: string, slot: string) {
  // 1. Fetch the menu week
  const { rows: weekRows } = await pool.query(
    'SELECT * FROM menu_weeks WHERE id = $1', [weekId]
  )
  if (!weekRows[0]) throw Object.assign(new Error('Menu week not found'), { status: 404 })

  const week = weekRows[0]
  const dayMenu = week.days?.[day]
  const mealEntry = dayMenu?.[slot]
  const itemIds: string[] = mealEntry?.itemIds ?? []

  // 2. Fetch menu items for this slot
  let menuItems: any[] = []
  if (itemIds.length > 0) {
    const placeholders = itemIds.map((_: any, i: number) => `$${i + 1}`).join(',')
    const { rows } = await pool.query(
      `SELECT * FROM menu_items WHERE id IN (${placeholders})`, itemIds
    )
    menuItems = rows
  }

  // 3. Fetch active residents
  const { rows: residents } = await pool.query(
    `SELECT * FROM residents WHERE status = 'Active' ORDER BY name ASC`
  )

  // 4. Build counts summary
  const absent = await pool.query(
    `SELECT COUNT(*) FROM residents WHERE status IN ('Hospital', 'LOA')`
  )

  const counts = {
    total: residents.length,
    diningRoom: residents.filter((r: any) => r.serving_location === 'Dining Room').length,
    room: residents.filter((r: any) => r.serving_location === 'Room').length,
    assistedLiving: residents.filter((r: any) => r.serving_location === 'Assisted Living').length,
    memoryCare: residents.filter((r: any) => r.serving_location === 'Memory Care').length,
    absent: parseInt(absent.rows[0].count, 10),
  }

  // 5. Build production rows — one row per menu item
  const rows = menuItems.map((item: any) => {
    // Residents who would receive this item (all active residents get all items by default)
    const applicable = residents

    const textureCounts: Record<string, number> = {}
    const dietCounts: Record<string, number> = {}
    const locationCounts: Record<string, number> = {}

    for (const r of applicable) {
      textureCounts[r.texture] = (textureCounts[r.texture] ?? 0) + 1
      dietCounts[r.diet_type] = (dietCounts[r.diet_type] ?? 0) + 1
      locationCounts[r.serving_location] = (locationCounts[r.serving_location] ?? 0) + 1
    }

    return {
      menuItemId: item.id,
      menuItemName: item.name,
      textureModified: item.texture_modified,
      textureCounts,
      dietCounts,
      locationCounts,
      total: applicable.length,
    }
  })

  return { rows, counts }
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

    // Persist generated sheet so subsequent GETs are instant
    const { rows: saved } = await pool.query(
      `INSERT INTO production_sheets (menu_week_id, day, slot, rows, counts)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (menu_week_id, day, slot) DO UPDATE
         SET rows = EXCLUDED.rows, counts = EXCLUDED.counts, updated_at = NOW()
       RETURNING *`,
      [weekId, day, slot, JSON.stringify(rows), JSON.stringify(counts)]
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

    const { rows } = await pool.query(
      `UPDATE production_sheets SET
         rows       = COALESCE($1, rows),
         counts     = COALESCE($2, counts),
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [
        data.rows   ? JSON.stringify(data.rows)   : null,
        data.counts ? JSON.stringify(data.counts) : null,
        req.params.id,
      ]
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

    const { rows } = await pool.query(
      `UPDATE production_sheets SET
         signed_off_by = $1,
         signed_off_at = NOW(),
         updated_at    = NOW()
       WHERE id = $2 RETURNING *`,
      [staffName, req.params.id]
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
