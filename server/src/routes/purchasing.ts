/**
 * Purchasing API — Shoreline V1
 *
 * Distributor-agnostic purchasing and order guide module.
 * Dennis Food Service is the first example vendor (seeded in migration 010).
 *
 * Routes:
 *   GET    /api/purchasing/vendors
 *   POST   /api/purchasing/vendors
 *   PUT    /api/purchasing/vendors/:id
 *
 *   GET    /api/purchasing/items?vendorId=
 *   POST   /api/purchasing/items
 *   PUT    /api/purchasing/items/:id
 *   DELETE /api/purchasing/items/:id
 *
 *   GET    /api/purchasing/order-guide?vendorId=
 *   PUT    /api/purchasing/order-guide/:id   (update par/on-hand)
 *   POST   /api/purchasing/order-guide        (add entry)
 *   DELETE /api/purchasing/order-guide/:id
 *
 *   POST   /api/purchasing/suggested-order    (generate suggested PO from order guide)
 *
 *   GET    /api/purchasing/orders
 *   POST   /api/purchasing/orders             (always creates status='draft')
 *   GET    /api/purchasing/orders/:id
 *   PUT    /api/purchasing/orders/:id
 *   DELETE /api/purchasing/orders/:id
 *   POST   /api/purchasing/orders/:id/approve (manager: draft → approved, audit-logged)
 *   POST   /api/purchasing/orders/:id/submit  (approved → submitted, audit-logged)
 *
 *   GET    /api/purchasing/orders/:id/lines
 *   POST   /api/purchasing/orders/:id/lines
 *   PUT    /api/purchasing/orders/:id/lines/:lineId
 *   DELETE /api/purchasing/orders/:id/lines/:lineId
 *
 *   GET    /api/purchasing/orders/:id/export-csv   (CSV download)
 */
import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'
import { requireTier } from '../middleware/requireTier'
import { MrpDemandForecastEngine, InventoryItemStock } from '../engine/mrp'
import { KitchenProductionEngine } from '../engine/production'
import { rollupAvgUsage } from '../jobs/nightlyForecast'
import { UnitConversionEngine, MASS_TO_GRAMS, VOLUME_TO_ML } from '../engine/units'
import { ThreeWayInvoiceMatchingEngine } from '../engine/invoicing'

export const purchasingRouter = Router()

// ─── Helper ──────────────────────────────────────────────────────────────────
function err(res: Response, status: number, msg: string) {
  return res.status(status).json({ error: msg })
}

