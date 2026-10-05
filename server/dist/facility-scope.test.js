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
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.SQLITE_PATH = node_path_1.default.join((0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'shoreline-facility-scope-')), 'test.sqlite');
(0, node_test_1.test)('single-facility boundary rejects foreign credentials and header switching', async () => {
    process.env.JWT_SECRET = node_crypto_1.default.randomBytes(32).toString('hex');
    process.env.SHORELINE_FACILITY_ID = 'facility-a';
    const { tenantContextMiddleware } = await Promise.resolve().then(() => __importStar(require('./middleware/tenantContext')));
    const { requireAuth } = await Promise.resolve().then(() => __importStar(require('./middleware/requireAuth')));
    const { runMigrations } = await Promise.resolve().then(() => __importStar(require('./db/migrate')));
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { issueTestAccessToken } = await Promise.resolve().then(() => __importStar(require('./test-support/accessToken')));
    await runMigrations();
    const token = (facilityId, platformAdmin = false) => issueTestAccessToken({
        sub: `synthetic-${facilityId}-${platformAdmin}`, role: 'admin', mfa: true,
        facilityId, platformAdmin,
    });
    const app = (0, express_1.default)();
    app.use(tenantContextMiddleware);
    app.get('/records', requireAuth, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/records`;
    try {
        for (const owner of [false, true]) {
            const local = await token('facility-a', owner);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}` } })).status, 200);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${await token('facility-b', owner)}` } })).status, 403);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-b' } })).status, 403);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-a' } })).status, 200);
        }
        strict_1.default.equal((await fetch(url)).status, 401);
        strict_1.default.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    }
    finally {
        await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        await pool.end();
        delete process.env.SHORELINE_FACILITY_ID;
    }
});
