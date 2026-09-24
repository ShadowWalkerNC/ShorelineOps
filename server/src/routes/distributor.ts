/**
 * Distributor & Cross-Vendor Catalog API
 * ShorelineOps & CulinaryOS Core Integration Service
 *
 * Provides endpoints for:
 * 1. Distributor vendor directory & delivery schedules
 * 2. Scoped vendor catalog management & bulk CSV price guide ingestion
 * 3. Canonical product master & cross-vendor matching desk ("Match & Crush")
 * 4. Side-by-side price comparison matrix with lowest-cost winner detection
 * 5. Distributor purchase order desk for rep acknowledgment and delivery tracking
 */

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'
import {
  PackSizeNormalizer,
  FuzzyProductMatcher,
  PriceMatrixSolver,
  CanonicalProduct,
  MatchedVendorOffer,
} from '../engine/catalogMatcher'

export const distributorRouter = Router()

function err(res: Response, status: number, msg: string) {
  return res.status(status).json({ error: msg })
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. VENDOR REPOSITORIES & SCHEDULES
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/distributor/vendors */
distributorRouter.get('/vendors', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*,
             (SELECT COUNT(*) FROM vendor_items vi WHERE vi.vendor_id = v.id AND vi.active = true) AS catalog_count,
             (SELECT COUNT(*) FROM vendor_item_matches vim 
              JOIN vendor_items vi ON vi.id = vim.vendor_item_id 
              WHERE vi.vendor_id = v.id AND vim.match_status != 'rejected') AS matched_count,
             (SELECT COUNT(*) FROM purchase_orders po WHERE po.vendor_id = v.id AND po.status IN ('submitted', 'approved')) AS active_po_count
      FROM vendors v
      WHERE v.active = true
      ORDER BY v.name ASC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. SCOPED CATALOG & BULK CSV PRICE GUIDE INGESTION
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/distributor/catalog?vendorId=... */
distributorRouter.get('/catalog', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId } = req.query
  if (!vendorId) return err(res, 400, 'vendorId is required')

  try {
    const { rows } = await pool.query(`
      SELECT vi.*,
             vim.id AS match_id,
             vim.canonical_product_id,
             vim.pack_quantity_in_standard_uom,
             vim.normalized_unit_cost,
             vim.match_confidence,
             vim.match_status,
             vim.normalized_uom,
             cp.name AS canonical_product_name,
             cp.standard_uom AS canonical_standard_uom
      FROM vendor_items vi
      LEFT JOIN vendor_item_matches vim ON vim.vendor_item_id = vi.id AND vim.match_status IN ('confirmed', 'candidate')
      LEFT JOIN canonical_products cp ON cp.id = vim.canonical_product_id
      WHERE vi.vendor_id = $1
      ORDER BY vi.category ASC, vi.name ASC
    `, [vendorId])
    res.json(rows)
  } catch (e) { next(e) }
})

/**
 * Helper to parse CSV text into items
 */
