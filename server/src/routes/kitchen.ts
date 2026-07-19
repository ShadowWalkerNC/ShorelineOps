import { Router } from 'express'
import { pool } from '../db/pool'

export const kitchenRouter = Router()

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MEALS = ['Lunch', 'Supper']

// ── GET /api/kitchen/orders ──────────────────────────────────────────────────
// Returns residents + their orders for a given week
kitchenRouter.get('/orders', async (req, res, next) => {
  try {
    const { week } = req.query
    if (!week) return res.status(400).json({ error: 'week query param required (YYYY-MM-DD)' })

    // Order residents by room number numerically (cast to integer if possible, else text sort)
    const { rows: residents } = await pool.query(`
      SELECT * FROM residents
      ORDER BY
        CASE
          WHEN room ~ '^[0-9]+$' THEN CAST(room AS INTEGER)
          ELSE 999999
        END,
        room
    `)

    const { rows: orders } = await pool.query(`
      SELECT wo.*, r.room, r.name
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
    `, [week])

    // Build lookup map: residentId -> day -> meal -> order
    const orderMap: Record<string, Record<string, Record<string, any>>> = {}
    for (const o of orders) {
      if (!orderMap[o.resident_id]) orderMap[o.resident_id] = {}
      if (!orderMap[o.resident_id][o.day_of_week]) orderMap[o.resident_id][o.day_of_week] = {}
      orderMap[o.resident_id][o.day_of_week][o.meal_type] = {
        choice_selected: o.choice_selected,
        modifier_text: o.modifier_text,
        is_alternative: o.is_alternative === 1,
        is_declined: o.is_declined === 1
      }
    }

    res.json({ residents, orderMap, week })
  } catch (err) { next(err) }
})

// ── PUT /api/kitchen/orders ──────────────────────────────────────────────────
// Update a single order cell
kitchenRouter.put('/orders', async (req, res, next) => {
  try {
    const {
      resident_id, week_start_date, day_of_week, meal_type,
      choice_selected = null, modifier_text = '',
      is_alternative = 0, is_declined = 0
    } = req.body

    if (!resident_id || !week_start_date || !day_of_week || !meal_type) {
      return res.status(400).json({ error: 'resident_id, week_start_date, day_of_week, meal_type required' })
    }

    await pool.query(`
      INSERT INTO weekly_orders
        (resident_id, week_start_date, day_of_week, meal_type, choice_selected, modifier_text, is_alternative, is_declined)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (resident_id, week_start_date, day_of_week, meal_type)
      DO UPDATE SET
        choice_selected = EXCLUDED.choice_selected,
        modifier_text   = EXCLUDED.modifier_text,
        is_alternative  = EXCLUDED.is_alternative,
        is_declined     = EXCLUDED.is_declined
    `, [
      resident_id, week_start_date, day_of_week, meal_type,
      choice_selected, modifier_text,
      is_alternative ? 1 : 0,
      is_declined ? 1 : 0
    ])

    res.json({ success: true })
  } catch (err) { next(err) }
})

// ── POST /api/kitchen/orders/initialize-week ─────────────────────────────────
// Pre-fill orders for a week with standing alternatives or Choice 1
kitchenRouter.post('/orders/initialize-week', async (req, res, next) => {
  try {
    const { week } = req.body
    if (!week) return res.status(400).json({ error: 'week required (YYYY-MM-DD)' })

    const { rows: residents } = await pool.query('SELECT * FROM residents')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const r of residents) {
        for (const day of DAYS) {
          for (const meal of MEALS) {
            const isAlt = r.has_standing_alternative === 1
            await client.query(`
              INSERT INTO weekly_orders
                (resident_id, week_start_date, day_of_week, meal_type, choice_selected, modifier_text, is_alternative, is_declined)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (resident_id, week_start_date, day_of_week, meal_type) DO NOTHING
            `, [
              r.id, week, day, meal,
              isAlt ? null : 1,
              isAlt ? (r.alternative_description || '') : '',
              isAlt ? 1 : 0,
              0
            ])
          }
        }
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    res.json({ success: true, week, count: residents.length })
  } catch (err) { next(err) }
})

