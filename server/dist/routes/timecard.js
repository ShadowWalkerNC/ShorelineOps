"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timecardRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
exports.timecardRouter = (0, express_1.Router)();
const PunchSchema = zod_1.z.object({
    badge_id: zod_1.z.string().min(1).max(64),
    operation: zod_1.z.string(),
    kiosk_id: zod_1.z.string().optional().default('Default'),
    punched_at: zod_1.z.string().optional(),
});
async function forwardPunchToAoD(badgeId, operation) {
    const aodUrl = process.env.AOD_KIOSK_URL;
    if (!aodUrl) {
        // Local logging only when AoD bridge is not configured
        return { success: true, message: 'Punch accepted (local only — AOD_KIOSK_URL not set)' };
    }
    try {
        const opCode = operation === 'In' ? '1' : '2';
        const btnIndex = operation === 'In' ? '0' : '1';
        const kioskId = process.env.AOD_KIOSK_IDENTIFIER || 'Default';
        const params = new URLSearchParams();
        params.append('AE_KioskIdentifier', kioskId);
        params.append('AE_TZ', process.env.AOD_TZ || '240');
        params.append('AE_DS', '0');
        params.append('AE_InDS', '0');
        params.append('AE_Operation', opCode);
        params.append('AE_ButtonIndex', btnIndex);
        params.append('AE_DataValue', badgeId);
        console.log(`[AOD Bridge] Forwarding punch for Badge ${badgeId} (${operation})`);
        const response = await fetch(aodUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'ShorelineOps/1.0',
                Accept: 'text/html,application/xhtml+xml',
            },
            body: params.toString(),
        });
        if (!response.ok) {
            return { success: false, message: `AOD Server returned status ${response.status}` };
        }
        const html = await response.text();
        if (html.toLowerCase().includes('invalid badge') || html.toLowerCase().includes('error')) {
            return { success: false, message: 'Invalid Badge ID or unrecognized credential on Attendance on Demand' };
        }
        return { success: true, message: 'Punch accepted' };
    }
    catch (err) {
        console.error('[AOD Bridge] Error forwarding punch:', err);
        return { success: false, message: `Network error connecting to AOD: ${err.message}` };
    }
}
// POST /api/timecard/webhook — requires KIOSK_API_SECRET
exports.timecardRouter.post('/webhook', async (req, res, next) => {
    try {
        const secret = process.env.KIOSK_API_SECRET;
        if (!secret || secret.length < 16) {
            return res.status(503).json({ error: 'Kiosk webhook disabled — set KIOSK_API_SECRET (min 16 chars)' });
        }
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${secret}`) {
            return res.status(401).json({ error: 'Unauthorized kiosk access' });
        }
        const payload = PunchSchema.parse(req.body);
        const operation = payload.operation === 'In' || payload.operation === 'Out' ? payload.operation : 'In';
        const aodResult = await forwardPunchToAoD(payload.badge_id, operation);
        if (!aodResult.success) {
            return res.status(400).json({ error: aodResult.message });
        }
        const punchedAt = payload.punched_at ? new Date(payload.punched_at) : new Date();
        const { rows } = await pool_1.pool.query(`INSERT INTO timecard_punches (badge_id, operation, kiosk_id, punched_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [payload.badge_id, operation, payload.kiosk_id, punchedAt]);
        res.status(201).json({ success: true, punch: rows[0], message: aodResult.message });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/timecard/punch — direct punch from UI or kiosk
exports.timecardRouter.post('/punch', async (req, res, next) => {
    try {
        const payload = PunchSchema.parse(req.body);
        const operation = payload.operation === 'In' || payload.operation === 'Out' ? payload.operation : 'In';
        const punchedAt = payload.punched_at ? new Date(payload.punched_at) : new Date();
        const id = (0, crypto_1.randomUUID)();
        await pool_1.pool.query(`INSERT INTO timecard_punches (id, badge_id, operation, kiosk_id, punched_at)
       VALUES ($1, $2, $3, $4, $5)`, [id, payload.badge_id, operation, payload.kiosk_id, punchedAt]);
        const { rows } = await pool_1.pool.query('SELECT * FROM timecard_punches WHERE id = $1', [id]);
        res.status(201).json(rows[0] ?? { id, badge_id: payload.badge_id, operation, kiosk_id: payload.kiosk_id, punched_at: punchedAt });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/timecard/last-punch/:badgeId
exports.timecardRouter.get('/last-punch/:badgeId', async (req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM timecard_punches WHERE badge_id = $1 ORDER BY punched_at DESC LIMIT 1', [req.params.badgeId]);
        res.json(rows[0] || null);
    }
    catch (err) {
        next(err);
    }
});
// GET /api/timecard — queryable punches
exports.timecardRouter.get('/', async (req, res, next) => {
    try {
        const badgeId = typeof req.query.badge_id === 'string' ? req.query.badge_id : null;
        const limit = parseInt(req.query.limit || '200', 10) || 200;
        if (badgeId) {
            const { rows } = await pool_1.pool.query('SELECT * FROM timecard_punches WHERE badge_id = $1 ORDER BY punched_at DESC LIMIT $2', [badgeId, limit]);
            return res.json(rows);
        }
        const { rows } = await pool_1.pool.query('SELECT * FROM timecard_punches ORDER BY punched_at DESC LIMIT $1', [limit]);
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
