"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tenantContext_1 = require("./middleware/tenantContext");
const requireAuth_1 = require("./middleware/requireAuth");
(0, node_test_1.test)('single-facility boundary rejects foreign credentials and header switching', async () => {
    process.env.JWT_SECRET = node_crypto_1.default.randomBytes(32).toString('hex');
    process.env.SHORELINE_FACILITY_ID = 'facility-a';
    const token = (facilityId, platformAdmin = false) => jsonwebtoken_1.default.sign({
        sub: 'synthetic-user', role: 'admin', purpose: 'access', mfa: true,
        facilityId, platformAdmin,
    }, process.env.JWT_SECRET, { audience: 'shoreline-api', expiresIn: '5m' });
    const app = (0, express_1.default)();
    app.use(tenantContext_1.tenantContextMiddleware);
    app.get('/records', requireAuth_1.requireAuth, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/records`;
    try {
        for (const owner of [false, true]) {
            const local = token('facility-a', owner);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}` } })).status, 200);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${token('facility-b', owner)}` } })).status, 403);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-b' } })).status, 403);
            strict_1.default.equal((await fetch(url, { headers: { Authorization: `Bearer ${local}`, 'X-Facility-Id': 'facility-a' } })).status, 200);
        }
        strict_1.default.equal((await fetch(url)).status, 401);
        strict_1.default.equal((await fetch(url, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
    }
    finally {
        await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        delete process.env.SHORELINE_FACILITY_ID;
    }
});
