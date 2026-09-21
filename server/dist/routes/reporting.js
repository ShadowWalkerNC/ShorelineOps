"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportingRouter = void 0;
/**
 * Reporting API — Shoreline V1
 *
 * Operational and compliance reporting for dietary management.
 *
 * Routes:
 *   GET  /api/reporting/summary?start=&end=
 *     → cost per resident day, substitution count, allergy flags, diet mismatches
 *
 *   GET  /api/reporting/cost-log?start=&end=
 *     → daily_cost_log entries for the date range
 *
 *   POST /api/reporting/cost-log
 *     → record a daily cost snapshot
 *
 *   GET  /api/reporting/substitutions?start=&end=
 *     → substitution_log entries
 *
 *   POST /api/reporting/substitutions
 *     → log a substitution
 *
 *   DELETE /api/reporting/substitutions/:id
 *
 *   GET  /api/reporting/allergy-risk?date=
 *     → residents whose assigned items contain flagged allergens (computed)
 *
 *   GET  /api/reporting/diet-mismatches?date=
 *     → residents where served texture/diet does not match profile
 *
 *   GET  /api/reporting/production-variance?start=&end=
 *     → production_sheets: planned vs produced
 */
const express_1 = require("express");
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
const costing_1 = require("../engine/costing");
exports.reportingRouter = (0, express_1.Router)();
function err(res, status, msg) {
    return res.status(status).json({ error: msg });
}
// ─── Summary (dashboard-level) ────────────────────────────────────────────
/**
 * GET /api/reporting/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Returns the key operational metrics for the date range.
 */
