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
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const express_1 = __importDefault(require("express"));
(0, node_test_1.default)('signed trays fail closed and action boundary rechecks current safety', async () => {
    process.env.SQLITE_PATH = (0, node_path_1.join)((0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), 'shoreline-tray-')), 'test.db');
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'test-only-tray-secret-at-least-32-characters';
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { signTray, verifyTray, readTray } = await Promise.resolve().then(() => __importStar(require('./engine/traySafety')));
    const { trayrunsRouter } = await Promise.resolve().then(() => __importStar(require('./routes/trayruns')));
    await pool.query('CREATE TABLE residents (id TEXT PRIMARY KEY, name TEXT, room TEXT, status TEXT, profile_version INTEGER, is_npo INTEGER, allergies TEXT, texture TEXT, diet_type TEXT, fluid_restriction_ml INTEGER)');
    await pool.query('CREATE TABLE ehr_reconciliation_queue (id TEXT, resident_id TEXT, status TEXT)');
    await pool.query('CREATE TABLE recipes (name TEXT, allergens TEXT, iddsi_level INTEGER)');
    await pool.query('CREATE TABLE tray_runs (id TEXT PRIMARY KEY, meal_slot TEXT, service_date TEXT)');
    await pool.query('CREATE TABLE tray_events (id TEXT, run_id TEXT, resident_id TEXT, ticket_id TEXT, event TEXT, by TEXT, note TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
    await pool.query('CREATE TABLE audit_log (action TEXT, user_id TEXT, resource_id TEXT, resource_type TEXT, outcome TEXT, details TEXT)');
    await pool.query("INSERT INTO residents VALUES ('r1','Test','1','Active',1,0,'[]','Regular','Regular',NULL)");
    await pool.query("INSERT INTO recipes VALUES ('Rice','[]',7)");
    await pool.query("INSERT INTO tray_runs VALUES ('run1','lunch','2026-09-23')");
    const claims = { residentId: 'r1', ticketId: 'TKT-test', version: 1, diet: 'Regular', texture: 'Regular', allergies: [], foods: ['Rice'], beverages: ['Water'], mealSlot: 'lunch', serviceDate: '2026-09-23' };
    const rawQrPayload = signTray(claims);
    strict_1.default.equal((await verifyTray(rawQrPayload)).status, 'VALID');
    strict_1.default.equal(readTray(rawQrPayload + 'x'), null);
    strict_1.default.equal((await verifyTray('TKT-test:1:fake')).status, 'INVALID_HASH');
    strict_1.default.equal((await verifyTray(signTray({ ...claims, version: 2 }))).status, 'SUPERSEDED');
    await pool.query("INSERT INTO ehr_reconciliation_queue VALUES ('q','r1','PENDING_TRIAGE')");
    strict_1.default.notEqual((await verifyTray(rawQrPayload)).status, 'VALID');
    await pool.query('DELETE FROM ehr_reconciliation_queue');
    await pool.query("UPDATE recipes SET iddsi_level = 4");
    strict_1.default.notEqual((await verifyTray(rawQrPayload)).status, 'VALID');
    await pool.query("UPDATE recipes SET iddsi_level = 7");
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((req, _res, next) => { req.userRole = 'staff'; next(); });
    app.use('/trayruns', trayrunsRouter);
    app.use((err, _req, res, _next) => res.status(400).json({ error: err.message }));
    const server = app.listen(0);
    const address = server.address();
    const post = (body) => fetch(`http://127.0.0.1:${address.port}/trayruns/run1/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    try {
        strict_1.default.equal((await post({ residentId: 'r1', event: 'assembled' })).status, 400);
        strict_1.default.equal((await post({ rawQrPayload, event: 'assembled' })).status, 201);
        await pool.query('UPDATE residents SET is_npo = 1');
        strict_1.default.equal((await post({ rawQrPayload, event: 'dispatched' })).status, 409);
        strict_1.default.equal((await pool.query('SELECT * FROM tray_events')).rows.length, 1);
        await pool.query('UPDATE residents SET is_npo = 0');
        await pool.query('DROP TABLE ehr_reconciliation_queue');
        await strict_1.default.rejects(() => verifyTray(rawQrPayload));
        strict_1.default.equal((await post({ rawQrPayload, event: 'dispatched' })).status, 400);
        strict_1.default.equal((await pool.query('SELECT * FROM tray_events')).rows.length, 1);
    }
    finally {
        await new Promise(resolve => server.close(() => resolve()));
        await pool.end();
    }
});
