import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

export const menuRouter = Router()

// ── Zod schemas ───────────────────────────────────────────────────────────────

const MealEntrySchema = z.object({
  itemIds: z.array(z.string()).default([]),
  label: z.string().optional(),
})

const MEAL_SLOTS = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'] as const
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const DayMenuSchema = z.object(
  Object.fromEntries(MEAL_SLOTS.map(s => [s, MealEntrySchema])) as
    Record<typeof MEAL_SLOTS[number], typeof MealEntrySchema>
)

const WeekBodySchema = z.object({
  name: z.string().min(1),
  effectiveFrom: z.string().optional(),
  active: z.boolean().default(false),
  days: z.record(z.string(), DayMenuSchema).default({}),
})

const ItemBodySchema = z.object({
  name: z.string().min(1),
  notes: z.string().default(''),
  textureModified: z.boolean().default(false),
})

// ── Mappers ────────────────────────────────────────────────────────────────────

function toWeek(row: any) {
  return {
    id: row.id,
    name: row.name,
    effectiveFrom: row.effective_from ?? undefined,
    days: row.days,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toItem(row: any) {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes || undefined,
    textureModified: row.texture_modified,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// WEEKS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/menu/weeks
menuRouter.get('/weeks', async (_req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM menu_weeks ORDER BY created_at DESC')
    res.json(rows.map(toWeek))
  } catch (err) { next(err) }
})

// GET /api/menu/weeks/:id
menuRouter.get('/weeks/:id', async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM menu_weeks WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Menu week not found' })
    res.json(toWeek(rows[0]))
  } catch (err) { next(err) }
})

// POST /api/menu/weeks
menuRouter.post('/weeks', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = WeekBodySchema.parse(req.body)
    const { rows } = await pool.query(
      `INSERT INTO menu_weeks (name, effective_from, days, active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.name, data.effectiveFrom ?? null, JSON.stringify(data.days), data.active]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_MENU_WEEK', $1, $2, 'menu_week', 'success')`,
      [req.userId, rows[0].id]
    )
    res.status(201).json(toWeek(rows[0]))
  } catch (err) { next(err) }
})

// PUT /api/menu/weeks/:id
menuRouter.put('/weeks/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = WeekBodySchema.partial().parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id FROM menu_weeks WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Menu week not found' })

    const { rows } = await pool.query(
      `UPDATE menu_weeks SET
         name           = COALESCE($1, name),
         effective_from = COALESCE($2, effective_from),
         days           = COALESCE($3, days),
         active         = COALESCE($4, active),
         updated_at     = NOW()
       WHERE id = $5 RETURNING *`,
      [
        data.name ?? null,
        data.effectiveFrom ?? null,
        data.days ? JSON.stringify(data.days) : null,
        data.active ?? null,
        req.params.id,
      ]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_MENU_WEEK', $1, $2, 'menu_week', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toWeek(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/menu/weeks/:id
menuRouter.delete('/weeks/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM menu_weeks WHERE id = $1', [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Menu week not found' })
    await pool.query('DELETE FROM menu_weeks WHERE id = $1', [req.params.id])
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_MENU_WEEK', $1, $2, 'menu_week', 'success')`,
      [req.userId, req.params.id]
    )
    res.status(204).send()
  } catch (err) { next(err) }
})

// POST /api/menu/weeks/:id/activate
// Atomically marks one week active and deactivates all others.
menuRouter.post('/weeks/:id/activate', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM menu_weeks WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Menu week not found' })

    await pool.query('UPDATE menu_weeks SET active = false, updated_at = NOW()')
    const { rows } = await pool.query(
      'UPDATE menu_weeks SET active = true, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('ACTIVATE_MENU_WEEK', $1, $2, 'menu_week', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toWeek(rows[0]))
  } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
// ITEMS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/menu/items
menuRouter.get('/items', async (_req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM menu_items ORDER BY name ASC')
    res.json(rows.map(toItem))
  } catch (err) { next(err) }
})

// POST /api/menu/items
menuRouter.post('/items', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ItemBodySchema.parse(req.body)
    const { rows } = await pool.query(
      `INSERT INTO menu_items (name, notes, texture_modified)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.name, data.notes, data.textureModified]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_MENU_ITEM', $1, $2, 'menu_item', 'success')`,
      [req.userId, rows[0].id]
    )
    res.status(201).json(toItem(rows[0]))
  } catch (err) { next(err) }
})

// PUT /api/menu/items/:id
menuRouter.put('/items/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ItemBodySchema.partial().parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id FROM menu_items WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Menu item not found' })

    const { rows } = await pool.query(
      `UPDATE menu_items SET
         name             = COALESCE($1, name),
         notes            = COALESCE($2, notes),
         texture_modified = COALESCE($3, texture_modified),
         updated_at       = NOW()
       WHERE id = $4 RETURNING *`,
      [data.name ?? null, data.notes ?? null, data.textureModified ?? null, req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_MENU_ITEM', $1, $2, 'menu_item', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toItem(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/menu/items/:id
menuRouter.delete('/items/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM menu_items WHERE id = $1', [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Menu item not found' })
    await pool.query('DELETE FROM menu_items WHERE id = $1', [req.params.id])
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_MENU_ITEM', $1, $2, 'menu_item', 'success')`,
      [req.userId, req.params.id]
    )
    res.status(204).send()
  } catch (err) { next(err) }
})