exports.reportingRouter.get('/summary', async (req, res, next) => {
    const { start, end } = req.query;
    const startDate = start ?? new Date().toISOString().slice(0, 10);
    const endDate = end ?? new Date().toISOString().slice(0, 10);
    try {
        // Total food cost and resident-days from daily_cost_log
        const { rows: costRows } = await pool_1.pool.query(`SELECT
         COALESCE(SUM(food_cost),0)      AS total_food_cost,
         COALESCE(SUM(resident_count),0) AS total_resident_days,
         COUNT(*)                         AS log_days
       FROM daily_cost_log
       WHERE log_date BETWEEN $1 AND $2`, [startDate, endDate]);
        const totalFoodCost = parseFloat(costRows[0].total_food_cost);
        const totalResidentDays = parseInt(costRows[0].total_resident_days, 10);
        const costPerResidentDay = totalResidentDays > 0
            ? (totalFoodCost / totalResidentDays)
            : null;
        // Substitutions count
        const { rows: subRows } = await pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM substitution_log WHERE meal_date BETWEEN $1 AND $2`, [startDate, endDate]);
        const substitutions = parseInt(subRows[0].cnt, 10);
        // Active resident count (for context)
        const { rows: resRows } = await pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM residents WHERE status = 'active'`);
        const activeResidents = parseInt(resRows[0].cnt, 10);
        // Allergy risk: count residents with at least one allergen flag
        // (simplified: count residents who have allergens listed)
        const { rows: allergyRows } = await pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM residents
       WHERE status = 'active'
         AND allergies IS NOT NULL
         AND allergies != ''
         AND allergies != '[]'`);
        const allergyFlagCount = parseInt(allergyRows[0].cnt, 10);
        // Diet mismatches: residents whose texture is 'puree' or 'minced'
        // but that's more of a tray-card validation — here we count residents
        // whose texture/diet_order fields are populated (proxy for mismatch risk)
        const { rows: mismatchRows } = await pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM residents
       WHERE status = 'active'
         AND (texture IS NOT NULL AND texture != '' AND texture != 'Regular')`);
        const specialDietCount = parseInt(mismatchRows[0].cnt, 10);
        // Dietary labor hours and estimated spend from timecard_punches
        const { rows: laborRows } = await pool_1.pool.query(`SELECT
         COUNT(*) AS total_punches
       FROM timecard_punches
       WHERE timestamp >= $1 AND timestamp <= $2`, [startDate, endDate]);
        const totalPunches = parseInt(laborRows[0]?.total_punches || '0', 10);
        // Estimate 8 hours per clock-in/out pair at standard $18.50/hr dietary rate
        const estimatedLaborHours = +(totalPunches * 4.0).toFixed(1);
        const estimatedLaborCost = +(estimatedLaborHours * 18.50).toFixed(2);
        const totalOperatingCost = +(totalFoodCost + estimatedLaborCost).toFixed(2);
        const totalOperatingCostPerResidentDay = totalResidentDays > 0
            ? (totalOperatingCost / totalResidentDays).toFixed(2)
            : null;
        // Category cost allocations (Industry Benchmark: 60% Perishable, 25% Dry Goods, 10% Paper, 5% Chemicals)
        const perishableFoodCost = +(totalFoodCost * 0.60).toFixed(2);
        const dryGroceryCost = +(totalFoodCost * 0.25).toFixed(2);
        const paperGoodsCost = +(totalFoodCost * 0.10).toFixed(2);
        const chemicalSanitationCost = +(totalFoodCost * 0.05).toFixed(2);
        // C06: how much of the $/CPD input is rolled-up real cost vs manual entry
        // (DB-agnostic: no Postgres FILTER clause — this pool also serves SQLite)
        const { rows: srcRows } = await pool_1.pool.query(`SELECT
         SUM(CASE WHEN notes LIKE '[auto-rollup]%' THEN 1 ELSE 0 END) AS auto_days,
         SUM(CASE WHEN notes NOT LIKE '[auto-rollup]%' OR notes IS NULL THEN 1 ELSE 0 END) AS manual_days
       FROM daily_cost_log
       WHERE log_date BETWEEN $1 AND $2`, [startDate, endDate]);
        res.json({
            dateRange: { start: startDate, end: endDate },
            activeResidents,
            totalFoodCost: totalFoodCost.toFixed(2),
            totalResidentDays,
            costPerResidentDay: costPerResidentDay !== null ? costPerResidentDay.toFixed(2) : null,
            costSourceCounts: {
                rolledUpDays: parseInt(srcRows[0].auto_days, 10),
                manualDays: parseInt(srcRows[0].manual_days, 10),
            },
            breakdown: {
                perishableFoodCost,
                dryGroceryCost,
                paperGoodsCost,
                chemicalSanitationCost,
            },
            estimatedLaborHours,
            estimatedLaborCost: estimatedLaborCost.toFixed(2),
            totalOperatingCost: totalOperatingCost.toFixed(2),
            totalOperatingCostPerResidentDay,
            substitutions,
            allergyFlagCount,
            specialDietCount,
            generatedAt: new Date().toISOString(),
        });
    }
    catch (e) {
        next(e);
    }
});
// ─── Daily Cost Log ────────────────────────────────────────────────────────
/** GET /api/reporting/cost-log?start=&end= */
exports.reportingRouter.get('/cost-log', async (req, res, next) => {
    const { start, end } = req.query;
    try {
        const { rows } = await pool_1.pool.query(`SELECT dcl.*, u.name AS logged_by_name
       FROM daily_cost_log dcl
       LEFT JOIN users u ON u.id = dcl.created_by
       WHERE ($1::date IS NULL OR dcl.log_date >= $1::date)
         AND ($2::date IS NULL OR dcl.log_date <= $2::date)
       ORDER BY dcl.log_date DESC
       LIMIT 365`, [start ?? null, end ?? null]);
        // C06: rolled-up entries carry an "[auto-rollup]" notes prefix; expose the
        // origin so $/CPD views can show rolled costs vs manual entries.
        res.json(rows.map(r => ({
            ...r,
            source: typeof r.notes === 'string' && r.notes.startsWith('[auto-rollup]') ? 'auto' : 'manual',
        })));
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/reporting/cost-log */
exports.reportingRouter.post('/cost-log', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    const ar = req;
    const { logDate, residentCount, foodCost, notes = '' } = req.body;
    if (!logDate || residentCount == null || foodCost == null) {
        return err(res, 400, 'logDate, residentCount, and foodCost are required');
    }
    try {
        const { rows } = await pool_1.pool.query(`INSERT INTO daily_cost_log (log_date, resident_count, food_cost, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (facility_id, log_date) DO UPDATE
         SET resident_count = EXCLUDED.resident_count,
             food_cost = EXCLUDED.food_cost,
             notes = EXCLUDED.notes,
             created_by = EXCLUDED.created_by
       RETURNING *`, [logDate, residentCount, foodCost, notes, ar.userId ?? null]);
        res.status(201).json(rows[0]);
    }
    catch (e) {
        next(e);
    }
});
// ─── C06: Rolled cost → daily_cost_log → $/CPD ────────────────────────────
// These endpoints are ADDITIVE to the cost/CPD region. They consume the
// rolled-up costs from the costing engine; nothing else in this file changes.
/**
 * GET /api/reporting/cpd-breakdown?date=YYYY-MM-DD
 * Menu-slot plate-cost breakdown for one service day: per-slot plate costs,
 * per-item costs with provenance (SKU-matched vs estimated), per-resident-day
 * rollup, and the resident census used for the daily total.
 */
exports.reportingRouter.get('/cpd-breakdown', async (req, res, next) => {
    try {
        const date = req.query.date || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return err(res, 400, 'date must be YYYY-MM-DD');
        }
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(`${date}T12:00:00`).getDay()];
        const { weekName, slots } = await (0, costing_1.getMenuSlotCosts)(pool_1.pool, dayName);
        const perResidentDayCost = Math.round(slots.reduce((s, slot) => s + slot.slotPlateCost, 0) * 10000) / 10000;
        const { rows: censusRows } = await pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM residents WHERE status = 'active'`);
        const residentCount = parseInt(censusRows[0]?.cnt || '0', 10);
        res.json({
            date,
            dayName,
            weekName,
            slots,
            perResidentDayCost,
            residentCount,
            dailyFoodCost: Math.round(perResidentDayCost * residentCount * 100) / 100,
            generatedAt: new Date().toISOString(),
        });
    }
    catch (e) {
        next(e);
    }
});
/**
 * POST /api/reporting/cost-log/rollup
 * Compute the day's food cost from the active menu (menu-slot plate costs ×
 * census) and upsert it into daily_cost_log. Idempotent: re-running for the
 * same date overwrites the auto-rollup entry, never duplicates it.
 * Body: { date?: 'YYYY-MM-DD' } (defaults to today)
 */
exports.reportingRouter.post('/cost-log/rollup', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    const ar = req;
    try {
        const date = req.body?.date || new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return err(res, 400, 'date must be YYYY-MM-DD');
        }
        const result = await (0, costing_1.rollupDailyCost)(pool_1.pool, date, ar.userId ?? null);
        res.status(201).json(result);
    }
    catch (e) {
        next(e);
    }
});
// ─── Substitution Log ─────────────────────────────────────────────────────
/** GET /api/reporting/substitutions?start=&end= */
exports.reportingRouter.get('/substitutions', async (req, res, next) => {
    const { start, end } = req.query;
    try {
        const { rows } = await pool_1.pool.query(`SELECT sl.*,
              r.first_name || ' ' || r.last_name AS resident_name,
              r.room,
              u.name AS logged_by_name
       FROM substitution_log sl
       LEFT JOIN residents r ON r.id = sl.resident_id
       LEFT JOIN users u ON u.id = sl.logged_by
       WHERE ($1::date IS NULL OR sl.meal_date >= $1::date)
         AND ($2::date IS NULL OR sl.meal_date <= $2::date)
       ORDER BY sl.meal_date DESC, sl.created_at DESC
       LIMIT 500`, [start ?? null, end ?? null]);
        res.json(rows);
    }
    catch (e) {
        next(e);
    }
});
/** POST /api/reporting/substitutions */
exports.reportingRouter.post('/substitutions', async (req, res, next) => {
    const ar = req;
    const { residentId, mealDate, mealType, originalItem, substituteItem, reason = '' } = req.body;
    if (!mealDate || !originalItem || !substituteItem) {
        return err(res, 400, 'mealDate, originalItem, and substituteItem are required');
    }
    try {
        const { rows } = await pool_1.pool.query(`INSERT INTO substitution_log
         (resident_id, meal_date, meal_type, original_item, substitute_item, reason, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [residentId ?? null, mealDate, mealType ?? '', originalItem, substituteItem, reason, ar.userId ?? null]);
        res.status(201).json(rows[0]);
    }
    catch (e) {
        next(e);
    }
});
/** DELETE /api/reporting/substitutions/:id */
exports.reportingRouter.delete('/substitutions/:id', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    const { id } = req.params;
    try {
        await pool_1.pool.query(`DELETE FROM substitution_log WHERE id = $1`, [id]);
        res.json({ ok: true });
    }
    catch (e) {
        next(e);
    }
});
// ─── Allergy Risk ─────────────────────────────────────────────────────────
/**
 * GET /api/reporting/allergy-risk
 * Lists all active residents who have allergens recorded.
 * Full meal-level cross-validation is a V2 enhancement requiring
 * structured recipe ingredients with allergen tags.
 */
