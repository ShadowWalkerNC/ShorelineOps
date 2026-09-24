import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import express from 'express'
import { PriceMatrixSolver, CanonicalProduct, MatchedVendorOffer } from './engine/catalogMatcher'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = ''
process.env.SQLITE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'shoreline-purchasing-')), 'test.db')

test('matrix compares current prices in canonical units and excludes unreviewed or unknown offers', () => {
  const canonical: CanonicalProduct = { id: 'c', name: 'Milk', category: 'Dairy', standardUom: 'gal' }
  const offer = (vendorCode: string, packSize: string, caseCost: number, matchStatus: 'confirmed' | 'candidate' = 'confirmed'): MatchedVendorOffer & { canonicalProductId: string } => ({ vendorId: vendorCode, vendorCode, vendorName: vendorCode, vendorSku: vendorCode, itemName: 'Milk', packSize, caseCost, matchStatus, canonicalProductId: 'c', uom: 'case', normalizedUnitCost: 0.001, packQuantityInStandardUom: 1, matchConfidence: 100 })
  const [row] = PriceMatrixSolver.solveMatrix([canonical], [offer('gallon', '4/1 gal', 16), offer('fluid', '12/32 fl oz', 15), offer('unknown', 'mystery', 1), offer('weight', '4/1 lb', 1), offer('candidate', '4/1 gal', 1, 'candidate')])
  assert.equal(row.winningVendor?.vendorCode, 'gallon')
  assert.equal(row.winningVendor?.normalizedUnitCost, 4)
  assert.equal(row.offers.length, 2)
  assert.ok(Math.abs(row.runnerUpVendor!.normalizedUnitCost - 5) < 0.001)
})

test('PO alternate routes cannot bypass approval or mutate approved content', async () => {
  const { pool } = await import('./db/pool')
  const { purchasingRouter } = await import('./routes/purchasing')
  const { distributorRouter } = await import('./routes/distributor')
  await pool.query('CREATE TABLE purchase_orders (id TEXT PRIMARY KEY,status TEXT,vendor_id TEXT,expected_date TEXT,notes TEXT,updated_at TEXT)')
  await pool.query('CREATE TABLE purchase_order_lines (id TEXT PRIMARY KEY,purchase_order_id TEXT,vendor_item_id TEXT,qty_ordered REAL,unit_cost REAL,notes TEXT)')
  await pool.query('CREATE TABLE audit_log (action TEXT,user_id TEXT,resource_id TEXT,resource_type TEXT,outcome TEXT,details TEXT)')
  await pool.query("INSERT INTO purchase_orders(id,status) VALUES ('p','draft'),('other','draft')")
  await pool.query("INSERT INTO purchase_order_lines(id,purchase_order_id,qty_ordered) VALUES ('line','p',1)")
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => { Object.assign(req, { userRole: req.headers['x-role'] || 'manager' }); next() })
  app.use('/p', purchasingRouter)
  app.use('/d', distributorRouter)
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({error:error.message}))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`
  const request = (url: string, method: string, body = {}, role = 'manager') => fetch(base + url, {method, headers:{'content-type':'application/json','x-role':role}, body:JSON.stringify(body)})
  try {
    assert.equal((await request('/p/orders/p', 'PUT', {status:'approved'})).status, 400)
    assert.equal((await request('/d/orders/p/status', 'PUT', {status:'submitted'})).status, 409)
    assert.equal((await request('/p/orders/other/lines/line', 'PUT', {qtyOrdered:2})).status, 404)
    assert.equal((await request('/p/orders/p/lines/line', 'PUT', {qtyOrdered:2}, 'frontdesk')).status, 403)
    assert.equal((await request('/d/match','POST', {}, 'readonly')).status,403)
    assert.equal((await request('/p/orders/p/approve', 'POST')).status, 200)
    assert.equal((await request('/p/orders/p/lines/line', 'PUT', {qtyOrdered:2})).status, 409)
    assert.equal((await request('/p/orders/p/lines/line', 'DELETE')).status, 409)
    assert.equal((await request('/p/orders/p/lines', 'POST', {vendorItemId:'x',qtyOrdered:2})).status, 409)
    assert.equal((await request('/p/orders/p/submit','POST')).status,200)
    assert.equal((await request('/d/orders/p/status','PUT',{status:'received'})).status,200)
    assert.equal((await request('/d/orders/p/status','PUT',{status:'submitted'})).status,409)
    const {rows} = await pool.query("SELECT qty_ordered FROM purchase_order_lines WHERE id = 'line'")
    assert.equal(rows[0].qty_ordered,1)
    // Concurrent reviewers cannot approve the same draft twice.
    const approvals = await Promise.all([request('/p/orders/other/approve', 'POST'), request('/p/orders/other/approve', 'POST')])
    assert.deepEqual(approvals.map(response => response.status).sort(), [200, 409])
    assert.equal((await pool.query("SELECT * FROM audit_log WHERE resource_id = 'other'")).rows.length, 1)
    await pool.query("INSERT INTO purchase_orders(id,status) VALUES ('rollback','draft')")
    await pool.query("CREATE TRIGGER reject_po_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END")
    assert.equal((await request('/p/orders/rollback/approve', 'POST')).status, 500)
    assert.equal((await pool.query("SELECT status FROM purchase_orders WHERE id = 'rollback'")).rows[0].status, 'draft')
    await pool.query('DROP TRIGGER reject_po_audit')
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve()))
    await pool.end()
  }
})
