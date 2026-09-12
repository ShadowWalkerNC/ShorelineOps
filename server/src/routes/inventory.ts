import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'
import { UnitConversionEngine } from '../engine/units'

export const inventoryRouter = Router()

// ── Zod schemas ───────────────────────────────────────────────────────────────

const TX_TYPES = ['receipt', 'issue', 'waste', 'count_adjust'] as const
const COUNT_STATUSES = ['Draft', 'Submitted', 'Approved', 'Discrepancy'] as const

const ItemBodySchema = z.object({
  sku:       z.string().max(64).default(''),
  vendorSku: z.string().max(64).default(''),
  name:      z.string().min(1).max(200),
  category:  z.string().max(64).default('Other'),
  unit:      z.string().min(1).max(32).default('each'),
  parLevel:  z.number().nonnegative().default(0),
  onHand:    z.number().nonnegative().default(0),
  unitCost:  z.number().nonnegative().nullable().optional(),
  vendor:    z.string().max(120).default(''),
  location:  z.string().max(120).default(''),
  notes:     z.string().max(2000).default(''),
})

const ItemPatchSchema = ItemBodySchema.partial().extend({
  adjustmentNote: z.string().max(500).optional(),
})

const TransactionBodySchema = z.object({
  itemId: z.string().uuid().nullable().optional(),
  type:   z.enum(TX_TYPES),
  // qty is a SIGNED delta for count_adjust; a positive magnitude for
  // receipt/issue/waste (the server applies the correct sign).
  qty:    z.number().finite(),
  unit:   z.string().min(1).max(32).default('each'),
  note:   z.string().max(2000).default(''),
})

const CountItemSchema = z.object({
  itemId:   z.string(),
  itemName: z.string(),
  unit:     z.string(),
  expected: z.number(),
  counted:  z.union([z.number(), z.literal('')]),
  variance: z.number(),
  note:     z.string().default(''),
})

const CountBodySchema = z.object({
  countDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submittedById: z.string().max(64).default(''),
  status:       z.enum(COUNT_STATUSES).default('Submitted'),
  items:        z.array(CountItemSchema).default([]),
  notes:        z.string().max(2000).default(''),
  submittedAt:  z.string().optional(),
})

const CountPatchSchema = z.object({
  status:     z.enum(COUNT_STATUSES).optional(),
  approvedBy: z.string().max(64).optional(),
  notes:      z.string().max(2000).optional(),
})

// ── Mappers ───────────────────────────────────────────────────────────────────

/** note column stores small JSON metadata (waste reason/meal/cost, adjustment context). */
function parseNoteMeta(note: unknown): Record<string, any> {
  if (typeof note !== 'string' || !note) return {}
  try {
    const parsed = JSON.parse(note)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return { text: note }
  }
}

function toItem(row: any) {
  return {
    id:        row.id,
    sku:       row.sku ?? '',
    vendorSku: row.vendor_sku ?? '',
    name:      row.name,
    category:  row.category ?? 'Other',
    unit:      row.unit ?? 'each',
    parLevel:  Number(row.par_level ?? 0),
    onHand:    Number(row.on_hand ?? 0),
    unitCost:  row.unit_cost != null ? Number(row.unit_cost) : null,
    vendor:    row.vendor ?? '',
    location:  row.location ?? '',
    notes:     row.notes ?? '',
    active:    !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toTransaction(row: any, itemName?: string) {
  const meta = parseNoteMeta(row.note)
  return {
    id:        row.id,
    itemId:    row.item_id ?? null,
    itemName:  itemName ?? meta.itemName ?? null,
    type:      row.type,
    qty:       Number(row.qty ?? 0),
    unit:      row.unit ?? 'each',
    userId:    row.user_id ?? null,
    note:      meta.text ?? row.note ?? '',
    meta,
    createdAt: row.created_at,
  }
}

function toCount(row: any) {
  // The pool's SQLite read path auto-parses JSON-looking TEXT columns, and
  // PostgreSQL returns JSON natively — so items may already be an array.
  let items: any[] = []
  const raw = row.items
  if (Array.isArray(raw)) {
    items = raw
  } else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) items = parsed
    } catch {
      items = []
    }
  }
  return {
    id:          row.id,
    countDate:   row.count_date,
    submittedById: row.submitted_by ?? '',
    status:      row.status,
    items,
    notes:       row.notes ?? '',
    submittedAt: row.submitted_at ?? null,
    approvedById: row.approved_by ?? '',
    createdAt:   row.created_at,
  }
}

