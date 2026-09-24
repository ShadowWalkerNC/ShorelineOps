"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HYDRATION_PASS_TARGET_OZ = exports.HYDRATION_PASSES = exports.KITCHEN_DEFAULT_ENTREE = exports.CANONICAL_SNACK_SLOTS = exports.CANONICAL_MEALS = exports.kitchenRouter = void 0;
const traySafety_1 = require("../engine/traySafety");
const express_1 = require("express");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
const census_1 = require("../db/census");
const crypto_1 = require("crypto");
exports.kitchenRouter = (0, express_1.Router)();
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// ── B08: canonical meal-slot enum ───────────────────────────────────────────
// One meal vocabulary everywhere: Breakfast / Lunch / Dinner (+ snack slots).
// Legacy stored rows use 'Supper'; they are mapped to 'Dinner' at READ time
// (in /sheet below and in the sheet page's clinical join) — never dropped,
// never rewritten. /orders keeps raw keys because B02's OrderEntryPage reads
// 'Supper' keys literally.
exports.CANONICAL_MEALS = ['Breakfast', 'Lunch', 'Dinner'];
exports.CANONICAL_SNACK_SLOTS = ['morningSnack', 'afternoonSnack', 'eveningSnack'];
const MEALS = exports.CANONICAL_MEALS;
exports.KITCHEN_DEFAULT_ENTREE = 'NO SELECTION — CONFIRM WITH DIETARY';
// B08: read-time legacy mapping — stored 'Supper' rows count as 'Dinner'.
// Portable CASE expression works on both SQLite and PostgreSQL.
const mealMatch = (col) => `CASE WHEN ${col} = 'Supper' THEN 'Dinner' ELSE ${col} END = $3`;
// ── GET /api/kitchen/orders ──────────────────────────────────────────────────
// Returns residents + their orders for a given week
exports.kitchenRouter.get('/orders', async (req, res, next) => {
    try {
        const { week } = req.query;
        if (!week)
            return res.status(400).json({ error: 'week query param required (YYYY-MM-DD)' });
        // Order residents by room number numerically (cast to integer if possible, else text sort)
        // B03: active census only — discharged / Hospital / LOA residents are
        // excluded from the weekly order grid.
        const residents = await (0, census_1.activeCensus)({ orderBy: census_1.ROOM_NUMERIC_ORDER });
        const { rows: orders } = await pool_1.pool.query(`
      SELECT wo.*, r.room, r.name
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
    `, [week]);
        // Build lookup map: residentId -> day -> meal -> order
        // B08: keys stay RAW here ('Supper' included) — B02's OrderEntryPage
        // matches meal_type === 'Supper' literally. The /sheet endpoint and the
        // sheet page map legacy 'Supper' rows to 'Dinner' at read time instead.
        const orderMap = {};
        for (const o of orders) {
            if (!orderMap[o.resident_id])
                orderMap[o.resident_id] = {};
            if (!orderMap[o.resident_id][o.day_of_week])
                orderMap[o.resident_id][o.day_of_week] = {};
            orderMap[o.resident_id][o.day_of_week][o.meal_type] = {
                choice_selected: o.choice_selected,
                modifier_text: o.modifier_text,
                is_alternative: o.is_alternative === 1,
                is_declined: o.is_declined === 1
            };
        }
        res.json({ residents, orderMap, week });
    }
    catch (err) {
        next(err);
    }
});
// ── PUT /api/kitchen/orders ──────────────────────────────────────────────────
// Update a single order cell
exports.kitchenRouter.put('/orders', async (req, res, next) => {
    try {
        const { resident_id, week_start_date, day_of_week, meal_type, choice_selected = null, modifier_text = '', is_alternative = 0, is_declined = 0 } = req.body;
        if (!resident_id || !week_start_date || !day_of_week || !meal_type) {
            return res.status(400).json({ error: 'resident_id, week_start_date, day_of_week, meal_type required' });
        }
        await pool_1.pool.query(`
      INSERT INTO weekly_orders
        (resident_id, week_start_date, day_of_week, meal_type, choice_selected, modifier_text, is_alternative, is_declined)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (resident_id, week_start_date, day_of_week, meal_type)
      DO UPDATE SET
        choice_selected = EXCLUDED.choice_selected,
        modifier_text   = EXCLUDED.modifier_text,
        is_alternative  = EXCLUDED.is_alternative,
        is_declined     = EXCLUDED.is_declined
    `, [
            resident_id, week_start_date, day_of_week, meal_type,
            choice_selected, modifier_text,
            is_alternative ? 1 : 0,
            is_declined ? 1 : 0
        ]);
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/kitchen/orders/initialize-week ─────────────────────────────────
// Pre-fill orders for a week with standing alternatives or Choice 1
exports.kitchenRouter.post('/orders/initialize-week', async (req, res, next) => {
    try {
        const { week } = req.body;
        if (!week)
            return res.status(400).json({ error: 'week required (YYYY-MM-DD)' });
        // B03: pre-fill orders for Active residents only — initializing orders for
        // discharged / Hospital / LOA residents would inflate production counts.
        const residents = await (0, census_1.activeCensus)();
        const client = await pool_1.pool.connect();
        try {
            await client.query('BEGIN');
            for (const r of residents) {
                for (const day of DAYS) {
                    for (const meal of MEALS) {
                        const isAlt = r.has_standing_alternative === 1;
                        await client.query(`
              INSERT INTO weekly_orders
                (resident_id, week_start_date, day_of_week, meal_type, choice_selected, modifier_text, is_alternative, is_declined)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (resident_id, week_start_date, day_of_week, meal_type) DO NOTHING
            `, [
                            r.id, week, day, meal,
                            isAlt ? null : 1,
                            isAlt ? (r.alternative_description || '') : '',
                            isAlt ? 1 : 0,
                            0
                        ]);
                    }
                }
            }
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        res.json({ success: true, week, count: residents.length });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/kitchen/sheet ───────────────────────────────────────────────────
// Returns daily tallies, exception lists, and standing alternatives
exports.kitchenRouter.get('/sheet', async (req, res, next) => {
    try {
        const { week, day, meal } = req.query;
        if (!week || !day || !meal) {
            return res.status(400).json({ error: 'week, day, and meal query params required' });
        }
        // Standard tallies (no alternatives, no declined)
        // B03: count only Active residents — order rows belonging to discharged /
        // Hospital / LOA residents must not inflate the production tally.
        const { rows: tallyRows } = await pool_1.pool.query(`
      SELECT choice_selected, COUNT(*) as count
      FROM weekly_orders
      WHERE week_start_date = $1
        AND day_of_week     = $2
        AND ${mealMatch('meal_type')}
        AND is_alternative  = 0
        AND is_declined     = 0
        AND choice_selected IS NOT NULL
        AND resident_id IN (SELECT id FROM residents WHERE ${(0, census_1.activeResidentWhere)()})
      GROUP BY choice_selected
    `, [week, day, meal]);
        const tally = { choice1: 0, choice2: 0 };
        for (const row of tallyRows) {
            if (row.choice_selected === 1)
                tally.choice1 = parseInt(row.count);
            if (row.choice_selected === 2)
                tally.choice2 = parseInt(row.count);
        }
        // Modifiers / exceptions
        // B03: Active residents only.
        const { rows: modifiers } = await pool_1.pool.query(`
      SELECT r.room as room_number, r.name, wo.choice_selected, wo.modifier_text
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
        AND wo.day_of_week     = $2
        AND ${mealMatch('wo.meal_type')}
        AND wo.is_alternative  = 0
        AND wo.is_declined     = 0
        AND TRIM(wo.modifier_text) != ''
        AND ${(0, census_1.activeResidentWhere)('r')}
      ORDER BY
        CASE
          -- B08: portable numeric-room check (the PostgreSQL regex operator is
          -- unsupported on SQLite; TRIM of all digits works on both).
          WHEN r.room <> '' AND TRIM(r.room, '0123456789') = '' THEN CAST(r.room AS INTEGER)
          ELSE 999999
        END,
        r.room
    `, [week, day, meal]);
        // Alternatives
        // B03: Active residents only.
        const { rows: alternatives } = await pool_1.pool.query(`
      SELECT r.room as room_number, r.name, r.alternative_description, wo.modifier_text
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
        AND wo.day_of_week     = $2
        AND ${mealMatch('wo.meal_type')}
        AND wo.is_alternative  = 1
        AND ${(0, census_1.activeResidentWhere)('r')}
      ORDER BY
        CASE
          -- B08: portable numeric-room check (the PostgreSQL regex operator is
          -- unsupported on SQLite; TRIM of all digits works on both).
          WHEN r.room <> '' AND TRIM(r.room, '0123456789') = '' THEN CAST(r.room AS INTEGER)
          ELSE 999999
        END,
        r.room
    `, [week, day, meal]);
        // Declined
        // B03: Active residents only.
        const { rows: declined } = await pool_1.pool.query(`
      SELECT r.room as room_number, r.name
      FROM weekly_orders wo
      JOIN residents r ON r.id = wo.resident_id
      WHERE wo.week_start_date = $1
        AND wo.day_of_week     = $2
        AND ${mealMatch('wo.meal_type')}
        AND wo.is_declined     = 1
        AND ${(0, census_1.activeResidentWhere)('r')}
      ORDER BY
        CASE
          -- B08: portable numeric-room check (the PostgreSQL regex operator is
          -- unsupported on SQLite; TRIM of all digits works on both).
          WHEN r.room <> '' AND TRIM(r.room, '0123456789') = '' THEN CAST(r.room AS INTEGER)
          ELSE 999999
        END,
        r.room
    `, [week, day, meal]);
        // Meal options
        const { rows: mealOptions } = await pool_1.pool.query(`
      SELECT choice_number, dish_name
      FROM meal_options
      WHERE week_start_date = $1 AND day_of_week = $2 AND ${mealMatch('meal_type')}
      ORDER BY choice_number
    `, [week, day, meal]);
        // B03: headcount is the active census, not every row ever admitted.
        const totalResidents = await (0, census_1.activeCensusCount)();
        const summary = {
            total_standard: tally.choice1 + tally.choice2,
            total_alternatives: alternatives.length,
            total_declined: declined.length,
            total_residents: totalResidents
        };
        res.json({ tally, modifiers, alternatives, declined, mealOptions, summary, week, day, meal });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/kitchen/meals ───────────────────────────────────────────────────
exports.kitchenRouter.get('/meals', async (req, res, next) => {
    try {
        const { week, day } = req.query;
        if (!week)
            return res.status(400).json({ error: 'week required (YYYY-MM-DD)' });
        let query = 'SELECT * FROM meal_options WHERE week_start_date = $1';
        const params = [week];
        if (day) {
            query += ' AND day_of_week = $2';
            params.push(day);
        }
        query += ' ORDER BY day_of_week, meal_type, choice_number';
        const { rows } = await pool_1.pool.query(query, params);
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/kitchen/meals/batch ────────────────────────────────────────────
exports.kitchenRouter.post('/meals/batch', async (req, res, next) => {
    try {
        const { options } = req.body;
        if (!Array.isArray(options))
            return res.status(400).json({ error: 'options array required' });
        const client = await pool_1.pool.connect();
        try {
            await client.query('BEGIN');
            for (const o of options) {
                await client.query(`
          INSERT INTO meal_options (week_start_date, day_of_week, meal_type, choice_number, dish_name)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (week_start_date, day_of_week, meal_type, choice_number)
          DO UPDATE SET dish_name = EXCLUDED.dish_name
        `, [o.week_start_date, o.day_of_week, o.meal_type, o.choice_number, o.dish_name]);
            }
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        res.json({ success: true, count: options.length });
    }
    catch (err) {
        next(err);
    }
});
const production_1 = require("../engine/production");
/**
 * C05: resolve each resident's entrée for a service date from their REAL
 * weekly choice (weekly_orders → meal_options dish name).
 *
 * Resolution order per resident (Opt1 is the standing default):
 *   1. declined           → kitchen default entrée (nothing to serve a choice from)
 *   2. standing alternative → their modifier_text (their actual alternative dish)
 *   3. weekly_orders choice_selected (1/2) → meal_options dish for that choice
 *   4. Opt1 fallback       → meal_options dish for choice 1
 *   5. explicit `entree` query param (kitchen override)
 *   6. 'NO SELECTION — CONFIRM WITH DIETARY' last-resort default (labelled as such)
 *
 * NPO / allergen handling is unchanged — the engine still blocks NPO
 * entrées and flags allergies after this resolution.
 */
function normalizeMealType(mealSlot) {
    const s = String(mealSlot ?? '').trim().toLowerCase();
    if (s === 'supper')
        return 'Dinner';
    const cap = s.charAt(0).toUpperCase() + s.slice(1);
    return ['Breakfast', 'Lunch', 'Dinner'].includes(cap) ? cap : null;
}
/**
 * GET /api/kitchen/traycards-generated
 * Dynamically generates full high-contrast clinical tray cards with resident room,
 * table assignment, diet orders, bold red allergy alerts, and IDDSI texture banners.
 */
exports.kitchenRouter.get('/traycards-generated', async (req, res, next) => {
    try {
        const { mealSlot = 'Dinner', serviceDate = new Date().toISOString().slice(0, 10), sides = 'Steamed Broccoli, Mashed Potatoes', } = req.query;
        // Explicit kitchen override — honoured only when the real-choice chain
        // has nothing to serve; never presented as data.
        const entreeParam = typeof req.query.entree === 'string' && req.query.entree.trim() !== ''
            ? String(req.query.entree)
            : null;
        // B01: full clinical columns — the engine must see real NPO status,
        // fluid restrictions, and profile versions (stale defaults caused
        // cards to print with isNpo=false, profileVersion=1).
        // B03: active census only — discharged / Hospital / LOA residents get no
        // tray cards. (servingLocation is kept for dining-room vs room-tray
        // routing; it is NOT a census filter.)
        const residentRows = await (0, census_1.activeCensus)({
            columns: `id, name, room, table_assignment, serving_location, diet_type, texture,
             portion_size, allergies, beverages, special_instructions, dislikes,
             is_npo, npo_reason, fluid_restriction_ml, profile_version, status`,
            orderBy: 'room ASC',
        });
        const profiles = residentRows.map(r => ({
            id: r.id,
            name: r.name,
            room: r.room,
            tableAssignment: r.table_assignment,
            servingLocation: r.serving_location,
            dietType: r.diet_type,
            texture: r.texture,
            portionSize: r.portion_size,
            allergies: r.allergies || [],
            beverages: r.beverages || [],
            specialInstructions: r.special_instructions,
            dislikes: r.dislikes,
            status: r.status,
            isNpo: Boolean(r.is_npo),
            npoReason: r.npo_reason ?? undefined,
            fluidRestrictionMl: r.fluid_restriction_ml ?? undefined,
            profileVersion: r.profile_version ?? 1,
        }));
        const sideArray = typeof sides === 'string' ? sides.split(',').map(s => s.trim()) : [];
        // ── C05: per-resident entrée from their real weekly choice ────────────
        const mealType = normalizeMealType(String(mealSlot));
        const weekStart = production_1.KitchenProductionEngine.weekStartFor(String(serviceDate));
        const dayName = production_1.KitchenProductionEngine.dayNameFor(String(serviceDate));
        const orderByResident = new Map();
        const dishByChoice = new Map();
        if (mealType) {
            const { rows: orderRows } = await pool_1.pool.query(`SELECT wo.resident_id, wo.choice_selected, wo.is_alternative, wo.is_declined, wo.modifier_text
         FROM weekly_orders wo
         WHERE wo.week_start_date = $1
           AND wo.day_of_week = $2
           AND ${production_1.KitchenProductionEngine.mealTypeMatch('wo.meal_type', '$3')}`, [weekStart, dayName, mealType]);
            for (const o of orderRows)
                orderByResident.set(String(o.resident_id), o);
            const { rows: optionRows } = await pool_1.pool.query(`SELECT choice_number, dish_name FROM meal_options
         WHERE week_start_date = $1 AND day_of_week = $2
           AND ${production_1.KitchenProductionEngine.mealTypeMatch('meal_type', '$3')}`, [weekStart, dayName, mealType]);
            for (const o of optionRows) {
                // Legacy 'Supper' rows are Dinner at read time; meal_typeMatch already
                // normalises the filter, so keys here are canonical.
                dishByChoice.set(Number(o.choice_number), String(o.dish_name));
            }
        }
        const resolveEntree = (profile) => {
            const order = orderByResident.get(String(profile.id));
            if (order) {
                if (Number(order.is_declined) === 1) {
                    return {
                        entree: entreeParam ?? exports.KITCHEN_DEFAULT_ENTREE,
                        entreeSource: entreeParam ? 'explicit-param (resident declined)' : 'no-selection-fallback (resident declined)',
                    };
                }
                if (Number(order.is_alternative) === 1 && String(order.modifier_text ?? '').trim() !== '') {
                    return { entree: String(order.modifier_text), entreeSource: 'standing-alternative' };
                }
                const choice = Number(order.choice_selected) === 2 ? 2 : 1; // Opt1 fallback
                const dish = dishByChoice.get(choice) ?? dishByChoice.get(1);
                if (dish) {
                    const chosen = Number(order.choice_selected) === 2 ? 'resident-choice-opt2' : 'resident-choice-opt1';
                    return { entree: dish, entreeSource: dishByChoice.has(choice) ? chosen : 'opt1-fallback' };
                }
            }
            // No usable order row or no meal_options wiring for this slot.
            if (entreeParam)
                return { entree: entreeParam, entreeSource: 'explicit-param' };
            return { entree: exports.KITCHEN_DEFAULT_ENTREE, entreeSource: 'no-selection-fallback' };
        };
        // generateTrayCards is per-resident so each card carries that resident's
        // resolved entrée; NPO hard-blocks and allergen flags stay inside the
        // engine and apply to every card regardless of resolution.
        const cards = profiles.flatMap(profile => {
            const { entree, entreeSource } = resolveEntree(profile);
            const [card] = production_1.KitchenProductionEngine.generateTrayCards([profile], {
                mealSlot: String(mealSlot),
                serviceDate: String(serviceDate),
                entreeName: entree,
                sideNames: sideArray,
            });
            return [{ ...card, entreeSource }];
        });
        res.json({
            serviceDate,
            mealSlot,
            totalCards: cards.length,
            trayCards: cards,
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/kitchen/batch-scale
 * Scales a master recipe for kitchen batch worksheets
 */
exports.kitchenRouter.post('/batch-scale', (req, res) => {
    try {
        const { recipe, portions = 50, texture = 'Regular' } = req.body;
        if (!recipe || !recipe.ingredients) {
            return res.status(400).json({ error: 'recipe object with ingredients required' });
        }
        const scaled = production_1.KitchenProductionEngine.scaleRecipeForBatch(recipe, portions, texture);
        res.json(scaled);
    }
    catch (err) {
        res.status(400).json({ error: err.message || 'Batch scale failed' });
    }
});
/**
 * POST /api/kitchen/explode-recipe-variants
 * Explodes a base recipe into Regular, Pureed L4, Minced & Moist L5, NAS, and NCS batch prep sheets
 *
 * B07: `headcounts` is optional. Omit it (or omit individual keys) and the
 * server derives variant headcounts from the active census × diet orders via
 * KitchenProductionEngine.deriveVariantHeadcounts. Explicit values override
 * the derivation per-key; omitted keys fall back to the derived count.
 */
// B07: an explicit headcount override must be a non-negative finite number —
// anything else defers to the census-derived count for that bucket.
function isCountValue(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}
function toPortionCount(v, derived) {
    return isCountValue(v) ? Math.floor(v) : derived;
}
exports.kitchenRouter.post('/explode-recipe-variants', async (req, res, next) => {
    try {
        const { recipe, headcounts, mealSlot } = req.body;
        if (!recipe || !recipe.ingredients) {
            return res.status(400).json({ error: 'recipe object with ingredients required' });
        }
        // B07: validate the meal slot against B08's canonical vocabulary.
        // Legacy stored 'Supper' rows read as 'Dinner' (B08 read-time mapping).
        // The slot is provenance only — diet/texture orders do not vary by meal.
        let slot = typeof mealSlot === 'string' && mealSlot.trim() ? mealSlot.trim() : 'Lunch';
        if (slot === 'Supper')
            slot = 'Dinner';
        if (!exports.CANONICAL_MEALS.includes(slot)) {
            return res.status(400).json({
                error: `mealSlot must be one of ${exports.CANONICAL_MEALS.join(', ')} (legacy 'Supper' accepted as 'Dinner')`,
            });
        }
        // Derive census-based headcounts (B03 active census; NPO excluded — hard block).
        const derived = await production_1.KitchenProductionEngine.deriveVariantHeadcounts(slot);
        // Explicit values win per-key; the derivation fills the gaps.
        const counts = {
            regularCount: toPortionCount(headcounts?.regularCount, derived.regularCount),
            pureedCount: toPortionCount(headcounts?.pureedCount, derived.pureedCount),
            mincedCount: toPortionCount(headcounts?.mincedCount, derived.mincedCount),
            nasCount: toPortionCount(headcounts?.nasCount, derived.nasCount),
            ncsCount: toPortionCount(headcounts?.ncsCount, derived.ncsCount),
        };
        const overriddenKeys = ['regularCount', 'pureedCount', 'mincedCount', 'nasCount', 'ncsCount']
            .filter(k => isCountValue(headcounts?.[k]));
        const result = production_1.KitchenProductionEngine.explodeRecipeVariants(recipe, counts);
        res.json({
            ...result,
            mealSlot: slot,
            headcountSource: overriddenKeys.length > 0 ? 'override' : 'derived',
            overriddenKeys,
            headcounts: counts,
            headcountBreakdown: derived,
        });
    }
    catch (err) {
        next(err);
    }
});
/**
 * POST /api/kitchen/verify-tray-scan
 * Verifies signed tray card QR scans at assembly station, locking out superseded stale cards or NPO residents
 */
exports.kitchenRouter.post('/verify-tray-scan', async (req, res, next) => {
    try {
        const result = await (0, traySafety_1.verifyTray)(req.body.rawQrPayload);
        const { claims, ...publicResult } = result;
        return res.json({ ...publicResult, ticketId: claims?.ticketId, residentId: claims?.residentId, mealSlot: claims?.mealSlot, serviceDate: claims?.serviceDate });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/kitchen/hydration ───────────────────────────────────────────────
// B05: real hydration-pass roster for CMS F807 compliance — the active census
// joined to TODAY's persisted hydration_records. There is NO fabrication:
// residents with no record yet show consumedOz/offeredOz as null (not
// invented numbers), and acceptance percentages are never computed here.
exports.HYDRATION_PASSES = ['morning', 'afternoon', 'evening'];
/** Default per-pass fluid target when a resident has no individualized target. */
exports.HYDRATION_PASS_TARGET_OZ = 8;
/** UTC calendar-day window for "today's" records (portable: TEXT on SQLite, TIMESTAMPTZ on pg). */
function dayWindow(day) {
    const d = new Date(`${day}T00:00:00Z`);
    const next = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    const iso = (t) => t.toISOString().slice(0, 10);
    return [`${day} 00:00:00`, `${iso(next)} 00:00:00`];
}
function normalizeRecord(r) {
    return {
        id: r.id,
        residentId: r.resident_id,
        pass: r.pass,
        targetOz: parseFloat(r.target_oz ?? 0),
        offeredOz: r.offered_oz == null ? null : parseFloat(r.offered_oz),
        consumedOz: r.consumed_oz == null ? null : parseFloat(r.consumed_oz),
        refused: Boolean(r.refused),
        supplement: r.supplement ?? '',
        recordedBy: r.recorded_by ?? null,
        recordedAt: r.recorded_at,
    };
}
exports.kitchenRouter.get('/hydration', async (req, res, next) => {
    try {
        const pass = String(req.query.pass ?? 'morning');
        if (!exports.HYDRATION_PASSES.includes(pass)) {
            return res.status(400).json({ error: `pass must be one of ${exports.HYDRATION_PASSES.join(', ')}` });
        }
        const rawDate = req.query.date;
        const day = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
            ? rawDate
            : new Date().toISOString().slice(0, 10);
        // B03: active census only. NPO residents are excluded from the pass roster
        // entirely — offering oral fluids to an NPO resident is a hard block, not a
        // checklist row. They are counted separately so the UI can say so plainly.
        const residents = await (0, census_1.activeCensus)({
            columns: `id, name, room, texture, ensure_per_day, fluid_restriction_ml, is_npo`,
            orderBy: 'room ASC',
        });
        const npoExcluded = residents.filter(r => r.is_npo).length;
        const rosterResidents = residents.filter(r => !r.is_npo);
        const [dayStart, dayEnd] = dayWindow(day);
        const { rows: recs } = await pool_1.pool.query(`SELECT * FROM hydration_records WHERE recorded_at >= $1 AND recorded_at < $2`, [dayStart, dayEnd]);
        const byResidentPass = new Map();
        for (const r of recs)
            byResidentPass.set(`${r.resident_id}:${r.pass}`, r);
        const hydrationRoster = rosterResidents.map(r => {
            const rec = byResidentPass.get(`${r.id}:${pass}`);
            const norm = rec ? normalizeRecord(rec) : null;
            return {
                residentId: r.id,
                residentName: r.name,
                room: r.room,
                liquidTexture: (r.texture ?? '').includes('Pureed') ? 'Thickened Nectar' : 'Regular Water',
                targetOz: norm?.targetOz ?? exports.HYDRATION_PASS_TARGET_OZ,
                offeredOz: norm?.offeredOz ?? null,
                consumedOz: norm?.consumedOz ?? null,
                refused: norm?.refused ?? false,
                supplement: norm?.supplement ?? '',
                ensurePerDay: r.ensure_per_day ?? 0,
                fluidRestrictionMl: r.fluid_restriction_ml ?? null,
                recordedBy: norm?.recordedBy ?? null,
                recordedAt: norm?.recordedAt ?? null,
                // Derived ONLY from real records: never a fabricated percentage.
                status: !norm ? 'NOT_RECORDED' : norm.refused ? 'REFUSED' : 'RECORDED',
            };
        });
        const sum = (rows, key) => rows.reduce((acc, r) => acc + (r[key] == null ? 0 : parseFloat(r[key])), 0);
        const passRecs = recs.filter(r => r.pass === pass);
        const passTotals = {
            targetOz: hydrationRoster.length * exports.HYDRATION_PASS_TARGET_OZ,
            offeredOz: sum(passRecs, 'offered_oz'),
            consumedOz: sum(passRecs, 'consumed_oz'),
            refusedCount: passRecs.filter(r => r.refused).length,
            recordedCount: passRecs.length,
        };
        const dayTotals = {
            offeredOz: sum(recs, 'offered_oz'),
            consumedOz: sum(recs, 'consumed_oz'),
            refusedCount: recs.filter(r => r.refused).length,
            recordedCount: recs.length,
        };
        res.json({ pass, date: day, hydrationRoster, passTotals, dayTotals, npoExcluded, totalResidents: hydrationRoster.length });
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/kitchen/hydration ──────────────────────────────────────────────
// B05: persists one hydration-pass record (offered/consumed/refused per
// resident per pass). Upserts on (resident, pass, day) so a re-logged pass is a
// correction, not a duplicate. NPO is a hard block: never log fluids for an
// NPO resident. Refusals are stored distinctly from zero-consumption.
exports.kitchenRouter.post('/hydration', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const { residentId, pass, offeredOz = 0, consumedOz = 0, refused = false, supplement = '', recordedBy } = req.body ?? {};
        if (!residentId || typeof residentId !== 'string') {
            return res.status(400).json({ error: 'residentId required' });
        }
        if (!exports.HYDRATION_PASSES.includes(pass)) {
            return res.status(400).json({ error: `pass must be one of ${exports.HYDRATION_PASSES.join(', ')}` });
        }
        const offered = Number(offeredOz);
        const consumed = Number(consumedOz);
        if (!Number.isFinite(offered) || offered < 0 || !Number.isFinite(consumed) || consumed < 0) {
            return res.status(400).json({ error: 'offeredOz and consumedOz must be non-negative numbers' });
        }
        if (consumed > offered) {
            return res.status(400).json({ error: 'consumedOz cannot exceed offeredOz' });
        }
        if (refused && consumed > 0) {
            return res.status(400).json({ error: 'a refusal cannot have consumedOz > 0 — record the refusal, not the intake' });
        }
        if (typeof supplement !== 'string' || supplement.length > 100) {
            return res.status(400).json({ error: 'supplement must be a string of at most 100 characters' });
        }
        const { rows: residents } = await pool_1.pool.query('SELECT id, name, status, is_npo FROM residents WHERE id = $1', [residentId]);
        if (!residents[0])
            return res.status(404).json({ error: 'resident not found' });
        if (residents[0].is_npo) {
            return res.status(403).json({ error: 'NPO hard block: oral fluids may not be logged for an NPO resident' });
        }
        if (residents[0].status !== 'Active') {
            return res.status(403).json({ error: 'hydration passes can only be logged for Active residents' });
        }
        const day = new Date().toISOString().slice(0, 10);
        const [dayStart, dayEnd] = dayWindow(day);
        const { rows: existing } = await pool_1.pool.query(`SELECT id FROM hydration_records
       WHERE resident_id = $1 AND pass = $2 AND recorded_at >= $3 AND recorded_at < $4`, [residentId, pass, dayStart, dayEnd]);
        const by = typeof recordedBy === 'string' && recordedBy.trim()
            ? recordedBy.trim()
            : (req.userId ?? 'staff');
        // Portable write: pool.query discards RETURNING rows on the SQLite
        // backend (writes resolve { rows: [] }), so re-read the record.
        const recordId = existing[0]?.id ?? (0, crypto_1.randomUUID)();
        if (existing[0]) {
            await pool_1.pool.query(`UPDATE hydration_records SET
           target_oz = $1, offered_oz = $2, consumed_oz = $3,
           refused = $4, supplement = $5, recorded_by = $6, recorded_at = NOW()
         WHERE id = $7`, [exports.HYDRATION_PASS_TARGET_OZ, offered, consumed, refused ? 1 : 0, supplement, by, recordId]);
        }
        else {
            await pool_1.pool.query(`INSERT INTO hydration_records
           (id, resident_id, pass, target_oz, offered_oz, consumed_oz, refused, supplement, recorded_by, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`, [recordId, residentId, pass, exports.HYDRATION_PASS_TARGET_OZ, offered, consumed, refused ? 1 : 0, supplement, by]);
        }
        const { rows: saved } = await pool_1.pool.query('SELECT * FROM hydration_records WHERE id = $1', [recordId]);
        const record = saved[0];
        if (!record) {
            return res.status(500).json({ error: 'hydration record was not persisted' });
        }
        await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('LOG_HYDRATION_PASS', $1, $2, 'hydration_record', 'success', $3)`, [req.userId ?? null, record.id, JSON.stringify({ residentId, pass, offeredOz: offered, consumedOz: consumed, refused: Boolean(refused), supplement })]);
        res.json({ success: true, corrected: Boolean(existing[0]), record: normalizeRecord(record) });
    }
    catch (err) {
        next(err);
    }
});