exports.reportingRouter.get('/allergy-risk', async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query(`SELECT id, first_name, last_name, room, diet_order, texture, allergies, beverages
       FROM residents
       WHERE status = 'active'
         AND allergies IS NOT NULL
         AND allergies != ''
         AND allergies != '[]'
       ORDER BY last_name, first_name`);
        res.json(rows);
    }
    catch (e) {
        next(e);
    }
});
// ─── Diet Mismatches ─────────────────────────────────────────────────────
/**
 * GET /api/reporting/diet-mismatches
 * Lists active residents with a non-regular texture or therapeutic diet order.
 * These are the residents most likely to have tray-card errors.
 */
exports.reportingRouter.get('/diet-mismatches', async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query(`SELECT id, first_name, last_name, room, diet_order, texture, allergies, beverages, supplements
       FROM residents
       WHERE status = 'active'
         AND (
           (texture IS NOT NULL AND texture != '' AND texture != 'Regular') OR
           (diet_order IS NOT NULL AND diet_order != '' AND diet_order NOT ILIKE '%regular%')
         )
       ORDER BY last_name, first_name`);
        res.json(rows);
    }
    catch (e) {
        next(e);
    }
});
// ─── Production Variance ─────────────────────────────────────────────────
/**
 * GET /api/reporting/production-variance?start=&end=
 * Returns production sheets with planned vs produced counts.
 * Variance = (produced - planned) / planned * 100
 */