// ═══════════════════════════════════════════════════════════════════════════
// VENDORS
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/purchasing/vendors */
purchasingRouter.get('/vendors', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM vendors ORDER BY name ASC`
    )
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/purchasing/vendors */
purchasingRouter.post('/vendors', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { name, code, phone = '', email = '', website = '', notes = '' } = req.body
  if (!name || !code) return err(res, 400, 'name and code are required')
  try {
    const { rows } = await pool.query(
      `INSERT INTO vendors (name, code, phone, email, website, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, code.toLowerCase().replace(/\s+/g, '-'), phone, email, website, notes]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** PUT /api/purchasing/vendors/:id */
purchasingRouter.put('/vendors/:id', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { name, phone, email, website, notes, active } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE vendors SET
         name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         email = COALESCE($3, email),
         website = COALESCE($4, website),
         notes = COALESCE($5, notes),
         active = COALESCE($6, active),
         updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, phone, email, website, notes, active, id]
    )
    if (!rows.length) return err(res, 404, 'Vendor not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// VENDOR ITEMS (catalog)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/purchasing/items?vendorId= */
purchasingRouter.get('/items', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId } = req.query
  try {
    const { rows } = await pool.query(
      `SELECT vi.*, v.name AS vendor_name, v.code AS vendor_code
       FROM vendor_items vi
       JOIN vendors v ON v.id = vi.vendor_id
       WHERE ($1::uuid IS NULL OR vi.vendor_id = $1)
         AND vi.active = true
       ORDER BY vi.category, vi.name`,
      [vendorId || null]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/purchasing/items */
purchasingRouter.post('/items', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId, vendorSku, name, brand = '', packSize = '', uom = 'case', category = '', unitCost = 0 } = req.body
  if (!vendorId || !vendorSku || !name) return err(res, 400, 'vendorId, vendorSku, and name are required')
  try {
    const { rows } = await pool.query(
      `INSERT INTO vendor_items (vendor_id, vendor_sku, name, brand, pack_size, uom, category, unit_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [vendorId, vendorSku, name, brand, packSize, uom, category, unitCost]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** PUT /api/purchasing/items/:id */
purchasingRouter.put('/items/:id', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { name, brand, packSize, uom, category, unitCost, active } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE vendor_items SET
         name = COALESCE($1, name),
         brand = COALESCE($2, brand),
         pack_size = COALESCE($3, pack_size),
         uom = COALESCE($4, uom),
         category = COALESCE($5, category),
         unit_cost = COALESCE($6, unit_cost),
         active = COALESCE($7, active),
         updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [name, brand, packSize, uom, category, unitCost, active, id]
    )
    if (!rows.length) return err(res, 404, 'Item not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})

/** DELETE /api/purchasing/items/:id (soft delete) */
purchasingRouter.delete('/items/:id', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  try {
    await pool.query(`UPDATE vendor_items SET active = false, updated_at = NOW() WHERE id = $1`, [id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// ORDER GUIDE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/purchasing/order-guide?vendorId= */
purchasingRouter.get('/order-guide', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId } = req.query
  try {
    const { rows } = await pool.query(
      `SELECT og.*,
              vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom, vi.unit_cost, vi.category,
              v.name  AS vendor_name, v.code AS vendor_code
       FROM order_guides og
       JOIN vendor_items vi ON vi.id = og.vendor_item_id
       JOIN vendors v ON v.id = og.vendor_id
       WHERE ($1::uuid IS NULL OR og.vendor_id = $1)
       ORDER BY og.sort_group, vi.category, vi.name`,
      [vendorId || null]
    )
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/purchasing/order-guide */
purchasingRouter.post('/order-guide', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId, vendorItemId, parLevel = 0, onHand = 0, avgUsage, sortGroup = '' } = req.body
  if (!vendorId || !vendorItemId) return err(res, 400, 'vendorId and vendorItemId required')
  try {
    const { rows } = await pool.query(
      `INSERT INTO order_guides (vendor_id, vendor_item_id, par_level, on_hand, avg_usage, sort_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (facility_id, vendor_item_id) DO UPDATE
         SET par_level = EXCLUDED.par_level,
             on_hand = EXCLUDED.on_hand,
             avg_usage = EXCLUDED.avg_usage,
             sort_group = EXCLUDED.sort_group,
             updated_at = NOW()
       RETURNING *`,
      [vendorId, vendorItemId, parLevel, onHand, avgUsage ?? null, sortGroup]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** PUT /api/purchasing/order-guide/:id */
purchasingRouter.put('/order-guide/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { parLevel, onHand, avgUsage, sortGroup } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE order_guides SET
         par_level = COALESCE($1, par_level),
         on_hand = COALESCE($2, on_hand),
         avg_usage = COALESCE($3, avg_usage),
         sort_group = COALESCE($4, sort_group),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [parLevel, onHand, avgUsage, sortGroup, id]
    )
    if (!rows.length) return err(res, 404, 'Order guide entry not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})

/** DELETE /api/purchasing/order-guide/:id */
purchasingRouter.delete('/order-guide/:id', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  try {
    await pool.query(`DELETE FROM order_guides WHERE id = $1`, [id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

/**
 * POST /api/purchasing/import-guide
 * Batch imports Dennis / vendor catalog items and syncs order guide par levels
 */
purchasingRouter.post('/import-guide', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId, items = [] } = req.body
  if (!vendorId || !Array.isArray(items)) return err(res, 400, 'vendorId and items array required')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let importedCount = 0

    for (const item of items) {
      if (!item.vendorSku || !item.name) continue

      // Upsert vendor item into catalog
      const { rows: [vItem] } = await client.query(
        `INSERT INTO vendor_items (vendor_id, vendor_sku, name, brand, pack_size, uom, category, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (vendor_id, vendor_sku) DO UPDATE
           SET name = EXCLUDED.name,
               brand = EXCLUDED.brand,
               pack_size = EXCLUDED.pack_size,
               uom = EXCLUDED.uom,
               category = EXCLUDED.category,
               unit_cost = EXCLUDED.unit_cost,
               updated_at = NOW()
         RETURNING id`,
        [
          vendorId,
          item.vendorSku,
          item.name,
          item.brand || '',
          item.packSize || '',
          item.uom || 'case',
          item.category || '',
          item.unitCost || 0
        ]
      )

      // Upsert into order guide
      if (vItem) {
        await client.query(
          `INSERT INTO order_guides (vendor_id, vendor_item_id, par_level, on_hand, sort_group)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (facility_id, vendor_item_id) DO UPDATE
             SET par_level = EXCLUDED.par_level,
                 on_hand = EXCLUDED.on_hand,
                 updated_at = NOW()`,
          [
            vendorId,
            vItem.id,
            item.parLevel ?? 5,
            item.onHand ?? 0,
            item.category || ''
          ]
        )
        importedCount++
      }
    }

    await client.query('COMMIT')
    res.json({ ok: true, importedCount })
  } catch (e) {
    await client.query('ROLLBACK')
    next(e)
  } finally {
    client.release()
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SUGGESTED ORDER
// ═══════════════════════════════════════════════════════════════════════════

import { DietaryDemandEngine } from '../integrations/dietaryDemand'
const demandEngine = new DietaryDemandEngine()

/**
 * POST /api/purchasing/suggested-order
 * Generates a suggested purchase order from the order guide.
 * Items where on_hand < par_level are included; qty = ceil(par_level - on_hand).
 */
purchasingRouter.post('/suggested-order', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId } = req.body
  if (!vendorId) return err(res, 400, 'vendorId required')
  try {
    const { rows } = await pool.query(
      `SELECT og.*,
              vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom, vi.unit_cost, vi.category,
              v.name  AS vendor_name
       FROM order_guides og
       JOIN vendor_items vi ON vi.id = og.vendor_item_id
       JOIN vendors v ON v.id = og.vendor_id
       WHERE og.vendor_id = $1
         AND og.on_hand < og.par_level
       ORDER BY vi.category, vi.name`,
      [vendorId]
    )
    const lines = rows.map(r => ({
      vendorItemId: r.vendor_item_id,
      vendorSku:    r.vendor_sku,
      itemName:     r.item_name,
      vendor:       r.vendor_name,
      packSize:     r.pack_size,
      uom:          r.uom,
      unitCost:     parseFloat(r.unit_cost ?? 0),
      parLevel:     parseFloat(r.par_level),
      onHand:       parseFloat(r.on_hand),
      suggestedQty: Math.ceil(parseFloat(r.par_level) - parseFloat(r.on_hand)),
      category:     r.category,
    }))
    res.json({ vendorId, lines, generatedAt: new Date().toISOString() })
  } catch (e) { next(e) }
})

/**
 * POST /api/purchasing/clinical-suggested-order
 * Dynamic clinical ordering: Combines live resident census, texture requirements (puree/thickener),
 * and special diet ratios (NAS/NCS) to produce clinically optimized order recommendations.
 */
purchasingRouter.post('/clinical-suggested-order', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId } = req.body
  if (!vendorId) return err(res, 400, 'vendorId required')
  try {
    // 1. Fetch live active resident profiles
    const { rows: residentRows } = await pool.query(
      `SELECT status, diet_type AS "dietType", texture, allergies, beverages FROM residents WHERE status = 'Active'`
    )
    const census = demandEngine.calculateCensusMetrics(residentRows)

    // 2. Fetch vendor items and order guide pars
    const { rows: guideRows } = await pool.query(
      `SELECT og.*,
              vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom, vi.unit_cost, vi.category,
              v.name  AS vendor_name
       FROM order_guides og
       JOIN vendor_items vi ON vi.id = og.vendor_item_id
       JOIN vendors v ON v.id = og.vendor_id
       WHERE og.vendor_id = $1
       ORDER BY vi.category, vi.name`,
      [vendorId]
    )

    const guideItems = guideRows.map(r => ({
      vendorSku: r.vendor_sku,
      itemName: r.item_name,
      category: r.category || '',
      unitCost: parseFloat(r.unit_cost ?? 0),
      parLevel: parseFloat(r.par_level ?? 0),
      onHand: parseFloat(r.on_hand ?? 0),
      packSize: r.pack_size || '',
      uom: r.uom || 'case',
    }))

    const lines = demandEngine.calculateClinicalDemandOrder(census, guideItems)

    res.json({
      vendorId,
      census,
      generatedAt: new Date().toISOString(),
      recommendedLines: lines.filter(l => l.calculatedReorderQty > 0),
    })
  } catch (e) { next(e) }
})

/**
 * POST /api/purchasing/mrp-order
 * Full Multi-Level MRP & Bill of Materials (BOM) Explosion:
 * Explodes active cycle menu recipes across resident census headcounts,
 * projects inventory depletion, and calculates exact distributor case-pack purchase orders.
 */
purchasingRouter.post('/mrp-order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { vendorId } = req.body

    // 1. Real forecast: active menu week × active census × meal slots, with
    //    the census-trend buffer and Opt1/Opt2 choice splits (C05). Replaces the
    //    hardcoded "Monday / lunchOpt1Meat" prototype scheduling — every recipe
    //    is now placed on its real day/slot with real forecasted portions.
    const forecast = await KitchenProductionEngine.buildScheduledMeals()

    // 2. Explode BOM — the purchasing engines' ordering logic is untouched;
    //    only their demand input is now the real scheduled-meals forecast.
    const exploded = MrpDemandForecastEngine.explodeBillOfMaterials(forecast.meals)

    // 4. Fetch vendor inventory and order guide stock
    const { rows: guideRows } = await pool.query(`
      SELECT og.*, vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom, vi.unit_cost, vi.category, v.name AS vendor_name
      FROM order_guides og
      JOIN vendor_items vi ON vi.id = og.vendor_item_id
      JOIN vendors v ON v.id = og.vendor_id
      WHERE ($1::uuid IS NULL OR og.vendor_id = $1)
    `, [vendorId || null])

    const stockItems: InventoryItemStock[] = guideRows.map(g => ({
      vendorSku: g.vendor_sku,
      itemName: g.item_name,
      category: g.category || 'Dry Goods',
      onHandGrams: parseFloat(g.on_hand || 0) * 453.592, // convert lbs to grams
      parLevelGrams: parseFloat(g.par_level || 5) * 453.592,
      packSizeDesc: g.pack_size || 'Case',
      packUnitGrams: 453.592 * 10, // ~10 lbs per case
      unitCostPerPack: parseFloat(g.unit_cost || 35),
      vendorName: g.vendor_name,
    }))

    const recommendations = MrpDemandForecastEngine.calculateMaterialRequirements(exploded, stockItems)

    res.json({
      activeResidentHeadcount: forecast.census,
      censusBuffer: forecast.buffer,
      trendPct: forecast.trendPct,
      bufferFormula: forecast.bufferFormula,
      forecastWeek: { id: forecast.weekId, name: forecast.weekName, weekStartDate: forecast.weekStartDate },
      scheduledMeals: forecast.meals.length,
      skippedItems: forecast.skippedItems,
      totalExplodedIngredients: Object.keys(exploded).length,
      explodedDemands: exploded,
      purchaseOrderRecommendations: recommendations,
      generatedAt: new Date().toISOString(),
    })
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/purchasing/rollup-usage (C05)
 * Manually trigger the nightly avg_usage rollup (same function the nightly
 * daemon runs): trailing-28-day average daily consumption per order-guide
 * line, from inventory_transactions issues + waste. See the formula doc in
 * server/src/jobs/nightlyForecast.ts.
 */
purchasingRouter.post('/rollup-usage', requireRole('staff'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await rollupAvgUsage()
    res.json(result)
  } catch (e) { next(e) }
})

/** GET /api/purchasing/orders */
purchasingRouter.get('/orders', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(
      `SELECT po.*, v.name AS vendor_name, v.code AS vendor_code,
              u.name AS created_by_name
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       LEFT JOIN users u ON u.id = po.created_by
       ORDER BY po.order_date DESC, po.created_at DESC
       LIMIT 200`
    )
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/purchasing/orders — always created as a draft; approval moves it forward */
purchasingRouter.post('/orders', requireRole('staff'), async (req: Request, res: Response, next: NextFunction) => {
  const ar = req as AuthRequest
  const { vendorId, orderDate, expectedDate, notes = '', lines = [] } = req.body
  if (!vendorId) return err(res, 400, 'vendorId required')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [order] } = await client.query(
      `INSERT INTO purchase_orders (vendor_id, order_date, expected_date, notes, created_by, status)
       VALUES ($1, $2, $3, $4, $5, 'draft')
       RETURNING *`,
      [vendorId, orderDate ?? new Date().toISOString().slice(0, 10), expectedDate ?? null, notes, ar.userId ?? null]
    )
    for (const line of lines as Array<{ vendorItemId: string; qtyOrdered: number; unitCost?: number; notes?: string }>) {
      await client.query(
        `INSERT INTO purchase_order_lines (purchase_order_id, vendor_item_id, qty_ordered, unit_cost, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, line.vendorItemId, line.qtyOrdered, line.unitCost ?? null, line.notes ?? '']
      )
    }
    await client.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('PO_CREATE', $1, $2, 'purchase_order', 'success', $3)`,
      [ar.userId ?? null, order.id, JSON.stringify({ vendorId, lineCount: (lines as any[]).length })]
    )
    await client.query('COMMIT')
    res.status(201).json(order)
  } catch (e) {
    await client.query('ROLLBACK')
    next(e)
  } finally {
    client.release()
  }
})

/** GET /api/purchasing/orders/:id */
purchasingRouter.get('/orders/:id', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  try {
    const { rows: [order] } = await pool.query(
      `SELECT po.*, v.name AS vendor_name, v.code AS vendor_code
       FROM purchase_orders po
       JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1`,
      [id]
    )
    if (!order) return err(res, 404, 'Order not found')
    const { rows: lines } = await pool.query(
      `SELECT pol.*, vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom,
              (SELECT og.id      FROM order_guides og WHERE og.vendor_item_id = pol.vendor_item_id LIMIT 1) AS guide_id,
              (SELECT og.on_hand FROM order_guides og WHERE og.vendor_item_id = pol.vendor_item_id LIMIT 1) AS guide_on_hand
       FROM purchase_order_lines pol
       JOIN vendor_items vi ON vi.id = pol.vendor_item_id
       WHERE pol.purchase_order_id = $1
       ORDER BY vi.category, vi.name`,
      [id]
    )
    res.json({ ...order, lines })
  } catch (e) { next(e) }
})

/** PUT /api/purchasing/orders/:id */
purchasingRouter.put('/orders/:id', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { status, expectedDate, notes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE purchase_orders SET
         status = COALESCE($1, status),
         expected_date = COALESCE($2, expected_date),
         notes = COALESCE($3, notes),
         updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, expectedDate, notes, id]
    )
    if (!rows.length) return err(res, 404, 'Order not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})

/** DELETE /api/purchasing/orders/:id */
purchasingRouter.delete('/orders/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  try {
    await pool.query(`UPDATE purchase_orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [id])
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// ─── PO approval workflow (B11) ──────────────────────────────────────────────
// Replaces the old TruckOrdersTab comms-store routing (staff-2 hardcode):
// draft → manager approves → approved → submitted. Transitions are
// server-enforced and audit-logged; approval requires the manager role.

/** Return the PO or null. */
async function findOrder(client: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }, id: string) {
  const { rows: [order] } = await client.query(`SELECT * FROM purchase_orders WHERE id = $1`, [id])
  return order ?? null
}

/**
 * POST /api/purchasing/orders/:id/approve
 * Manager-only: draft → approved. Any other current status → 409.
 * Audit-logged with the approving manager's identity, in the same
 * transaction as the status change (fail closed: no audit row, no move).
 *
 * Note: the SQLite write path returns no rows, so the transition is verified
 * with a re-read rather than RETURNING (B10 fail-closed pattern).
 */
purchasingRouter.post('/orders/:id/approve', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const ar = req as AuthRequest
  const { id } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const order = await findOrder(client, id)
    if (!order) {
      await client.query('ROLLBACK')
      return err(res, 404, 'Order not found')
    }
    if (order.status !== 'draft') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Only draft orders can be approved (current status: ${order.status})` })
    }
    await client.query(
      `UPDATE purchase_orders SET status = 'approved', updated_at = NOW()
       WHERE id = $1 AND status = 'draft'`,
      [id]
    )
    const moved = await findOrder(client, id)
    if (!moved || moved.status !== 'approved') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Order status changed concurrently — reload and retry' })
    }
    await client.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('PO_APPROVE', $1, $2, 'purchase_order', 'success', $3)`,
      [ar.userId ?? null, id, JSON.stringify({ from: 'draft', to: 'approved', vendorId: order.vendor_id })]
    )
    await client.query('COMMIT')
    res.json(moved)
  } catch (e) {
    await client.query('ROLLBACK')
    next(e)
  } finally {
    client.release()
  }
})