// ── GET /api/kitchen/sheet ───────────────────────────────────────────────────
// Returns daily tallies, exception lists, and standing alternatives
kitchenRouter.get('/sheet', async (req, res, next) => {
  try {
    const { week, day, meal } = req.query
    if (!week || !day || !meal) {
      return res.status(400).json({ error: 'week, day, and meal query params required' })
    }

    // Standard tallies (no alternatives, no declined)
    const { rows: tallyRows } = await pool.query(`
      SELECT choice_selected, COUNT(*) as count
      FROM weekly_orders
      WHERE week_start_date = $1
        AND day_of_week     = $2
        AND meal_type       = $3
        AND is_alternative  = 0
        AND is_declined     = 0
        AND choice_selected IS NOT NULL
      GROUP BY choice_selected
    `, [week, day, meal])

    const tally = { choice1: 0, choice2: 0 }
    for (const row of tallyRows) {
      if (row.choice_selected === 1) tally.choice1 = parseInt(row.count)
      if (row.choice_selected === 2) tally.choice2 = parseInt(row.count)
    }

    // Modifiers / exceptions
    const { rows: modifiers } = await pool.query(`
      SELECT r.room as room_number, r.name, wo.choice_selected, wo.modifier_text
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
        AND wo.day_of_week     = $2
        AND wo.meal_type       = $3
        AND wo.is_alternative  = 0
        AND wo.is_declined     = 0
        AND TRIM(wo.modifier_text) != ''
      ORDER BY
        CASE
          WHEN r.room ~ '^[0-9]+$' THEN CAST(r.room AS INTEGER)
          ELSE 999999
        END,
        r.room
    `, [week, day, meal])

    // Alternatives
    const { rows: alternatives } = await pool.query(`
      SELECT r.room as room_number, r.name, r.alternative_description, wo.modifier_text
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
        AND wo.day_of_week     = $2
        AND wo.meal_type       = $3
        AND wo.is_alternative  = 1
      ORDER BY
        CASE
          WHEN r.room ~ '^[0-9]+$' THEN CAST(r.room AS INTEGER)
          ELSE 999999
        END,
        r.room
    `, [week, day, meal])

    // Declined
    const { rows: declined } = await pool.query(`
      SELECT r.room as room_number, r.name
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
        AND wo.day_of_week     = $2
        AND wo.meal_type       = $3
        AND wo.is_declined     = 1
      ORDER BY
        CASE
          WHEN r.room ~ '^[0-9]+$' THEN CAST(r.room AS INTEGER)
          ELSE 999999
        END,
        r.room
    `, [week, day, meal])

    // Meal options
    const { rows: mealOptions } = await pool.query(`
      SELECT choice_number, dish_name
      FROM meal_options
      WHERE week_start_date = $1 AND day_of_week = $2 AND meal_type = $3
      ORDER BY choice_number
    `, [week, day, meal])

    const { rows: residentCountRow } = await pool.query('SELECT COUNT(*) as n FROM residents')
    const totalResidents = parseInt(residentCountRow[0]?.n || '0')

    const summary = {
      total_standard: tally.choice1 + tally.choice2,
      total_alternatives: alternatives.length,
      total_declined: declined.length,
      total_residents: totalResidents
    }

    res.json({ tally, modifiers, alternatives, declined, mealOptions, summary, week, day, meal })
  } catch (err) { next(err) }
})

// ── GET /api/kitchen/meals ───────────────────────────────────────────────────
kitchenRouter.get('/meals', async (req, res, next) => {
  try {
    const { week, day } = req.query
    if (!week) return res.status(400).json({ error: 'week required (YYYY-MM-DD)' })

    let query = 'SELECT * FROM meal_options WHERE week_start_date = $1'
    const params = [week]

    if (day) {
      query += ' AND day_of_week = $2'
      params.push(day)
    }

    query += ' ORDER BY day_of_week, meal_type, choice_number'
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) { next(err) }
})

// ── POST /api/kitchen/meals/batch ────────────────────────────────────────────
kitchenRouter.post('/meals/batch', async (req, res, next) => {
  try {
    const { options } = req.body
    if (!Array.isArray(options)) return res.status(400).json({ error: 'options array required' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const o of options) {
        await client.query(`
          INSERT INTO meal_options (week_start_date, day_of_week, meal_type, choice_number, dish_name)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (week_start_date, day_of_week, meal_type, choice_number)
          DO UPDATE SET dish_name = EXCLUDED.dish_name
        `, [o.week_start_date, o.day_of_week, o.meal_type, o.choice_number, o.dish_name])
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    res.json({ success: true, count: options.length })
  } catch (err) { next(err) }
})
