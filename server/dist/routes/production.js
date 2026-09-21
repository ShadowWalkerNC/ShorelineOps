"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
const production_1 = require("../engine/production");
exports.productionRouter = (0, express_1.Router)();
// ── Zod schemas ───────────────────────────────────────────────────────────────
const SheetUpdateSchema = zod_1.z.object({
    rows: zod_1.z.array(zod_1.z.any()).optional(),
    counts: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
// ── Mappers ────────────────────────────────────────────────────────────────────
function toSheet(row) {
    const parseJson = (v, fallback) => {
        if (v == null)
            return fallback;
        if (typeof v === 'object')
            return v;
        try {
            return JSON.parse(v);
        }
        catch {
            return fallback;
        }
    };
    return {
        id: row.id,
        menuWeekId: row.menu_week_id,
        day: row.day,
        slot: row.slot,
        rows: parseJson(row.rows, []),
        counts: parseJson(row.counts, {}),
        signedOffBy: row.signed_off_by ?? undefined,
        signedOffAt: row.signed_off_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
/**
 * Auto-generate a ProductionSheet from the REAL forecast (C05):
 * active menu week × active census × meal slot, with the census-trend buffer
 * and Opt1/Opt2 splits from real weekly_orders choices.
 *
 * Each row is one scheduled menu item for the slot: its portions come from
 * (census + buffer) × that item's choice share — never a fixed +5, never a
 * blind 50/50. Texture/diet/location counts are still census-derived for the
 * kitchen's batch-planning context.
 */
async function generateSheet(weekId, day, slot) {
    // 1. Build the scheduled-meals forecast for this exact day × slot.
    const forecast = await production_1.KitchenProductionEngine.buildScheduledMeals({
        weekId,
        days: [day],
        slots: [slot],
    });
    // 2. Active census rows for the texture / diet / location breakdowns
    //    (B03: status='Active' only).
    const { rows: residents } = await pool_1.pool.query(`SELECT * FROM residents WHERE status = 'Active' ORDER BY name ASC`);
    const absent = await pool_1.pool.query(`SELECT COUNT(*) FROM residents WHERE status IN ('Hospital', 'LOA')`);
    const mealType = production_1.KitchenProductionEngine.SLOT_TO_MEAL[slot] ?? null;
    const choiceSplit = await production_1.KitchenProductionEngine.computeChoiceSplit(forecast.weekStartDate, day, mealType);
    const counts = {
        // Census-derived roster breakdown (unchanged semantics for the kitchen).
        total: residents.length,
        diningRoom: residents.filter((r) => r.serving_location === 'Dining Room').length,
        room: residents.filter((r) => r.serving_location === 'Room').length,
        assistedLiving: residents.filter((r) => r.serving_location === 'Assisted Living').length,
        memoryCare: residents.filter((r) => r.serving_location === 'Memory Care').length,
        absent: parseInt(absent.rows[0].count, 10),
        // C05 forecast provenance — the dietitian can explain every number.
        census: forecast.census,
        buffer: forecast.buffer,
        trendPct: forecast.trendPct,
        bufferFormula: forecast.bufferFormula,
        forecastPortionsPerSlot: forecast.forecastPortionsPerSlot,
        choiceSplit,
        weekStartDate: forecast.weekStartDate,
        weekName: forecast.weekName,
    };
    // 3. One production row per scheduled menu item.
    const rows = forecast.meals.map(m => {
        const textureCounts = {};
        const dietCounts = {};
        const locationCounts = {};
        for (const r of residents) {
            textureCounts[r.texture] = (textureCounts[r.texture] ?? 0) + 1;
            dietCounts[r.diet_type] = (dietCounts[r.diet_type] ?? 0) + 1;
            locationCounts[r.serving_location] = (locationCounts[r.serving_location] ?? 0) + 1;
        }
        return {
            menuItemId: m.recipeLink.menuItemId,
            menuItemName: m.recipeLink.menuItemName,
            recipeId: m.recipeLink.recipeId,
            recipeName: m.recipeLink.recipeName,
            textureModified: false,
            textureCounts,
            dietCounts,
            locationCounts,
            // C05: the actual cook number — scheduled menu × census, buffered and
            // choice-split, with its derivation attached.
            total: m.projectedPortions,
            projectedPortions: m.projectedPortions,
            forecastNote: m.forecastNote,
        };
    });
    // Items on the menu with no recipe can't be forecasted — surface them so
    // the kitchen knows why they are absent, rather than silently dropping them.
    const skipped = forecast.skippedItems.map(s => ({ ...s }));
    return { rows, counts, skipped, forecast };
}
// ════════════════════════════════════════════════════════════════════════════
// SHEETS
// ════════════════════════════════════════════════════════════════════════════
// GET /api/production/sheets[?weekId=]
exports.productionRouter.get('/sheets', async (req, res, next) => {
    try {
        const weekId = typeof req.query.weekId === 'string' ? req.query.weekId : null;
        let queryResult;
        if (weekId) {
            queryResult = await pool_1.pool.query('SELECT * FROM production_sheets WHERE menu_week_id = $1 ORDER BY day, slot', [weekId]);
        }
        else {
            queryResult = await pool_1.pool.query('SELECT * FROM production_sheets ORDER BY created_at DESC');
        }
        res.json(queryResult.rows.map(toSheet));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/production/sheets
exports.productionRouter.post('/sheets', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const body = req.body;
        const id = body.id || (0, crypto_1.randomUUID)();
        const menuWeekId = body.menuWeekId || body.menu_week_id || 'default';
        const day = body.day || body.date || new Date().toISOString().slice(0, 10);
        const slot = body.slot || body.meal || 'Dinner';
        const rows = body.rows || body.items || [];
        const counts = body.counts || {};
        await pool_1.pool.query(`INSERT INTO production_sheets (id, menu_week_id, day, slot, rows, counts)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (menu_week_id, day, slot) DO UPDATE
         SET rows = EXCLUDED.rows, counts = EXCLUDED.counts, updated_at = NOW()`, [id, menuWeekId, day, slot, JSON.stringify(rows), JSON.stringify(counts)]);
        const { rows: saved } = await pool_1.pool.query('SELECT * FROM production_sheets WHERE id = $1 OR (menu_week_id = $2 AND day = $3 AND slot = $4)', [id, menuWeekId, day, slot]);
        res.status(201).json(toSheet(saved[0]));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/production/sheets/generate?weekId=&day=&slot=
// Returns an existing sheet or auto-generates one on the fly (does NOT persist).
exports.productionRouter.get('/sheets/generate', async (req, res, next) => {
    try {
        const weekId = req.query.weekId;
        const day = req.query.day;
        const slot = req.query.slot;
        if (!weekId || !day || !slot) {
            return res.status(400).json({ error: 'weekId, day, and slot are required' });
        }
        // Check if a saved sheet already exists
        const { rows: existing } = await pool_1.pool.query('SELECT * FROM production_sheets WHERE menu_week_id = $1 AND day = $2 AND slot = $3', [weekId, day, slot]);
        if (existing[0])
            return res.json(toSheet(existing[0]));
        // Generate on-the-fly
        const { rows, counts } = await generateSheet(weekId, day, slot);
        // Persist generated sheet so subsequent GETs are instant.
        // Portable write (B05 inventory pattern): the pool's SQLite path drops
        // RETURNING rows, so write without RETURNING and re-read the row after.
        await pool_1.pool.query(`INSERT INTO production_sheets (menu_week_id, day, slot, rows, counts)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (menu_week_id, day, slot) DO UPDATE
         SET rows = EXCLUDED.rows, counts = EXCLUDED.counts, updated_at = NOW()`, [weekId, day, slot, JSON.stringify(rows), JSON.stringify(counts)]);
        const { rows: saved } = await pool_1.pool.query('SELECT * FROM production_sheets WHERE menu_week_id = $1 AND day = $2 AND slot = $3', [weekId, day, slot]);
        res.json(toSheet(saved[0]));
    }
    catch (err) {
        if (err.status)
            return res.status(err.status).json({ error: err.message });
        next(err);
    }
});
// PUT /api/production/sheets/:id
exports.productionRouter.put('/sheets/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = SheetUpdateSchema.parse(req.body);
        const { rows: existing } = await pool_1.pool.query('SELECT id FROM production_sheets WHERE id = $1', [req.params.id]);
        if (!existing[0])
            return res.status(404).json({ error: 'Production sheet not found' });
        // Portable write: the pool's SQLite path drops RETURNING rows
        // (B05 inventory pattern), so re-read the row after the UPDATE.
        await pool_1.pool.query(`UPDATE production_sheets SET
         rows       = COALESCE($1, rows),
         counts     = COALESCE($2, counts),
         updated_at = NOW()
       WHERE id = $3`, [
            data.rows ? JSON.stringify(data.rows) : null,
            data.counts ? JSON.stringify(data.counts) : null,
            req.params.id,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM production_sheets WHERE id = $1', [req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_PRODUCTION_SHEET', $1, $2, 'production_sheet', 'success')`, [req.userId, req.params.id]);
        res.json(toSheet(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/production/sheets/:id/signoff
exports.productionRouter.post('/sheets/:id/signoff', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const { staffName } = zod_1.z.object({ staffName: zod_1.z.string().min(1) }).parse(req.body);
        const { rows: existing } = await pool_1.pool.query('SELECT id FROM production_sheets WHERE id = $1', [req.params.id]);
        if (!existing[0])
            return res.status(404).json({ error: 'Production sheet not found' });
        // Portable write: the pool's SQLite path drops RETURNING rows
        // (B05 inventory pattern), so re-read the row after the UPDATE.
        await pool_1.pool.query(`UPDATE production_sheets SET
         signed_off_by = $1,
         signed_off_at = NOW(),
         updated_at    = NOW()
       WHERE id = $2`, [staffName, req.params.id]);
        const { rows } = await pool_1.pool.query('SELECT * FROM production_sheets WHERE id = $1', [req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('SIGNOFF_PRODUCTION_SHEET', $1, $2, 'production_sheet', 'success', $3)`, [req.userId, req.params.id, JSON.stringify({ staffName })]);
        res.json(toSheet(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/production/sheets/:id
exports.productionRouter.delete('/sheets/:id', (0, requireAuth_1.requireRole)('admin'), async (req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT id FROM production_sheets WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Production sheet not found' });
        await pool_1.pool.query('DELETE FROM production_sheets WHERE id = $1', [req.params.id]);
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_PRODUCTION_SHEET', $1, $2, 'production_sheet', 'success')`, [req.userId, req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