/**
 * POST /api/purchasing/orders/:id/submit
 * Marks an approved PO as submitted to the vendor. approved → submitted only;
 * anything else → 409. Audit-logged in the same transaction.
 */
purchasingRouter.post('/orders/:id/submit', requireRole('staff'), async (req: Request, res: Response, next: NextFunction) => {
  const ar = req as AuthRequest
  const { id } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const order = await findOrder(client, id)
    if (!order) {
      await client.query('ROLLBACK')
      return err(res, 404, 'Order not found')
    }
    if (order.status !== 'approved') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: `Only approved orders can be submitted (current status: ${order.status})` })
    }
    await client.query(
      `UPDATE purchase_orders SET status = 'submitted', updated_at = NOW()
       WHERE id = $1 AND status = 'approved'`,
      [id]
    )
    const moved = await findOrder(client, id)
    if (!moved || moved.status !== 'submitted') {
      await client.query('ROLLBACK')
      return res.status(409).json({ error: 'Order status changed concurrently — reload and retry' })
    }
    await client.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('PO_SUBMIT', $1, $2, 'purchase_order', 'success', $3)`,
      [ar.userId ?? null, id, JSON.stringify({ from: 'approved', to: 'submitted', vendorId: order.vendor_id })]
    )
    await client.query('COMMIT')
    res.json(moved)
  } catch (e) {
    await client.query('ROLLBACK')
    next(e)
  } finally {
    client.release()
  }
})

// ─── Order lines ──────────────────────────────────────────────────────────

/** POST /api/purchasing/orders/:id/lines */
purchasingRouter.post('/orders/:id/lines', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { vendorItemId, qtyOrdered, unitCost, notes = '' } = req.body
  if (!vendorItemId || qtyOrdered == null) return err(res, 400, 'vendorItemId and qtyOrdered required')
  try {
    // F5: lines change only while the parent order is a mutable draft.
    const { rows: [order] } = await pool.query('SELECT id, status FROM purchase_orders WHERE id = $1', [id])
    if (!order) return err(res, 404, 'Purchase order not found')
    if (order.status !== 'draft') return err(res, 409, 'Order lines change only while the order is a draft — changes require reapproval')
    const { rows } = await pool.query(
      'INSERT INTO purchase_order_lines (purchase_order_id, vendor_item_id, qty_ordered, unit_cost, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, vendorItemId, qtyOrdered, unitCost ?? null, notes]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** PUT /api/purchasing/orders/:id/lines/:lineId */
purchasingRouter.put('/orders/:id/lines/:lineId', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id, lineId } = req.params
  const { qtyOrdered, unitCost, notes } = req.body
  if (qtyOrdered !== undefined && (typeof qtyOrdered !== 'number' || !Number.isFinite(qtyOrdered) || qtyOrdered <= 0)) {
    return err(res, 400, 'qtyOrdered must be a positive finite number')
  }
  if (unitCost !== undefined && unitCost !== null && (typeof unitCost !== 'number' || !Number.isFinite(unitCost) || unitCost < 0)) {
    return err(res, 400, 'unitCost must be a non-negative finite number')
  }
  try {
    // F5: scope the line to its parent order and freeze approved content.
    // Received quantities move only through the receiving workflow.
    const { rows: [order] } = await pool.query('SELECT id, status FROM purchase_orders WHERE id = $1', [id])
    if (!order) return err(res, 404, 'Purchase order not found')
    if (order.status !== 'draft') return err(res, 409, 'Order lines change only while the order is a draft — changes require reapproval')
    const { rows } = await pool.query(
      'UPDATE purchase_order_lines SET qty_ordered = COALESCE($1, qty_ordered), unit_cost = COALESCE($2, unit_cost), notes = COALESCE($3, notes) WHERE id = $4 AND purchase_order_id = $5 RETURNING *',
      [qtyOrdered, unitCost, notes, lineId, id]
    )
    if (!rows.length) return err(res, 404, 'Line not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})

/** DELETE /api/purchasing/orders/:id/lines/:lineId */
purchasingRouter.delete('/orders/:id/lines/:lineId', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id, lineId } = req.params
  try {
    const { rows: [order] } = await pool.query('SELECT id, status FROM purchase_orders WHERE id = $1', [id])
    if (!order) return err(res, 404, 'Purchase order not found')
    if (order.status !== 'draft') return err(res, 409, 'Order lines change only while the order is a draft — changes require reapproval')
    const { rows } = await pool.query('DELETE FROM purchase_order_lines WHERE id = $1 AND purchase_order_id = $2 RETURNING id', [lineId, id])
    if (!rows.length) return err(res, 404, 'Line not found')
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// ─── PO Receiving — closes the receiving loop (B10) ──────────────────────────

/**
 * Convert a received quantity from the line's unit into the order guide's
 * unit via the shared units engine (mass↔mass, volume↔volume, mass↔volume
 * density path, #10 can↔mass). Where the engine has no real conversion path
 * (e.g. case ↔ each with no pack factor on the item), the raw qty is carried
 * through 1:1 but flagged explicitly in the ledger note — never silently
 * "converted", and never guessed.
 */
function toGuideUnits(
  qty: number,
  fromUnit: string | undefined,
  guideUnit: string | undefined,
  itemName?: string
): { qty: number; unit: string; converted: boolean; assumedOneToOne: boolean; fromUnit: string; guideUnit: string } {
  const from = UnitConversionEngine.normalizeUnit(fromUnit || '')
  const to = UnitConversionEngine.normalizeUnit(guideUnit || '')
  const isMass = (u: string) => u in MASS_TO_GRAMS
  const isVol = (u: string) => u in VOLUME_TO_ML
  const engineHandles =
    from === to ||
    ((isMass(from) || isVol(from)) && (isMass(to) || isVol(to))) ||
    (from === '#10 can' && isMass(to)) ||
    (to === '#10 can' && isMass(from))
  if (engineHandles) {
    const { convertedAmount } = UnitConversionEngine.convert(qty, from, to, itemName)
    return { qty: convertedAmount, unit: to, converted: from !== to, assumedOneToOne: false, fromUnit: from, guideUnit: to }
  }
  return { qty, unit: to, converted: false, assumedOneToOne: true, fromUnit: from, guideUnit: to }
}

/**
 * POST /api/purchasing/orders/:id/lines/:lineId/receive
 *
 * Records a receipt for a PO line: sets the cumulative qty_received and,
 * atomically in one DB transaction, increments the matched order guide's
 * on_hand (unit-converted) and appends an inventory_transactions receipt row
 * (user-stamped).
 *
 * Matching: line → vendor_item → order_guides via vendor_item_id (vendor SKU
 * is carried through for the audit trail). An unmatched line returns
 * 409 { code: 'GUIDE_UNMATCHED' } so the UI shows an explicit "assign" state —
 * matching is never guessed.
 *
 * Body: { qtyReceived: number (cumulative total), qtyUnit?: string, note?: string }
 *   - Partial receives: post the new cumulative total; only the delta moves stock.
 *   - Corrections: posting a lower total writes a signed 'count_adjust' ledger
 *     row — the ledger is append-only, never edited.
 */
purchasingRouter.post('/orders/:id/lines/:lineId/receive', requireRole('staff'), async (req, res, next) => {
  const ar = req as AuthRequest
  const { id, lineId } = req.params
  const { qtyReceived, qtyUnit, note = '' } = req.body ?? {}
  const total = Number(qtyReceived)
  if (!Number.isFinite(total) || total < 0) return err(res, 400, 'qtyReceived must be a non-negative number')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: [line] } = await client.query(
      `SELECT pol.*, vi.vendor_sku, vi.name AS item_name, vi.uom AS line_uom
       FROM purchase_order_lines pol
       JOIN vendor_items vi ON vi.id = pol.vendor_item_id
       WHERE pol.id = $1 AND pol.purchase_order_id = $2`,
      [lineId, id]
    )
    if (!line) { await client.query('ROLLBACK'); return err(res, 404, 'PO line not found') }

    const { rows: [guide] } = await client.query(
      `SELECT og.*, vi.uom AS guide_uom
       FROM order_guides og
       JOIN vendor_items vi ON vi.id = og.vendor_item_id
       WHERE og.vendor_item_id = $1
       LIMIT 1`,
      [line.vendor_item_id]
    )
    if (!guide) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        code: 'GUIDE_UNMATCHED',
        error: 'Line is not matched to an order guide entry — assign it before receiving',
        lineId, vendorItemId: line.vendor_item_id, vendorSku: line.vendor_sku, itemName: line.item_name,
      })
    }

    const prior = Number(line.qty_received ?? 0) // stored in the line's base unit (vi.uom)
    const baseUnit = UnitConversionEngine.normalizeUnit(line.line_uom || 'each')
    // The posted cumulative total is expressed in qtyUnit (defaults to the
    // line's base unit); normalize to base units before diffing so mixed-unit
    // receipts (e.g. ordered in lb, counted in kg) stay correct.
    const totalConv = toGuideUnits(total, qtyUnit ?? line.line_uom, baseUnit, line.item_name)
    const totalBase = Math.round(totalConv.qty * 100) / 100
    const deltaOrdered = Math.round((totalBase - prior) * 100) / 100
    if (deltaOrdered === 0) {
      await client.query('COMMIT')
      return res.json({ ok: true, changed: false, lineId, qtyReceived: prior })
    }

    const conv = toGuideUnits(deltaOrdered, baseUnit, guide.guide_uom, line.item_name)
    const guideBefore = Number(guide.on_hand ?? 0)
    const guideAfter = Math.round((guideBefore + conv.qty) * 100) / 100

    await client.query(
      `UPDATE purchase_order_lines SET qty_received = $1 WHERE id = $2`,
      [totalBase, lineId]
    )
    await client.query(
      `UPDATE order_guides SET on_hand = on_hand + $1, updated_at = NOW() WHERE id = $2`,
      [conv.qty, guide.id]
    )
    // Fail closed: the on-hand bump must actually land. If the guide row was
    // created without an id (e.g. the SQLite path strips uuid defaults),
    // `WHERE id = NULL` would silently match nothing — roll back instead of
    // writing a receipt row that claims stock moved.
    const { rows: [recheck] } = await client.query(
      `SELECT on_hand FROM order_guides WHERE id = $1`,
      [guide.id]
    )
    if (!recheck || Math.abs(Number(recheck.on_hand) - guideAfter) > 0.005) {
      await client.query('ROLLBACK')
      return err(res, 500, 'Failed to update order guide on-hand — receipt rolled back')
    }

    // Append-only ledger row: real receipts add stock; a correction that
    // lowers qty_received posts a signed count_adjust instead.
    const txType = deltaOrdered > 0 ? 'receipt' : 'count_adjust'
    const txQty = deltaOrdered > 0 ? Math.abs(conv.qty) : conv.qty
    const txId = randomUUID()
    await client.query(
      `INSERT INTO inventory_transactions (id, item_id, type, qty, unit, user_id, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        txId, null, txType, txQty, conv.unit, ar.userId ?? null,
        JSON.stringify({
          text: note || (deltaOrdered > 0
            ? `PO receipt: ${line.item_name}`
            : `PO receipt correction: ${line.item_name}`),
          purchaseOrderId: id,
          lineId,
          vendorItemId: line.vendor_item_id,
          vendorSku: line.vendor_sku,
          itemName: line.item_name,
          priorReceived: prior,
          newReceived: totalBase,
          postedTotal: total,
          postedUnit: qtyUnit ?? line.line_uom,
          deltaInLineUnits: deltaOrdered,
          lineUnit: conv.fromUnit,
          deltaInGuideUnits: conv.qty,
          guideUnit: conv.guideUnit,
          unitConverted: conv.converted,
          assumedOneToOne: conv.assumedOneToOne || undefined,
          correction: deltaOrdered < 0 || undefined,
        }),
      ]
    )

    // Promote the PO to 'received' once every line is fully received.
    const { rows: pending } = await client.query(
      `SELECT 1 FROM purchase_order_lines
       WHERE purchase_order_id = $1 AND (qty_received IS NULL OR qty_received < qty_ordered)
       LIMIT 1`,
      [id]
    )
    let orderStatus: string | undefined
    if (!pending.length) {
      const { rows: [o] } = await client.query(
        `UPDATE purchase_orders SET status = 'received', updated_at = NOW()
         WHERE id = $1 AND status <> 'cancelled' RETURNING status`,
        [id]
      )
      orderStatus = o?.status
    }

    await client.query('COMMIT')
    const ordered = Number(line.qty_ordered ?? 0)
    res.json({
      ok: true,
      changed: true,
      lineId,
      qtyReceived: totalBase,
      units: {
        postedUnit: qtyUnit ?? line.line_uom,
        baseUnit,
        guideUnit: conv.guideUnit,
      },
      flags: {
        overReceived: totalBase > ordered,
        partial: totalBase > 0 && totalBase < ordered,
        complete: totalBase > 0 && totalBase >= ordered,
      },
      guide: {
        guideId: guide.id,
        vendorItemId: line.vendor_item_id,
        onHandBefore: guideBefore,
        onHandAfter: guideAfter,
        deltaInGuideUnits: conv.qty,
        guideUnit: conv.guideUnit,
        unitConverted: conv.converted,
        assumedOneToOne: conv.assumedOneToOne,
      },
      receiptTransactionId: txId,
      transactionType: txType,
      orderStatus,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    next(e)
  } finally {
    client.release()
  }
})

