"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const express_1 = __importDefault(require("express"));
const catalogMatcher_1 = require("./engine/catalogMatcher");
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.SQLITE_PATH = node_path_1.default.join((0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'shoreline-purchasing-')), 'test.db');
(0, node_test_1.test)('matrix compares current prices in canonical units and excludes unreviewed or unknown offers', () => {
    const canonical = { id: 'c', name: 'Milk', category: 'Dairy', standardUom: 'gal' };
    const offer = (vendorCode, packSize, caseCost, matchStatus = 'confirmed') => ({ vendorId: vendorCode, vendorCode, vendorName: vendorCode, vendorSku: vendorCode, itemName: 'Milk', packSize, caseCost, matchStatus, canonicalProductId: 'c', uom: 'case', normalizedUnitCost: 0.001, packQuantityInStandardUom: 1, matchConfidence: 100 });
    const [row] = catalogMatcher_1.PriceMatrixSolver.solveMatrix([canonical], [offer('gallon', '4/1 gal', 16), offer('fluid', '12/32 fl oz', 15), offer('unknown', 'mystery', 1), offer('weight', '4/1 lb', 1), offer('candidate', '4/1 gal', 1, 'candidate')]);
    strict_1.default.equal(row.winningVendor?.vendorCode, 'gallon');
    strict_1.default.equal(row.winningVendor?.normalizedUnitCost, 4);
    strict_1.default.equal(row.offers.length, 2);
    strict_1.default.ok(Math.abs(row.runnerUpVendor.normalizedUnitCost - 5) < 0.001);
});
(0, node_test_1.test)('PO alternate routes cannot bypass approval or mutate approved content', async () => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { purchasingRouter } = await Promise.resolve().then(() => __importStar(require('./routes/purchasing')));
    const { distributorRouter } = await Promise.resolve().then(() => __importStar(require('./routes/distributor')));
    await pool.query('CREATE TABLE purchase_orders (id TEXT PRIMARY KEY,status TEXT,vendor_id TEXT,expected_date TEXT,notes TEXT,updated_at TEXT)');
    await pool.query('CREATE TABLE purchase_order_lines (id TEXT PRIMARY KEY,purchase_order_id TEXT,vendor_item_id TEXT,qty_ordered REAL,unit_cost REAL,notes TEXT)');
    await pool.query('CREATE TABLE audit_log (action TEXT,user_id TEXT,resource_id TEXT,resource_type TEXT,outcome TEXT,details TEXT)');
    await pool.query("INSERT INTO purchase_orders(id,status) VALUES ('p','draft'),('other','draft')");
    await pool.query("INSERT INTO purchase_order_lines(id,purchase_order_id,qty_ordered) VALUES ('line','p',1)");
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, _res, next) => { Object.assign(req, { userRole: req.headers['x-role'] || 'manager' }); next(); });
    app.use('/p', purchasingRouter);
    app.use('/d', distributorRouter);
    app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (url, method, body = {}, role = 'manager') => fetch(base + url, { method, headers: { 'content-type': 'application/json', 'x-role': role }, body: JSON.stringify(body) });
    try {
        strict_1.default.equal((await request('/p/orders/p', 'PUT', { status: 'approved' })).status, 400);
        strict_1.default.equal((await request('/d/orders/p/status', 'PUT', { status: 'submitted' })).status, 409);
        strict_1.default.equal((await request('/p/orders/other/lines/line', 'PUT', { qtyOrdered: 2 })).status, 404);
        strict_1.default.equal((await request('/p/orders/p/lines/line', 'PUT', { qtyOrdered: 2 }, 'frontdesk')).status, 403);
        strict_1.default.equal((await request('/d/match', 'POST', {}, 'readonly')).status, 403);
        strict_1.default.equal((await request('/p/orders/p/approve', 'POST')).status, 200);
        strict_1.default.equal((await request('/p/orders/p/lines/line', 'PUT', { qtyOrdered: 2 })).status, 409);
        strict_1.default.equal((await request('/p/orders/p/lines/line', 'DELETE')).status, 409);
        strict_1.default.equal((await request('/p/orders/p/lines', 'POST', { vendorItemId: 'x', qtyOrdered: 2 })).status, 409);
        strict_1.default.equal((await request('/p/orders/p/submit', 'POST')).status, 200);
        strict_1.default.equal((await request('/d/orders/p/status', 'PUT', { status: 'received' })).status, 200);
        strict_1.default.equal((await request('/d/orders/p/status', 'PUT', { status: 'submitted' })).status, 409);
        const { rows } = await pool.query("SELECT qty_ordered FROM purchase_order_lines WHERE id = 'line'");
        strict_1.default.equal(rows[0].qty_ordered, 1);
        // Concurrent reviewers cannot approve the same draft twice.
        const approvals = await Promise.all([request('/p/orders/other/approve', 'POST'), request('/p/orders/other/approve', 'POST')]);
        strict_1.default.deepEqual(approvals.map(response => response.status).sort(), [200, 409]);
        strict_1.default.equal((await pool.query("SELECT * FROM audit_log WHERE resource_id = 'other'")).rows.length, 1);
        await pool.query("INSERT INTO purchase_orders(id,status) VALUES ('rollback','draft')");
        await pool.query("CREATE TRIGGER reject_po_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END");
        strict_1.default.equal((await request('/p/orders/rollback/approve', 'POST')).status, 500);
        strict_1.default.equal((await pool.query("SELECT status FROM purchase_orders WHERE id = 'rollback'")).rows[0].status, 'draft');
        await pool.query('DROP TRIGGER reject_po_audit');
    }
    finally {
        server.closeAllConnections();
        await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
        await pool.end();
    }
});