function parseCsvCatalog(csvText: string): Array<{
  sku: string
  name: string
  brand?: string
  packSize?: string
  uom?: string
  category?: string
  unitCost: number
}> {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) return []

  const header = lines[0].toLowerCase().split(',').map(h => h.replace(/^["']|["']$/g, '').trim())
  const skuIdx = header.findIndex(h => h.includes('sku') || h.includes('item') || h === 'code')
  const nameIdx = header.findIndex(h => h.includes('name') || h.includes('desc') || h.includes('product'))
  const brandIdx = header.findIndex(h => h.includes('brand') || h.includes('mfr'))
  const packIdx = header.findIndex(h => h.includes('pack') || h.includes('size'))
  const uomIdx = header.findIndex(h => h.includes('uom') || h.includes('unit'))
  const catIdx = header.findIndex(h => h.includes('category') || h.includes('dept') || h.includes('group'))
  const costIdx = header.findIndex(h => h.includes('cost') || h.includes('price') || h.includes('rate'))

  const items = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.replace(/^["']|["']$/g, '').trim())
    if (parts.length <= skuIdx || !parts[skuIdx]) continue

    const sku = parts[skuIdx]
    const name = nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx] : `Item ${sku}`
    const brand = brandIdx !== -1 ? parts[brandIdx] : ''
    const packSize = packIdx !== -1 ? parts[packIdx] : ''
    const uom = uomIdx !== -1 ? parts[uomIdx] : 'case'
    const category = catIdx !== -1 ? parts[catIdx] : 'General'
    const unitCost = costIdx !== -1 && !isNaN(parseFloat(parts[costIdx].replace(/[^0-9.]/g, '')))
      ? parseFloat(parts[costIdx].replace(/[^0-9.]/g, ''))
      : 0

    items.push({ sku, name, brand, packSize, uom, category, unitCost })
  }

  return items
}

/** POST /api/distributor/catalog-upload — Ingest price catalog and auto-match to canonical products */
distributorRouter.post('/catalog-upload', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId, csvContent, items: rawItems } = req.body
  if (!vendorId) return err(res, 400, 'vendorId is required')

  let itemsToProcess = Array.isArray(rawItems) ? rawItems : []
  if (typeof csvContent === 'string' && csvContent.trim().length > 0) {
    itemsToProcess = parseCsvCatalog(csvContent)
  }

  if (itemsToProcess.length === 0) {
    return err(res, 400, 'No valid catalog items found in request')
  }

  try {
    // 1. Fetch all canonical products for matching
    const { rows: canonicalRows } = await pool.query('SELECT * FROM canonical_products')
    const canonicalProducts: CanonicalProduct[] = canonicalRows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      standardUom: r.standard_uom,
      allergens: typeof r.allergens === 'string' ? JSON.parse(r.allergens) : r.allergens || [],
    }))

    let importedCount = 0
    let candidateCount = 0
    let reviewCount = 0

    for (const item of itemsToProcess) {
      // Upsert vendor_item
      const { rows: existing } = await pool.query(
        'SELECT * FROM vendor_items WHERE vendor_id = $1 AND vendor_sku = $2',
        [vendorId, item.sku]
      )

      let itemId: string
      if (existing.length > 0) {
        itemId = existing[0].id
        await pool.query(
          `UPDATE vendor_items SET
             name = $1, brand = $2, pack_size = $3, uom = $4, category = $5, unit_cost = $6, active = true, updated_at = NOW()
           WHERE id = $7`,
          [item.name, item.brand || '', item.packSize || '', item.uom || 'case', item.category || '', item.unitCost, itemId]
        )
      } else {
        itemId = randomUUID()
        await pool.query(
          `INSERT INTO vendor_items (id, vendor_id, vendor_sku, name, brand, pack_size, uom, category, unit_cost, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
          [itemId, vendorId, item.sku, item.name, item.brand || '', item.packSize || '', item.uom || 'case', item.category || '', item.unitCost]
        )
      }
      importedCount++

      // Compute normalized pack size and cost
      const norm = PackSizeNormalizer.normalize(item.packSize || '', item.unitCost)

      // Refresh all reviewed mappings; changed specifications require review again.
      const previous = existing[0]
      const changed = previous && (previous.name !== item.name || (previous.brand || '') !== (item.brand || '') || (previous.pack_size || '') !== (item.packSize || '') || previous.uom !== (item.uom || 'case'))
      await pool.query(
        `UPDATE vendor_item_matches SET pack_quantity_in_standard_uom = $1, normalized_unit_cost = $2, normalized_uom = $3,
         match_status = CASE WHEN match_status = 'confirmed' AND $4 THEN 'candidate' ELSE match_status END, updated_at = NOW() WHERE vendor_item_id = $5`,
        [norm.totalStandardUnits, norm.normalizedUnitCost, norm.standardUom, Boolean(changed), itemId]
      )

      // Run fuzzy matcher
      if (canonicalProducts.length > 0) {
        const { canonicalProduct, confidence } = FuzzyProductMatcher.findBestMatch(item.name, canonicalProducts)

        if (canonicalProduct) {
          // F6: name similarity is not equivalence. Scores >= 70 become
          // review candidates; only desk-confirmed matches are comparable.
          const matchStatus = confidence >= 70 ? 'candidate' : 'rejected'
          if (matchStatus === 'candidate') {
            candidateCount++
          } else {
            reviewCount++
          }

          // F6/F7: reimports refresh current prices on every row but only
          // 'candidate' rows get a fresh status — confirmed/rejected desk
          // decisions are never overwritten by a later upload.
          await pool.query(
            'INSERT INTO vendor_item_matches (id, canonical_product_id, vendor_item_id, pack_quantity_in_standard_uom, normalized_unit_cost, normalized_uom, match_confidence, match_status, matched_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (canonical_product_id, vendor_item_id) DO UPDATE SET pack_quantity_in_standard_uom = $4, normalized_unit_cost = $5, normalized_uom = $6, match_confidence = $7, updated_at = NOW(), match_status = CASE WHEN vendor_item_matches.match_status = $10 THEN $8 ELSE vendor_item_matches.match_status END, matched_by = CASE WHEN vendor_item_matches.match_status = $10 THEN $9 ELSE vendor_item_matches.matched_by END',
            [randomUUID(), canonicalProduct.id, itemId, norm.totalStandardUnits, norm.normalizedUnitCost, norm.standardUom, confidence, matchStatus, 'system_upload', 'candidate']
          )
        }
      }
    }

    res.json({
      ok: true,
      totalImported: importedCount,
      candidateCount,
      reviewCount,
    })
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. CANONICAL PRODUCTS & CROSS-VENDOR PRODUCT MATCHING DESK
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/distributor/canonical-products */
distributorRouter.get('/canonical-products', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await pool.query(`
      SELECT cp.*,
             (SELECT COUNT(*) FROM vendor_item_matches vim WHERE vim.canonical_product_id = cp.id AND vim.match_status = 'confirmed') AS match_count
      FROM canonical_products cp
      ORDER BY cp.category ASC, cp.name ASC
    `)
    res.json(rows)
  } catch (e) { next(e) }
})

/** POST /api/distributor/canonical-products */
distributorRouter.post('/canonical-products', async (req: Request, res: Response, next: NextFunction) => {
  const { name, category, standardUom, description = '', allergens = [] } = req.body
  if (!name || !category || !standardUom) return err(res, 400, 'name, category, and standardUom are required')

  try {
    const id = randomUUID()
    const { rows } = await pool.query(
      `INSERT INTO canonical_products (id, name, category, standard_uom, description, allergens)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, name, category, standardUom, description, allergens]
    )
    res.status(201).json(rows[0])
  } catch (e) { next(e) }
})

