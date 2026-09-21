"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
exports.menuRouter = (0, express_1.Router)();
// ── Zod schemas ───────────────────────────────────────────────────────────────
const MealEntrySchema = zod_1.z.object({
    itemIds: zod_1.z.array(zod_1.z.string()).default([]),
    label: zod_1.z.string().optional(),
});
// B08: canonical slot list — Breakfast / Lunch / Dinner + snack slots, aligned
// with the shared meal vocabulary. eveningSnack is optional so week payloads
// written before B08 (5-slot days) still validate.
const MEAL_SLOTS = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'eveningSnack'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DayMenuSchema = zod_1.z.object(Object.fromEntries(MEAL_SLOTS.map(s => [s, s === 'eveningSnack' ? MealEntrySchema.optional() : MealEntrySchema])));
const WeekBodySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    effectiveFrom: zod_1.z.string().optional(),
    active: zod_1.z.boolean().default(false),
    days: zod_1.z.record(zod_1.z.string(), DayMenuSchema).default({}),
});
const ItemBodySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    notes: zod_1.z.string().default(''),
    textureModified: zod_1.z.boolean().default(false),
});
// ── Mappers ────────────────────────────────────────────────────────────────────
function toWeek(row) {
    return {
        id: row.id,
        name: row.name,
        effectiveFrom: row.effective_from ?? undefined,
        days: row.days,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toItem(row) {
    return {
        id: row.id,
        name: row.name,
        notes: row.notes || undefined,
        textureModified: row.texture_modified,
    };
}
// ════════════════════════════════════════════════════════════════════════════
// WEEKS
// ════════════════════════════════════════════════════════════════════════════
// GET /api/menu/weeks
exports.menuRouter.get('/weeks', async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM menu_weeks ORDER BY created_at DESC');
        res.json(rows.map(toWeek));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/menu/weeks/:id
exports.menuRouter.get('/weeks/:id', async (req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM menu_weeks WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Menu week not found' });
        res.json(toWeek(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/menu/weeks
exports.menuRouter.post('/weeks', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = WeekBodySchema.parse(req.body);
        const { rows } = await pool_1.pool.query(`INSERT INTO menu_weeks (name, effective_from, days, active)
       VALUES ($1, $2, $3, $4) RETURNING *`, [data.name, data.effectiveFrom ?? null, JSON.stringify(data.days), data.active]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_MENU_WEEK', $1, $2, 'menu_week', 'success')`, [req.userId, rows[0].id]);
        res.status(201).json(toWeek(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/menu/weeks/:id
exports.menuRouter.put('/weeks/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = WeekBodySchema.partial().parse(req.body);
        const { rows: existing } = await pool_1.pool.query('SELECT id FROM menu_weeks WHERE id = $1', [req.params.id]);
        if (!existing[0])
            return res.status(404).json({ error: 'Menu week not found' });
        const { rows } = await pool_1.pool.query(`UPDATE menu_weeks SET
         name           = COALESCE($1, name),
         effective_from = COALESCE($2, effective_from),
         days           = COALESCE($3, days),
         active         = COALESCE($4, active),
         updated_at     = NOW()
       WHERE id = $5 RETURNING *`, [
            data.name ?? null,
            data.effectiveFrom ?? null,
            data.days ? JSON.stringify(data.days) : null,
            data.active ?? null,
            req.params.id,
        ]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_MENU_WEEK', $1, $2, 'menu_week', 'success')`, [req.userId, req.params.id]);
        res.json(toWeek(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/menu/weeks/:id
exports.menuRouter.delete('/weeks/:id', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT id FROM menu_weeks WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Menu week not found' });
        await pool_1.pool.query('DELETE FROM menu_weeks WHERE id = $1', [req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_MENU_WEEK', $1, $2, 'menu_week', 'success')`, [req.userId, req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
// POST /api/menu/weeks/:id/activate
// Atomically marks one week active and deactivates all others.
exports.menuRouter.post('/weeks/:id/activate', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const { rows: existing } = await pool_1.pool.query('SELECT id FROM menu_weeks WHERE id = $1', [req.params.id]);
        if (!existing[0])
            return res.status(404).json({ error: 'Menu week not found' });
        await pool_1.pool.query('UPDATE menu_weeks SET active = false, updated_at = NOW()');
        const { rows } = await pool_1.pool.query('UPDATE menu_weeks SET active = true, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('ACTIVATE_MENU_WEEK', $1, $2, 'menu_week', 'success')`, [req.userId, req.params.id]);
        res.json(toWeek(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// ════════════════════════════════════════════════════════════════════════════
// ITEMS
// ════════════════════════════════════════════════════════════════════════════
// GET /api/menu/items
exports.menuRouter.get('/items', async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM menu_items ORDER BY name ASC');
        res.json(rows.map(toItem));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/menu/items
exports.menuRouter.post('/items', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = ItemBodySchema.parse(req.body);
        const { rows } = await pool_1.pool.query(`INSERT INTO menu_items (name, notes, texture_modified)
       VALUES ($1, $2, $3) RETURNING *`, [data.name, data.notes, data.textureModified]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_MENU_ITEM', $1, $2, 'menu_item', 'success')`, [req.userId, rows[0].id]);
        res.status(201).json(toItem(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/menu/items/:id
exports.menuRouter.put('/items/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = ItemBodySchema.partial().parse(req.body);
        const { rows: existing } = await pool_1.pool.query('SELECT id FROM menu_items WHERE id = $1', [req.params.id]);
        if (!existing[0])
            return res.status(404).json({ error: 'Menu item not found' });
        const { rows } = await pool_1.pool.query(`UPDATE menu_items SET
         name             = COALESCE($1, name),
         notes            = COALESCE($2, notes),
         texture_modified = COALESCE($3, texture_modified),
         updated_at       = NOW()
       WHERE id = $4 RETURNING *`, [data.name ?? null, data.notes ?? null, data.textureModified ?? null, req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_MENU_ITEM', $1, $2, 'menu_item', 'success')`, [req.userId, req.params.id]);
        res.json(toItem(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/menu/items/:id
exports.menuRouter.delete('/items/:id', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT id FROM menu_items WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Menu item not found' });
        await pool_1.pool.query('DELETE FROM menu_items WHERE id = $1', [req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_MENU_ITEM', $1, $2, 'menu_item', 'success')`, [req.userId, req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
