"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
exports.auditRouter = (0, express_1.Router)();
const AuditEventSchema = zod_1.z.object({
    action: zod_1.z.string().min(1).max(64),
    resourceId: zod_1.z.string().optional(),
    resourceType: zod_1.z.string().optional(),
    outcome: zod_1.z.enum(['success', 'failure']),
    userAgent: zod_1.z.string().optional(),
    details: zod_1.z.record(zod_1.z.unknown()).optional(),
    // Client-supplied userId is intentionally ignored — always use req.userId
});
// POST /api/audit — authenticated; actor taken from JWT only
exports.auditRouter.post('/', async (req, res, next) => {
    try {
        const event = AuditEventSchema.parse(req.body);
        await pool_1.pool.query(`INSERT INTO audit_log
         (action, user_id, resource_id, resource_type, outcome, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            event.action,
            req.userId ?? null,
            event.resourceId ?? null,
            event.resourceType ?? null,
            event.outcome,
            req.ip,
            event.userAgent ?? req.headers['user-agent'] ?? null,
            event.details ? JSON.stringify(event.details) : null,
        ]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/audit — admin only
exports.auditRouter.get('/', (0, requireAuth_1.requireRole)('admin'), async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500');
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