async function audit(req: AuthRequest, action: string, resourceId: string | null, details?: Record<string, any>) {
  await pool.query(
    `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
     VALUES ($1, $2, $3, 'inventory', 'success', $4)`,
    [action, req.userId ?? null, resourceId, details ? JSON.stringify(details) : null]
  )
}

/**
 * Re-read a row by id. The pool's SQLite path drops RETURNING rows
 * (db.run resolves { rows: [] }), so every write does an explicit
 * follow-up SELECT — works identically on PostgreSQL and SQLite.
 */
async function fetchRow(table: string, id: string): Promise<any | null> {
  const { rows } = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id])
  return rows[0] ?? null
}

// ── Stock items ───────────────────────────────────────────────────────────────

// GET /api/inventory/items?search=
inventoryRouter.get('/items', async (req: AuthRequest, res, next) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const { rows } = search
      ? await pool.query(
          `SELECT * FROM inventory_items
           WHERE active = true AND (name LIKE $1 OR category LIKE $1 OR sku LIKE $1)
           ORDER BY name`,
          [`%${search}%`]
        )
      : await pool.query(`SELECT * FROM inventory_items WHERE active = true ORDER BY name`)
    res.json(rows.map(toItem))
  } catch (err) { next(err) }
})

// POST /api/inventory/items
inventoryRouter.post('/items', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ItemBodySchema.parse(req.body)
    const id = randomUUID()
    const unit = UnitConversionEngine.normalizeUnit(data.unit)
    const { rows } = await pool.query(
      `INSERT INTO inventory_items
         (id, sku, vendor_sku, name, category, unit, par_level, on_hand,
          unit_cost, vendor, location, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id, data.sku, data.vendorSku, data.name, data.category, unit,
        data.parLevel, data.onHand, data.unitCost ?? null,
        data.vendor, data.location, data.notes,
      ]
    )
    // Opening stock is itself a ledger transaction so every unit of
    // on-hand is always backed by a transaction row.
    if (data.onHand > 0) {
      await pool.query(
        `INSERT INTO inventory_transactions (id, item_id, type, qty, unit, user_id, note)
         VALUES ($1, $2, 'receipt', $3, $4, $5, $6)`,
        [randomUUID(), id, data.onHand, unit, req.userId ?? null, JSON.stringify({ text: 'Opening stock' })]
      )
    }
    await audit(req, 'CREATE_INVENTORY_ITEM', id, { name: data.name, onHand: data.onHand })
    const created = await fetchRow('inventory_items', id)
    if (!created) return res.status(500).json({ error: 'Failed to read created item' })
    res.status(201).json(toItem(created))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/items/:id
inventoryRouter.patch('/items/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ItemPatchSchema.parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT * FROM inventory_items WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Inventory item not found' })
    const before = existing[0]

    await pool.query(
      `UPDATE inventory_items SET
         sku        = COALESCE($1, sku),
         vendor_sku = COALESCE($2, vendor_sku),
         name       = COALESCE($3, name),
         category   = COALESCE($4, category),
         unit       = COALESCE($5, unit),
         par_level  = COALESCE($6, par_level),
         on_hand    = COALESCE($7, on_hand),
         unit_cost  = COALESCE($8, unit_cost),
         vendor     = COALESCE($9, vendor),
         location   = COALESCE($10, location),
         notes      = COALESCE($11, notes),
         updated_at = NOW()
       WHERE id = $12`,
      [
        data.sku ?? null,
        data.vendorSku ?? null,
        data.name ?? null,
        data.category ?? null,
        data.unit ? UnitConversionEngine.normalizeUnit(data.unit) : null,
        data.parLevel ?? null,
        data.onHand ?? null,
        data.unitCost ?? null,
        data.vendor ?? null,
        data.location ?? null,
        data.notes ?? null,
        req.params.id,
      ]
    )
    const after = await fetchRow('inventory_items', req.params.id)
    if (!after) return res.status(404).json({ error: 'Inventory item not found' })

    // A direct on-hand edit is a stock change: write it as a count_adjust
    // ledger row so the append-only history stays complete.
    const delta = Number(after.on_hand ?? 0) - Number(before.on_hand ?? 0)
    if (delta !== 0) {
      await pool.query(
        `INSERT INTO inventory_transactions (id, item_id, type, qty, unit, user_id, note)
         VALUES ($1, $2, 'count_adjust', $3, $4, $5, $6)`,
        [
          randomUUID(),
          req.params.id,
          delta,
          after.unit ?? 'each',
          req.userId ?? null,
          JSON.stringify({ text: data.adjustmentNote ?? 'Manual stock adjustment' }),
        ]
      )
      await audit(req, 'ADJUST_INVENTORY_STOCK', req.params.id, { delta, unit: after.unit })
    } else {
      await audit(req, 'EDIT_INVENTORY_ITEM', req.params.id, { name: after.name })
    }

    const updated = await fetchRow('inventory_items', req.params.id)
    if (!updated) return res.status(404).json({ error: 'Inventory item not found' })
    res.json(toItem(updated))
  } catch (err) { next(err) }
})

// DELETE /api/inventory/items/:id
inventoryRouter.delete('/items/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    await pool.query(
      `UPDATE inventory_items SET active = false, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    )
    const row = await fetchRow('inventory_items', req.params.id)
    if (!row) return res.status(404).json({ error: 'Inventory item not found' })
    await audit(req, 'DEACTIVATE_INVENTORY_ITEM', req.params.id, { name: row.name })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// ── Append-only transaction ledger ────────────────────────────────────────────

// GET /api/inventory/transactions?itemId=&type=&limit=
inventoryRouter.get('/transactions', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '200'), 10) || 200, 1), 1000)
    const itemId = typeof req.query.itemId === 'string' ? req.query.itemId : null
    const type = typeof req.query.type === 'string' ? req.query.type : null

    const conds: string[] = []
    const params: any[] = []
    if (itemId) { params.push(itemId); conds.push(`t.item_id = $${params.length}`) }
    if (type && (TX_TYPES as readonly string[]).includes(type)) {
      params.push(type); conds.push(`t.type = $${params.length}`)
    }
    params.push(limit)
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT t.*, i.name AS item_name
       FROM inventory_transactions t
       LEFT JOIN inventory_items i ON i.id = t.item_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT $${params.length}`,
      params
    )
    res.json(rows.map((r: any) => toTransaction(r, r.item_name ?? undefined)))
  } catch (err) { next(err) }
})

// POST /api/inventory/transactions — append only; applies the stock movement.
inventoryRouter.post('/transactions', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = TransactionBodySchema.parse(req.body)
    const unit = UnitConversionEngine.normalizeUnit(data.unit)

    // Validate sign rules per type
    if (data.type !== 'count_adjust' && !(data.qty > 0)) {
      return res.status(400).json({ error: 'qty must be a positive amount for receipt/issue/waste transactions' })
    }
    if (data.type === 'count_adjust' && data.qty === 0) {
      return res.status(400).json({ error: 'qty must be non-zero for a count adjustment' })
    }

    let itemName: string | undefined
    if (data.itemId) {
      const { rows } = await pool.query(
        'SELECT id, name, unit, on_hand FROM inventory_items WHERE id = $1 AND active = true',
        [data.itemId]
      )
      if (!rows[0]) return res.status(404).json({ error: 'Inventory item not found' })
      itemName = rows[0].name
    } else if (data.type !== 'waste') {
      return res.status(400).json({ error: 'itemId is required for receipt/issue/count_adjust transactions' })
    }

    // Signed stock delta: receipts add, issues and waste subtract,
    // count_adjust carries its own sign.
    const delta =
      data.type === 'receipt'      ? Math.abs(data.qty)
      : data.type === 'issue'      ? -Math.abs(data.qty)
      : data.type === 'waste'      ? -Math.abs(data.qty)
      : data.qty

    const id = randomUUID()
    await pool.query(
      `INSERT INTO inventory_transactions (id, item_id, type, qty, unit, user_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.itemId ?? null, data.type, data.qty, unit, req.userId ?? null, data.note]
    )

    if (data.itemId) {
      await pool.query(
        `UPDATE inventory_items SET on_hand = on_hand + $1, updated_at = NOW() WHERE id = $2`,
        [delta, data.itemId]
      )
    }

    await audit(req, 'INVENTORY_TRANSACTION', id, {
      type: data.type, qty: data.qty, delta, itemId: data.itemId ?? null,
    })
    const created = await fetchRow('inventory_transactions', id)
    res.status(201).json(toTransaction(created, itemName))
  } catch (err) { next(err) }
})