// ─── CSV Export ───────────────────────────────────────────────────────────

/**
 * GET /api/purchasing/orders/:id/export-csv
 * Returns a Dennis-ready CSV for the purchase order lines.
 */
purchasingRouter.get('/orders/:id/export-csv', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  try {
    const { rows: [order] } = await pool.query(
      `SELECT po.*, v.name AS vendor_name FROM purchase_orders po JOIN vendors v ON v.id = po.vendor_id WHERE po.id = $1`,
      [id]
    )
    if (!order) return err(res, 404, 'Order not found')
    const { rows: lines } = await pool.query(
      `SELECT pol.qty_ordered, vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom, v.name AS vendor_name
       FROM purchase_order_lines pol
       JOIN vendor_items vi ON vi.id = pol.vendor_item_id
       JOIN vendors v ON v.id = (SELECT vendor_id FROM purchase_orders WHERE id = $1)
       WHERE pol.purchase_order_id = $1
       ORDER BY vi.category, vi.name`,
      [id]
    )
    const header = 'vendor,name,sku,pack,uom,qty\n'
    const csvRows = lines.map(l =>
      `"${order.vendor_name}","${l.item_name}","${l.vendor_sku}","${l.pack_size}","${l.uom}",${l.qty_ordered}`
    ).join('\n')
    const filename = `${order.vendor_name.replace(/\s+/g, '-').toLowerCase()}-order-${order.order_date}.csv`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(header + csvRows)
  } catch (e) { next(e) }
})

/**
 * GET /api/purchasing/invoices
 * Lists recent distributor invoices and their match statuses
 */
purchasingRouter.get('/invoices', requireTier('enterprise'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM distributor_invoices ORDER BY invoice_date DESC LIMIT 50
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

/**
 * POST /api/purchasing/invoices/evaluate
 * Evaluates 3-way match across PO contract rates, receiving dock counts, and distributor invoice.
 * Flags line-by-line price variances, quantity shortages, and creates vendor credit memo proposals.
 */
purchasingRouter.post('/invoices/evaluate', requireTier('enterprise'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceNumber, vendorName, invoiceDate, poReference, lines } = req.body
    if (!invoiceNumber || !vendorName || !Array.isArray(lines)) {
      return err(res, 400, 'invoiceNumber, vendorName, and lines array are required')
    }

    const report = ThreeWayInvoiceMatchingEngine.evaluateThreeWayMatch({
      invoiceNumber,
      vendorName,
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      poReference: poReference || 'N/A',
      lines,
    })

    res.json({
      success: true,
      report,
    })
  } catch (e) { next(e) }
})