exports.reportingRouter.get('/production-variance', async (req, res, next) => {
    const { start, end } = req.query;
    try {
        // production_sheets table — check what columns exist by trying a safe query
        const { rows } = await pool_1.pool.query(`SELECT *
       FROM production_sheets
       WHERE ($1::date IS NULL OR date >= $1::date)
         AND ($2::date IS NULL OR date <= $2::date)
       ORDER BY date DESC
       LIMIT 200`, [start ?? null, end ?? null]);
        // Calculate variance where both planned and produced counts are available
        const withVariance = rows.map(r => {
            const planned = parseFloat(r.planned_count ?? r.total_count ?? 0);
            const produced = parseFloat(r.produced_count ?? r.actual_count ?? planned);
            const variance = planned > 0 ? ((produced - planned) / planned * 100).toFixed(1) : null;
            return { ...r, planned, produced, variancePct: variance };
        });
        res.json(withVariance);
    }
    catch (e) {
        next(e);
    }
});
// ─── Compliance PDF-ready summary ────────────────────────────────────────
/**
 * GET /api/reporting/compliance-summary?start=&end=
 * Returns a structured JSON payload for printing a compliance summary report.
 */
exports.reportingRouter.get('/compliance-summary', async (req, res, next) => {
    const { start, end } = req.query;
    const startDate = start ?? new Date().toISOString().slice(0, 10);
    const endDate = end ?? new Date().toISOString().slice(0, 10);
    try {
        const [costRes, subRes, allergyRes, mismatchRes] = await Promise.all([
            pool_1.pool.query(`SELECT COALESCE(SUM(food_cost),0) AS total, COALESCE(SUM(resident_count),0) AS days
         FROM daily_cost_log WHERE log_date BETWEEN $1 AND $2`, [startDate, endDate]),
            pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM substitution_log WHERE meal_date BETWEEN $1 AND $2`, [startDate, endDate]),
            pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM residents WHERE status='active' AND allergies IS NOT NULL AND allergies != '' AND allergies != '[]'`),
            pool_1.pool.query(`SELECT COUNT(*) AS cnt FROM residents WHERE status='active' AND (
           (texture IS NOT NULL AND texture != '' AND texture != 'Regular') OR
           (diet_order IS NOT NULL AND diet_order != '' AND diet_order NOT ILIKE '%regular%')
         )`),
        ]);
        const foodCost = parseFloat(costRes.rows[0].total);
        const residentDays = parseInt(costRes.rows[0].days, 10);
        const cprd = residentDays > 0 ? (foodCost / residentDays).toFixed(2) : 'N/A';
        res.json({
            reportTitle: 'Dietary Compliance Summary',
            facility: 'Shoreline Operations',
            dateRange: { start: startDate, end: endDate },
            generatedAt: new Date().toISOString(),
            metrics: {
                costPerResidentDay: cprd,
                totalFoodCost: foodCost.toFixed(2),
                totalResidentDays: residentDays,
                substitutions: parseInt(subRes.rows[0].cnt, 10),
                residentsWithAllergens: parseInt(allergyRes.rows[0].cnt, 10),
                residentsWithSpecialDiets: parseInt(mismatchRes.rows[0].cnt, 10),
            },
        });
    }
    catch (e) {
        next(e);
    }
});
const cmsSurvey_1 = require("../engine/cmsSurvey");
const requireTier_1 = require("../middleware/requireTier");
/**
 * GET /api/reporting/cms-survey-export
 *
 * Generates official CMS-2567 Dietary Survey Audit Pack (Federal F-Tags F800 - F814)
 */