// ── Count-sheet sessions ──────────────────────────────────────────────────────

// GET /api/inventory/counts?limit=
inventoryRouter.get('/counts', async (req: AuthRequest, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200)
    const { rows } = await pool.query(
      `SELECT * FROM inventory_counts ORDER BY count_date DESC, created_at DESC LIMIT $1`,
      [limit]
    )
    res.json(rows.map(toCount))
  } catch (err) { next(err) }
})

// POST /api/inventory/counts — submit a count sheet; non-zero variances post
// count_adjust ledger rows so on-hand matches the physical count.
inventoryRouter.post('/counts', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = CountBodySchema.parse(req.body)
    const id = randomUUID()

    await pool.query(
      `INSERT INTO inventory_counts
         (id, count_date, submitted_by, status, items, notes, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id,
        data.countDate,
        data.submittedById,
        data.status,
        JSON.stringify(data.items),
        data.notes,
        data.submittedAt ?? new Date().toISOString(),
      ]
    )

    // Post one adjusting transaction per item with a real variance.
    const adjustments: { itemId: string; variance: number }[] = []
    for (const item of data.items) {
      if (!item.itemId || item.variance === 0) continue
      const { rows: found } = await pool.query(
        'SELECT id, unit FROM inventory_items WHERE id = $1 AND active = true',
        [item.itemId]
      )
      if (!found[0]) continue
      const unit = UnitConversionEngine.normalizeUnit(item.unit || found[0].unit || 'each')
      await pool.query(
        `INSERT INTO inventory_transactions (id, item_id, type, qty, unit, user_id, note)
         VALUES ($1, $2, 'count_adjust', $3, $4, $5, $6)`,
        [
          randomUUID(),
          item.itemId,
          item.variance,
          unit,
          req.userId ?? null,
          JSON.stringify({
            text: `Zero-balance count ${data.countDate}: counted ${item.counted}, expected ${item.expected}`,
            countId: id,
            counted: item.counted,
            expected: item.expected,
            itemNote: item.note || undefined,
          }),
        ]
      )
      await pool.query(
        `UPDATE inventory_items SET on_hand = on_hand + $1, updated_at = NOW() WHERE id = $2`,
        [item.variance, item.itemId]
      )
      adjustments.push({ itemId: item.itemId, variance: item.variance })
    }

    await audit(req, 'SUBMIT_INVENTORY_COUNT', id, {
      countDate: data.countDate, status: data.status, adjustments: adjustments.length,
    })
    const created = await fetchRow('inventory_counts', id)
    res.status(201).json(toCount(created))
  } catch (err) { next(err) }
})

// PATCH /api/inventory/counts/:id — approve / resolve a count session
inventoryRouter.patch('/counts/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = CountPatchSchema.parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id FROM inventory_counts WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Count session not found' })

    await pool.query(
      `UPDATE inventory_counts SET
         status      = COALESCE($1, status),
         approved_by = COALESCE($2, approved_by),
         notes       = COALESCE($3, notes),
         updated_at  = NOW()
       WHERE id = $4`,
      [data.status ?? null, data.approvedBy ?? null, data.notes ?? null, req.params.id]
    )
    await audit(req, 'UPDATE_INVENTORY_COUNT', req.params.id, { status: data.status })
    const updated = await fetchRow('inventory_counts', req.params.id)
    res.json(toCount(updated))
  } catch (err) { next(err) }
})

// ── Usage trends (computed from the transaction ledger) ───────────────────────

// GET /api/inventory/trends?days=90
inventoryRouter.get('/trends', async (req: AuthRequest, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? '90'), 10) || 90, 1), 365)
    // SQLite stores created_at as 'YYYY-MM-DD HH:MM:SS' TEXT (see db/pool.ts),
    // so the lower bound must use the same lexical format for the comparison
    // to work on both backends (Postgres parses the literal as a timestamp).
    const since = new Date(Date.now() - days * 86400000).toISOString()
      .replace('T', ' ').slice(0, 19)

    const { rows: txRows } = await pool.query(
      `SELECT type, qty, note FROM inventory_transactions WHERE created_at >= $1`,
      [since]
    )

    const wasteByReason: Record<string, { count: number; cost: number }> = {}
    const wasteByMeal:   Record<string, { count: number; cost: number }> = {}
    let wasteEvents = 0
    let wasteCost = 0
    let receipts = 0
    let issues = 0

    for (const r of txRows) {
      const qty = Number(r.qty ?? 0)
      if (r.type === 'receipt') { receipts += 1; continue }
      if (r.type === 'issue')   { issues   += 1; continue }
      if (r.type !== 'waste') continue
      const meta = parseNoteMeta(r.note)
      const reason = typeof meta.reason === 'string' && meta.reason ? meta.reason : 'Other'
      const meal   = typeof meta.meal   === 'string' && meta.meal   ? meta.meal   : 'N/A'
      const cost   = Number(meta.cost ?? 0) || 0
      wasteByReason[reason] ??= { count: 0, cost: 0 }
      wasteByMeal[meal]     ??= { count: 0, cost: 0 }
      wasteByReason[reason].count += 1
      wasteByReason[reason].cost  += cost
      wasteByMeal[meal].count += 1
      wasteByMeal[meal].cost  += cost
      wasteEvents += 1
      wasteCost   += cost
      void qty
    }

    const { rows: stockRows } = await pool.query(
      `SELECT category, COUNT(*) AS items,
              SUM(CASE WHEN on_hand < par_level AND par_level > 0 THEN 1 ELSE 0 END) AS low,
              SUM(on_hand * COALESCE(unit_cost, 0)) AS value
       FROM inventory_items WHERE active = true GROUP BY category ORDER BY category`
    )

    res.json({
      days,
      wasteEvents,
      wasteCost: Math.round(wasteCost * 100) / 100,
      receipts,
      issues,
      wasteByReason,
      wasteByMeal,
      stockByCategory: stockRows.map((r: any) => ({
        category: r.category,
        items:    Number(r.items ?? 0),
        low:      Number(r.low ?? 0),
        value:    Math.round(Number(r.value ?? 0) * 100) / 100,
      })),
    })
  } catch (err) { next(err) }
})
