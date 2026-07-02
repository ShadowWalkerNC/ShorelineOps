import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

export const residentsRouter = Router()

const ResidentSchema = z.object({
  name: z.string().min(1),
  room: z.string().min(1),
  status: z.enum(['Active', 'Hospital', 'LOA', 'Passed Away']).default('Active'),
  dietType: z.string().default('Regular'),
  texture: z.string().default('Regular'),
  portionSize: z.string().default('Regular'),
  ensurePerDay: z.number().int().min(0).default(0),
  allergies: z.array(z.string()).default([]),
  beverages: z.array(z.string()).default([]),
  birthdayMonth: z.string().optional(),
  birthdayDay: z.number().int().nullable().optional(),
  servingLocation: z.string().default('Dining Room'),
  tableAssignment: z.string().default(''),
  likes: z.string().default(''),
  dislikes: z.string().default(''),
  specialInstructions: z.string().default(''),
})

// Map DB snake_case → frontend camelCase
function toResident(row: any) {
  return {
    id: row.id,
    name: row.name,
    room: row.room,
    status: row.status,
    dietType: row.diet_type,
    texture: row.texture,
    portionSize: row.portion_size,
    ensurePerDay: row.ensure_per_day,
    allergies: row.allergies ?? [],
    beverages: row.beverages ?? [],
    birthdayMonth: row.birthday_month ?? '',
    birthdayDay: row.birthday_day ?? null,
    servingLocation: row.serving_location,
    tableAssignment: row.table_assignment,
    likes: row.likes,
    dislikes: row.dislikes,
    specialInstructions: row.special_instructions,
  }
}

// GET /api/residents
residentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents ORDER BY name ASC')
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('VIEW_RESIDENT', $1, 'resident_list', 'success')`,
      [req.userId]
    )
    res.json(rows.map(toResident))
  } catch (err) { next(err) }
})

// GET /api/residents/:id
residentsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Resident not found' })
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('VIEW_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toResident(rows[0]))
  } catch (err) { next(err) }
})

// POST /api/residents
residentsRouter.post('/', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ResidentSchema.parse(req.body)
    const { rows } = await pool.query(`
      INSERT INTO residents
        (name, room, status, diet_type, texture, portion_size, ensure_per_day,
         allergies, beverages, birthday_month, birthday_day, serving_location,
         table_assignment, likes, dislikes, special_instructions)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [data.name, data.room, data.status, data.dietType, data.texture, data.portionSize,
       data.ensurePerDay, data.allergies, data.beverages, data.birthdayMonth ?? null,
       data.birthdayDay ?? null, data.servingLocation, data.tableAssignment,
       data.likes, data.dislikes, data.specialInstructions]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, rows[0].id]
    )
    res.status(201).json(toResident(rows[0]))
  } catch (err) { next(err) }
})

// PUT /api/residents/:id
residentsRouter.put('/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ResidentSchema.partial().parse(req.body)
    const { rows: existing } = await pool.query('SELECT id FROM residents WHERE id = $1', [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Resident not found' })

    const { rows } = await pool.query(`
      UPDATE residents SET
        name = COALESCE($1, name),
        room = COALESCE($2, room),
        status = COALESCE($3, status),
        diet_type = COALESCE($4, diet_type),
        texture = COALESCE($5, texture),
        portion_size = COALESCE($6, portion_size),
        ensure_per_day = COALESCE($7, ensure_per_day),
        allergies = COALESCE($8, allergies),
        beverages = COALESCE($9, beverages),
        birthday_month = COALESCE($10, birthday_month),
        birthday_day = COALESCE($11, birthday_day),
        serving_location = COALESCE($12, serving_location),
        table_assignment = COALESCE($13, table_assignment),
        likes = COALESCE($14, likes),
        dislikes = COALESCE($15, dislikes),
        special_instructions = COALESCE($16, special_instructions),
        updated_at = NOW()
      WHERE id = $17
      RETURNING *`,
      [data.name, data.room, data.status, data.dietType, data.texture, data.portionSize,
       data.ensurePerDay, data.allergies, data.beverages, data.birthdayMonth,
       data.birthdayDay, data.servingLocation, data.tableAssignment,
       data.likes, data.dislikes, data.specialInstructions, req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toResident(rows[0]))
  } catch (err) { next(err) }
})

// DELETE /api/residents/:id
residentsRouter.delete('/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM residents WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Resident not found' })
    await pool.query('DELETE FROM residents WHERE id = $1', [req.params.id])
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})
