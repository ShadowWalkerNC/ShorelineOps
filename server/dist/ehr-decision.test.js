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
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.SQLITE_PATH = node_path_1.default.join((0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'shoreline-ehr-')), 'test.sqlite');
process.env.JWT_SECRET = node_crypto_1.default.randomBytes(32).toString('hex');
(0, node_test_1.test)('EHR decisions apply atomically and retain unresolved work on failure', async (t) => {
    const { pool } = await Promise.resolve().then(() => __importStar(require('./db/pool')));
    const { runMigrations } = await Promise.resolve().then(() => __importStar(require('./db/migrate')));
    const { ehrRouter } = await Promise.resolve().then(() => __importStar(require('./routes/ehr')));
    await runMigrations();
    const user = node_crypto_1.default.randomUUID();
    const resident = node_crypto_1.default.randomUUID();
    await pool.query('INSERT INTO users (id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)', [user, 'Synthetic reviewer', 'reviewer@example.invalid', 'unused', 'dietitian']);
    await pool.query('INSERT INTO residents (id, name, room, allergies) VALUES ($1,$2,$3,$4)', [resident, 'Synthetic resident', 'TEST', ['Milk']]);
    const credential = (role) => jsonwebtoken_1.default.sign({ sub: user, role, purpose: 'access', mfa: true, facilityId: 'default', platformAdmin: false }, process.env.JWT_SECRET, { audience: 'shoreline-api', expiresIn: '5m' });
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use('/api/ehr', ehrRouter);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/ehr`;
    const add = async (type, payload, residentId = resident) => {
        const id = node_crypto_1.default.randomUUID();
        await pool.query('INSERT INTO ehr_reconciliation_queue (id,resident_id,resident_name,external_ehr_id,change_type,incoming_payload,conflict_reason) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, residentId, 'Synthetic resident', 'synthetic', type, JSON.stringify(payload), 'Review required']);
        return id;
    };
    const resolve = (id, body = { action: 'APPROVED_BY_RD' }, role = 'dietitian') => fetch(`${base}/reconciliation-queue/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credential(role)}` }, body: JSON.stringify(body),
    });
    const state = async (id) => (await pool.query('SELECT status FROM ehr_reconciliation_queue WHERE id = $1', [id])).rows[0].status;
    const profile = async () => (await pool.query('SELECT allergies, diet_type, texture, is_npo, profile_version FROM residents WHERE id = $1', [resident])).rows[0];
    try {
        await t.test('allergy approval merges, increments once, and records before/after evidence', async () => {
            const id = await add('NEW_ALLERGEN', { allergies: ['milk', 'Egg', 'egg'] });
            strict_1.default.equal((await resolve(id)).status, 200);
            strict_1.default.deepEqual((await profile()).allergies, ['Milk', 'Egg']);
            strict_1.default.equal((await profile()).profile_version, 2);
            strict_1.default.equal(await state(id), 'APPROVED_BY_RD');
            const audits = await pool.query("SELECT details FROM audit_log WHERE action = 'ehr.reconciliation.resolved'");
            const detail = typeof audits.rows[0].details === 'string' ? JSON.parse(audits.rows[0].details) : audits.rows[0].details;
            strict_1.default.equal(detail.previousProfile.profile_version, 1);
            strict_1.default.equal(detail.appliedProfile.profile_version, 2);
            strict_1.default.equal((await resolve(id)).status, 409);
            strict_1.default.equal((await profile()).profile_version, 2);
        });
        await t.test('queue exposes authoritative comparison and stale review cannot apply', async () => {
            const id = await add('DIET_ORDER', { dietOrder: 'NAS' });
            const response = await fetch(`${base}/reconciliation-queue`, { headers: { Authorization: `Bearer ${credential('dietitian')}` } });
            const data = await response.json();
            strict_1.default.equal(data.items.find(item => item.id === id)?.current_profile.profile_version, 2);
            strict_1.default.equal((await resolve(id, { action: 'APPROVED_BY_RD', expectedProfileVersion: 1 })).status, 409);
            strict_1.default.equal(await state(id), 'PENDING_TRIAGE');
            strict_1.default.equal((await profile()).diet_type, 'Regular');
        });
        await t.test('unsupported, malformed, unlinked and missing-resident changes remain pending', async () => {
            const cases = [
                ['ADMISSION', {}, resident, 400], ['DIET_ORDER', {}, resident, 400],
                ['TEXTURE_UPDATE', [], resident, 400], ['NEW_ALLERGEN', { allergies: [{}] }, resident, 400],
                ['NEW_ALLERGEN', { allergies: [] }, resident, 400], ['NPO_ORDER', {}, null, 400],
                ['DIET_ORDER', { dietOrder: 'NAS' }, node_crypto_1.default.randomUUID(), 404],
            ];
            for (const [type, payload, residentId, status] of cases) {
                const id = await add(type, payload, residentId);
                strict_1.default.equal((await resolve(id)).status, status, type);
                strict_1.default.equal(await state(id), 'PENDING_TRIAGE');
            }
        });
        await t.test('audit failure rolls back resident change and queue status', async () => {
            const id = await add('DIET_ORDER', { dietOrder: 'Renal' });
            const before = await profile();
            await pool.query("CREATE TRIGGER reject_decision_audit BEFORE INSERT ON audit_log WHEN NEW.action = 'ehr.reconciliation.resolved' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END;");
            try {
                strict_1.default.equal((await resolve(id)).status, 500);
                strict_1.default.deepEqual(await profile(), before);
                strict_1.default.equal(await state(id), 'PENDING_TRIAGE');
            }
            finally {
                await pool.query('DROP TRIGGER reject_decision_audit');
            }
        });
        await t.test('concurrent approval commits one version change', async () => {
            const id = await add('TEXTURE_UPDATE', { texture: 'Pureed' });
            const before = await profile();
            const responses = await Promise.all([resolve(id), resolve(id)]);
            strict_1.default.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
            strict_1.default.equal((await profile()).profile_version, before.profile_version + 1);
        });
        await t.test('manager cannot approve; rejection does not change resident', async () => {
            const id = await add('NPO_ORDER', {});
            const before = await profile();
            strict_1.default.equal((await resolve(id, { action: 'APPROVED_BY_RD' }, 'manager')).status, 403);
            strict_1.default.equal(await state(id), 'PENDING_TRIAGE');
            strict_1.default.equal((await resolve(id, { action: 'REJECTED_BY_RD' })).status, 200);
            strict_1.default.deepEqual(await profile(), before);
        });
    }
    finally {
        await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        await pool.end();
    }
});