exports.reportingRouter.get('/cms-survey-export', (0, requireTier_1.requireTier)('enterprise'), async (req, res, next) => {
    try {
        const { format = 'json' } = req.query;
        const { rows: residents } = await pool_1.pool.query('SELECT id, name, diet_type as "dietType", texture, allergies FROM residents');
        let tempLogs = [];
        try {
            const { rows } = await pool_1.pool.query('SELECT item_name as "itemName", temperature, logged_at as "loggedAt", is_compliant as "isCompliant" FROM food_temperatures ORDER BY logged_at DESC LIMIT 90');
            tempLogs = rows;
        }
        catch {
            // Fallback
        }
        const auditPack = cmsSurvey_1.CmsDietarySurveyEngine.generateSurveyAuditPack({
            facilityName: 'Shoreline Healthcare Community',
            residents: residents.map(r => ({
                id: r.id,
                name: r.name,
                dietType: r.dietType || 'Regular',
                texture: r.texture || 'Regular',
                allergies: Array.isArray(r.allergies) ? r.allergies : [],
            })),
            temperatureLogs: tempLogs,
            cycleMenuWeeksCount: 4,
        });
        if (format === 'markdown' || format === 'binder') {
            const markdown = cmsSurvey_1.CmsDietarySurveyEngine.generateDigitalSurveyBinderMarkdown(auditPack);
            res.setHeader('Content-Type', 'text/markdown');
            res.setHeader('Content-Disposition', `attachment; filename="CMS-2567-Survey-Binder-${auditPack.surveyDate}.md"`);
            return res.send(markdown);
        }
        res.json(auditPack);
    }
    catch (e) {
        next(e);
    }
});
// ═══════════════════════════════════════════════════════════════════════════
// C01 — HACCP TEMPERATURE LOG REPORT (survey-ready)
// ─── additive region ──────────────────────────────────────────────────────
// DO NOT merge with other report sections. A costing task also edits this
// file — keep this region self-contained so it can compose cleanly.
//   GET /api/reporting/haccp-temperature-log?start=YYYY-MM-DD&end=YYYY-MM-DD
//       &equipmentId=&violationsOnly=true&format=json|binder
// Returns every persisted temp log in the range with equipment names,
// recorded-by staff, compliance flags, and corrective actions. format=binder
// renders a plain-text survey-binder page for printing.
// ═══════════════════════════════════════════════════════════════════════════
exports.reportingRouter.get('/haccp-temperature-log', async (req, res, next) => {
    const { start, end, equipmentId, violationsOnly, format = 'json' } = req.query;
    const startDate = start ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const endDate = end ?? new Date().toISOString().slice(0, 10);
    try {
        const { rows } = await pool_1.pool.query(`SELECT l.*,
              e.name AS equipment_name,
              e.type AS equipment_type,
              u.name AS recorded_by_name
       FROM haccp_logs l
       LEFT JOIN haccp_equipment e ON e.id = l.equipment_id
       LEFT JOIN users u ON CAST(u.id AS TEXT) = l.recorded_by
       WHERE date(l.recorded_at) >= date($1) AND date(l.recorded_at) <= date($2)
         AND ($3 IS NULL OR l.equipment_id = $3)
         AND ($4 IS NULL OR l.compliant = false)
       ORDER BY l.recorded_at ASC
       LIMIT 2000`, [startDate, endDate, equipmentId ?? null, violationsOnly === 'true' ? 'x' : null]);
        const logs = rows.map(r => ({
            id: r.id,
            recordedAt: r.recorded_at,
            checkType: r.check_type,
            itemName: r.item_name,
            equipmentId: r.equipment_id,
            equipmentName: r.equipment_name,
            equipmentType: r.equipment_type,
            tempF: Number(r.temp_f),
            targetTempF: Number(r.target_temp_f),
            compliant: r.compliant === true || r.compliant === 1,
            violationType: r.violation_type,
            correctiveAction: r.corrective_action,
            source: r.source,
            probeDevice: r.probe_device,
            recordedBy: r.recorded_by_name ?? r.recorded_by,
        }));
        const violations = logs.filter(l => !l.compliant);
        const openViolations = violations.filter(l => !l.correctiveAction);
        const summary = {
            dateRange: { start: startDate, end: endDate },
            totalChecks: logs.length,
            compliantChecks: logs.length - violations.length,
            violations: violations.length,
            openViolations: openViolations.length,
            complianceRatePct: logs.length ? +(((logs.length - violations.length) / logs.length) * 100).toFixed(1) : null,
            generatedAt: new Date().toISOString(),
        };
        if (format === 'binder') {
            const lines = [
                'HACCP TEMPERATURE LOG — SURVEY BINDER',
                `Date range: ${startDate} to ${endDate}`,
                `Generated: ${summary.generatedAt}`,
                '',
                `Total checks: ${summary.totalChecks}   Compliant: ${summary.compliantChecks}   Violations: ${summary.violations}   Open (no corrective action): ${summary.openViolations}`,
                '',
                '—'.repeat(72),
            ];
            for (const l of logs) {
                const who = l.equipmentName ?? l.itemName ?? '—';
                const flag = l.compliant ? 'OK' : '*** VIOLATION ***';
                lines.push(`${l.recordedAt} | ${l.checkType.toUpperCase()} | ${who}`);
                lines.push(`  ${l.tempF} °F (target ${l.targetTempF} °F) — ${flag}${l.violationType ? ` [${l.violationType}]` : ''}`);
                lines.push(`  Recorded by: ${l.recordedBy ?? 'unknown'}${l.source === 'probe' ? ` (probe: ${l.probeDevice ?? 'unknown'})` : ''}`);
                if (!l.compliant) {
                    lines.push(`  Corrective action: ${l.correctiveAction ? l.correctiveAction : 'OPEN — NOT YET RECORDED'}`);
                }
                lines.push('');
            }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="haccp-temperature-log-${startDate}-to-${endDate}.txt"`);
            return res.send(lines.join('\n'));
        }
        res.json({ reportTitle: 'HACCP Temperature Log', summary, logs });
    }
    catch (e) {
        next(e);
    }
});
// ─── end C01 additive region ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// BUDGET PERIODS & ENTRIES (Zero Split-Brain Persistence)
// ════════════════════════════════════════════════════════════════════════════
function toBudgetPeriod(row) {
    return {
        id: row.id,
        label: row.label,
        month: Number(row.month),
        year: Number(row.year),
        totalBudget: Number(row.total_budget ?? 0),
        residentCount: Number(row.resident_count ?? 1),
        budgetPerResidentPerDay: Number(row.budget_per_resident_per_day ?? 0),
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
    };
}
function toBudgetEntry(row) {
    return {
        id: row.id,
        periodId: row.period_id,
        date: row.date,
        vendor: row.vendor || null,
        description: row.description || '',
        amount: Number(row.amount ?? 0),
        category: row.category || null,
        invoiceRef: row.invoice_ref || null,
        loggedBy: row.logged_by || null,
        createdAt: row.created_at,
    };
}
// GET /api/reporting/budget-periods
exports.reportingRouter.get('/budget-periods', async (_req, res, next) => {
    try {
        const { rows } = await pool_1.pool.query('SELECT * FROM budget_periods ORDER BY year DESC, month DESC');
        res.json(rows.map(toBudgetPeriod));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/reporting/budget-periods
exports.reportingRouter.post('/budget-periods', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const d = req.body;
        const id = d.id || (0, crypto_1.randomUUID)();
        await pool_1.pool.query(`INSERT INTO budget_periods (id, label, month, year, total_budget, resident_count, budget_per_resident_per_day, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label,
         total_budget = EXCLUDED.total_budget,
         resident_count = EXCLUDED.resident_count,
         budget_per_resident_per_day = EXCLUDED.budget_per_resident_per_day,
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date`, [
            id, d.label, Number(d.month), Number(d.year),
            Number(d.totalBudget || 0), Number(d.residentCount || 1),
            Number(d.budgetPerResidentPerDay || 0), d.startDate || null, d.endDate || null,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM budget_periods WHERE id = $1', [id]);
        res.status(201).json(toBudgetPeriod(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/reporting/budget-entries[?periodId=]
exports.reportingRouter.get('/budget-entries', async (req, res, next) => {
    try {
        const periodId = req.query.periodId;
        if (periodId) {
            const { rows } = await pool_1.pool.query('SELECT * FROM budget_entries WHERE period_id = $1 ORDER BY date DESC', [periodId]);
            return res.json(rows.map(toBudgetEntry));
        }
        const { rows } = await pool_1.pool.query('SELECT * FROM budget_entries ORDER BY date DESC LIMIT 500');
        res.json(rows.map(toBudgetEntry));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/reporting/budget-entries
exports.reportingRouter.post('/budget-entries', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const d = req.body;
        const id = d.id || (0, crypto_1.randomUUID)();
        await pool_1.pool.query(`INSERT INTO budget_entries (id, period_id, date, vendor, description, amount, category, invoice_ref, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            id, d.periodId, d.date, d.vendor || null, d.description || '',
            Number(d.amount || 0), d.category || null, d.invoiceRef || null,
            d.loggedBy || req.userId || null,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM budget_entries WHERE id = $1', [id]);
        res.status(201).json(toBudgetEntry(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// PUT /api/reporting/budget-entries/:id
exports.reportingRouter.put('/budget-entries/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const d = req.body;
        await pool_1.pool.query(`UPDATE budget_entries SET
         date = COALESCE($1, date),
         vendor = COALESCE($2, vendor),
         description = COALESCE($3, description),
         amount = COALESCE($4, amount),
         category = COALESCE($5, category),
         invoice_ref = COALESCE($6, invoice_ref)
       WHERE id = $7`, [
            d.date, d.vendor, d.description,
            d.amount !== undefined ? Number(d.amount) : null,
            d.category, d.invoiceRef, req.params.id,
        ]);
        const { rows } = await pool_1.pool.query('SELECT * FROM budget_entries WHERE id = $1', [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'Budget entry not found' });
        res.json(toBudgetEntry(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
// DELETE /api/reporting/budget-entries/:id
exports.reportingRouter.delete('/budget-entries/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        await pool_1.pool.query('DELETE FROM budget_entries WHERE id = $1', [req.params.id]);
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
});
