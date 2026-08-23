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
 *   POST   /api/purchasing/orders
 *   GET    /api/purchasing/orders/:id
 *   PUT    /api/purchasing/orders/:id
 *   DELETE /api/purchasing/orders/:id
 *
 *   GET    /api/purchasing/orders/:id/lines
 *   POST   /api/purchasing/orders/:id/lines
 *   PUT    /api/purchasing/orders/:id/lines/:lineId
 *   DELETE /api/purchasing/orders/:id/lines/:lineId
 *
 *   GET    /api/purchasing/orders/:id/export-csv   (CSV download)
 */
import { Router, Request, Response, NextFunction } from 'express'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'
import { MrpDemandForecastEngine, ScheduledMealDemand, InventoryItemStock } from '../engine/mrp'

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

    // 1. Fetch active resident census
    const { rows: residentRows } = await pool.query(
      `SELECT count(*) as total FROM residents WHERE status = 'Active'`
    )
    const activeHeadcount = parseInt(residentRows[0]?.total || '50', 10)

    // 2. Fetch master recipes
    const { rows: recipeRows } = await pool.query(`SELECT * FROM recipes`)
    
    // Build scheduled meals from active cycle or defaults
    const scheduledMeals: ScheduledMealDemand[] = recipeRows.map(r => ({
      dayOfWeek: 'Monday',
      mealSlot: 'lunchOpt1Meat',
      projectedPortions: activeHeadcount,
      recipeLink: {
        menuItemId: r.id,
        menuItemName: r.name,
        recipeId: r.id,
        recipeName: r.name,
        baseServings: parseFloat(r.base_servings || 10),
        portionMultiplier: 1.0,
        ingredients: r.ingredients || [],
      },
    }))

    // 3. Explode BOM
    const exploded = MrpDemandForecastEngine.explodeBillOfMaterials(scheduledMeals)

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
      activeResidentHeadcount: activeHeadcount,
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

/** POST /api/purchasing/orders */
purchasingRouter.post('/orders', async (req: Request, res: Response, next: NextFunction) => {
  const ar = req as AuthRequest
  const { vendorId, orderDate, expectedDate, notes = '', lines = [] } = req.body
  if (!vendorId) return err(res, 400, 'vendorId required')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [order] } = await client.query(
      `INSERT INTO purchase_orders (vendor_id, order_date, expected_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
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
      `SELECT pol.*, vi.name AS item_name, vi.vendor_sku, vi.pack_size, vi.uom
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

// ─── Order lines ──────────────────────────────────────────────────────────

/** POST /api/purchasing/orders/:id/lines */
purchasingRouter.post('/orders/:id/lines', async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { vendorItemId, qtyOrdered, unitCost, notes = '' } = req.body
  if (!vendorItemId || qtyOrdered == null) return err(res, 400, 'vendorItemId and qtyOrdered required')
  try {
    const { rows } = await pool.query(
      `INSERT INTO purchase_order_lines (purchase_order_id, vendor_item_id, qty_ordered, unit_cost, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, vendorItemId, qtyOrdered, unitCost ?? null, notes]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** PUT /api/purchasing/orders/:id/lines/:lineId */
purchasingRouter.put('/orders/:id/lines/:lineId', async (req: Request, res: Response, next: NextFunction) => {
  const { lineId } = req.params
  const { qtyOrdered, qtyReceived, unitCost, notes } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE purchase_order_lines SET
         qty_ordered = COALESCE($1, qty_ordered),
         qty_received = COALESCE($2, qty_received),
         unit_cost = COALESCE($3, unit_cost),
         notes = COALESCE($4, notes)
       WHERE id = $5 RETURNING *`,
      [qtyOrdered, qtyReceived, unitCost, notes, lineId]
    )
    if (!rows.length) return err(res, 404, 'Line not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})

/** DELETE /api/purchasing/orders/:id/lines/:lineId */
purchasingRouter.delete('/orders/:id/lines/:lineId', async (req: Request, res: Response, next: NextFunction) => {
  const { lineId } = req.params
  try {
    await pool.query(`DELETE FROM purchase_order_lines WHERE id = $1`, [lineId])
    res.json({ ok: true })
  } catch (e) { next(e) }
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