/** POST /api/distributor/match — Confirm or reject SKU match */
distributorRouter.post('/match', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { canonicalProductId, vendorItemId, matchStatus = 'confirmed' } = req.body
  if (!canonicalProductId || !vendorItemId) return err(res, 400, 'canonicalProductId and vendorItemId required')
  if (!['confirmed', 'candidate', 'rejected'].includes(matchStatus)) {
    return err(res, 400, "matchStatus must be 'confirmed', 'candidate', or 'rejected'")
  }

  try {
    // Get vendor item for pack size calculation
    const { rows: [item] } = await pool.query('SELECT * FROM vendor_items WHERE id = $1', [vendorItemId])
    if (!item) return err(res, 404, 'Vendor item not found')

    const norm = PackSizeNormalizer.normalize(item.pack_size || '', item.unit_cost)

    // Check if match already exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM vendor_item_matches WHERE canonical_product_id = $1 AND vendor_item_id = $2',
      [canonicalProductId, vendorItemId]
    )

    if (existing.length > 0) {
      await pool.query(
        'UPDATE vendor_item_matches SET match_status = $1, pack_quantity_in_standard_uom = $2, normalized_unit_cost = $3, normalized_uom = $4, matched_by = $5, updated_at = NOW() WHERE id = $6',
        [matchStatus, norm.totalStandardUnits, norm.normalizedUnitCost, norm.standardUom, 'manual_desk', existing[0].id]
      )
    } else {
      await pool.query(
        'INSERT INTO vendor_item_matches (id, canonical_product_id, vendor_item_id, pack_quantity_in_standard_uom, normalized_unit_cost, normalized_uom, match_confidence, match_status, matched_by) VALUES ($1, $2, $3, $4, $5, $6, 100.0, $7, $8)',
        [randomUUID(), canonicalProductId, vendorItemId, norm.totalStandardUnits, norm.normalizedUnitCost, norm.standardUom, matchStatus, 'manual_desk']
      )
    }

    res.json({ ok: true, matchStatus })
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. CROSS-VENDOR PRICE COMPARISON MATRIX ("THE MATCH & CRUSH VIEW")
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/distributor/price-matrix */
distributorRouter.get('/price-matrix', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows: canonicalRows } = await pool.query('SELECT * FROM canonical_products ORDER BY category ASC, name ASC')
    const { rows: matchRows } = await pool.query(`
      SELECT vim.*,
             vi.vendor_sku, vi.name AS item_name, vi.brand, vi.pack_size, vi.uom, vi.unit_cost AS case_cost,
             v.id AS vendor_id, v.code AS vendor_code, v.name AS vendor_name
      FROM vendor_item_matches vim
      JOIN vendor_items vi ON vi.id = vim.vendor_item_id
      JOIN vendors v ON v.id = vi.vendor_id
      WHERE vim.match_status = 'confirmed' AND vi.active = true
    `)

    const canonicalProducts: CanonicalProduct[] = canonicalRows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      standardUom: r.standard_uom,
      allergens: typeof r.allergens === 'string' ? JSON.parse(r.allergens) : r.allergens || [],
    }))

    const offers: MatchedVendorOffer[] = matchRows.map(r => ({
      vendorId: r.vendor_id,
      vendorCode: r.vendor_code,
      vendorName: r.vendor_name,
      vendorSku: r.vendor_sku,
      itemName: r.item_name,
      brand: r.brand,
      packSize: r.pack_size,
      uom: r.uom,
      caseCost: parseFloat(r.case_cost || '0'),
      packQuantityInStandardUom: parseFloat(r.pack_quantity_in_standard_uom || '1'),
      normalizedUnitCost: parseFloat(r.normalized_unit_cost || '0'),
      matchConfidence: parseFloat(r.match_confidence || '100'),
      normalizedUom: r.normalized_uom || '',
      matchStatus: r.match_status,
      canonicalProductId: r.canonical_product_id,
    } as any))

    const matrix = PriceMatrixSolver.solveMatrix(canonicalProducts, offers)

    // Calculate total potential monthly savings assuming standard kitchen turnover
    const totalPotentialSavings = matrix.reduce((acc, row) => {
      // Estimate 50 standard units per week = 200 per month
      return acc + (row.costSavingsPerUnit ? row.costSavingsPerUnit * 200 : 0)
    }, 0)

    res.json({
      matrix,
      summary: {
        totalCanonicalProducts: matrix.length,
        comparedProductsCount: matrix.filter(r => r.offers.length > 1).length,
        singleVendorProductsCount: matrix.filter(r => r.offers.length === 1).length,
        estimatedMonthlySavings: Math.round(totalPotentialSavings * 100) / 100,
      }
    })
  } catch (e) { next(e) }
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. DISTRIBUTOR PURCHASE ORDER DESK
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/distributor/orders?vendorId=... */
distributorRouter.get('/orders', async (req: Request, res: Response, next: NextFunction) => {
  const { vendorId, status } = req.query
  if (!vendorId) return err(res, 400, 'vendorId is required')

  try {
    let query = `
      SELECT po.*, v.name AS vendor_name, v.code AS vendor_code,
             (SELECT COUNT(*) FROM purchase_order_lines pol WHERE pol.purchase_order_id = po.id) AS line_count,
             (SELECT SUM(pol.qty_ordered * COALESCE(pol.unit_cost, 0)) FROM purchase_order_lines pol WHERE pol.purchase_order_id = po.id) AS total_amount
      FROM purchase_orders po
      JOIN vendors v ON v.id = po.vendor_id
      WHERE po.vendor_id = $1
    `
    const params: any[] = [vendorId]

    if (status && typeof status === 'string') {
      params.push(status)
      query += ` AND po.status = $2`
    }

    query += ` ORDER BY po.order_date DESC, po.created_at DESC`

    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (e) { next(e) }
})

/** PUT /api/distributor/orders/:id/status — Vendor Rep Status Update */
distributorRouter.put('/orders/:id/status', requireRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params
  const { status, expectedDate, notes } = req.body

  if (!status) return err(res, 400, 'status is required')
  // F5: vendor updates must not stand in for facility approval. Draft and
  // approved transitions belong to the purchasing approval workflow; this
  // endpoint records vendor-observable progress on submitted orders only.
  const VENDOR_STATUSES = ['submitted', 'received', 'cancelled']
  if (!VENDOR_STATUSES.includes(status)) {
    return err(res, 400, 'Use the purchasing approval workflow for draft/approved transitions')
  }

  try {
    const { rows: [order] } = await pool.query(
      'SELECT id, status FROM purchase_orders WHERE id = $1',
      [id]
    )
    if (!order) return err(res, 404, 'Purchase order not found')
    if (order.status !== 'submitted') {
      return err(res, 409, 'Vendor status changes require a submitted purchase order')
    }
    const { rows } = await pool.query(
      `UPDATE purchase_orders SET status = COALESCE($1, status), expected_date = COALESCE($2, expected_date), notes = COALESCE($3, notes), updated_at = NOW() WHERE id = $4 AND status = 'submitted' RETURNING *`,
      [status, expectedDate, notes, id]
    )
    if (!rows.length) return err(res, 404, 'Purchase order not found')
    res.json(rows[0])
  } catch (e) { next(e) }
})
