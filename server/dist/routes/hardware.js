"use strict";
/**
 * Hardware Routes — Shoreline v6.0
 *
 * POST   /api/hardware/print/tray-card          Print a thermal tray card
 *
 * B13: simulated printer registry (GET /printers), simulated BLE probe scan
 * (GET /probes), simulated probe reads (GET /probes/:probeId/temperature) and
 * simulated HACCP logging (POST /probes/:probeId/log-haccp) were CUT.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hardwareRouter = void 0;
const express_1 = require("express");
const crypto_1 = require("crypto");
const thermalPrint_1 = require("../hardware/thermalPrint");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
const emitter_1 = require("../webhooks/emitter");
exports.hardwareRouter = (0, express_1.Router)();
// ── C01: Durable HACCP temperature logging (migration 023) ───────────────────
// Real, persisted temperature compliance. Manual entry + real probe readings
// only — no simulated/fake readings are ever generated here (B13 cut the
// simulated probe endpoints). Every temp check persists with the recording
// user + timestamp; nothing returns a fabricated LOGGED record.
// NPO/allergen checks live in the tray/card flows and are untouched here:
// temp checks never serve food, so they cannot bypass clinical gates.
// ── Thermal Printing ──────────────────────────────────────────────────────────
/**
 * POST /api/hardware/print/tray-card
 * Body: ThermalPrintResidentInput
 */
exports.hardwareRouter.post('/print/tray-card', async (req, res, next) => {
    try {
        const resident = req.body;
        // Validate required fields
        if (!resident.id || !resident.name || !resident.room) {
            return res.status(400).json({
                error: 'id, name, and room are required resident fields',
            });
        }
        const job = thermalPrint_1.ThermalPrintEngine.printTrayCard({
            id: resident.id,
            name: resident.name,
            room: resident.room,
            wing: resident.wing,
            diet: resident.diet ?? 'Regular',
            texture: resident.texture ?? 'IDDSI Level 7 Regular',
            fluids: resident.fluids ?? 'Thin',
            allergies: resident.allergies ?? [],
            mealDate: resident.mealDate,
            mealType: resident.mealType,
        });
        const zpl = thermalPrint_1.ThermalPrintEngine.generateZplString(job);
        const directPrint = req.body.directPrint === true;
        const printerHost = req.body.printerHost || '192.168.1.101';
        const printerPort = req.body.printerPort || 9100;
        let socketResult;
        if (directPrint) {
            socketResult = await thermalPrint_1.ThermalPrintEngine.sendZplToNetworkPrinter(printerHost, printerPort, zpl);
        }
        return res.status(201).json({
            message: 'Tray card print job generated',
            job,
            zpl,
            directPrintRequested: directPrint,
            socketResult,
        });
    }
    catch (err) {
        next(err);
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// B13 scope cuts: the simulated hardware endpoints were CUT from this file:
//   GET    /api/hardware/printers                      (simulated printer registry)
//   GET    /api/hardware/probes                        (simulated BLE scan)
//   GET    /api/hardware/probes/:probeId/temperature   (simulated temp reads)
//   POST   /api/hardware/probes/:probeId/log-haccp     (simulated HACCP logging)
// Kept: POST /api/hardware/print/tray-card (real ZPL thermal-print engine).
// ─────────────────────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════
// C01 — HACCP temperature compliance (durable, survey-evidence)
// ─────────────────────────────────────────────────────────────────────────────
// All writes are validated + audit-logged. Reads sit behind requireAuth
// (router-level) so the survey log never leaks to unauthenticated callers.
// ═════════════════════════════════════════════════════════════════════════════
const HACCP_EQUIPMENT_TYPES = ['fridge', 'freezer', 'dishwasher', 'hot-hold'];
const HACCP_CHECK_FREQUENCIES = ['shift', 'daily', 'weekly'];
// Equipment types that must stay COLD: compliant when measured <= target.
// All others (dishwasher final rinse, hot-hold, food cook/hold) are compliant
// when measured >= target.
const COLD_EQUIPMENT = new Set(['fridge', 'freezer']);
const FREQUENCY_HOURS = { shift: 8, daily: 24, weekly: 168 };
async function auditHaccp(userId, action, resourceId, resourceType, details) {
    await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
     VALUES ($1, $2, $3, $4, 'success', $5)`, [action, userId, resourceId, resourceType, JSON.stringify(details)]);
}
async function getEquipment(id) {
    const { rows } = await pool_1.pool.query(`SELECT * FROM haccp_equipment WHERE id = $1`, [id]);
    return rows[0] ?? null;
}
/** Due/overdue computation per equipment against its check frequency. */
async function buildSchedule() {
    const { rows: equipment } = await pool_1.pool.query(`SELECT * FROM haccp_equipment WHERE active = $1 ORDER BY name`, [true]);
    const now = Date.now();
    const out = [];
    for (const eq of equipment) {
        const { rows: last } = await pool_1.pool.query(`SELECT id, recorded_at, temp_f FROM haccp_logs
       WHERE equipment_id = $1 AND check_type = 'equipment'
       ORDER BY recorded_at DESC LIMIT 1`, [eq.id]);
        const lastRow = last[0] ?? null;
        const lastAt = lastRow ? new Date(lastRow.recorded_at).getTime() : null;
        const intervalMs = (FREQUENCY_HOURS[eq.check_frequency] ?? 24) * 3600 * 1000;
        let nextDueAt = null;
        let status;
        if (lastAt == null || Number.isNaN(lastAt)) {
            // Never logged → overdue (must be checked before it counts as covered).
            status = 'overdue';
        }
        else {
            const dueAt = lastAt + intervalMs;
            nextDueAt = new Date(dueAt).toISOString();
            if (now >= dueAt)
                status = 'overdue';
            else if (now >= dueAt - 30 * 60 * 1000)
                status = 'due';
            else
                status = 'ok';
        }
        out.push({
            ...eq,
            last_log_id: lastRow?.id ?? null,
            last_recorded_at: lastRow?.recorded_at ?? null,
            last_temp_f: lastRow ? Number(lastRow.temp_f) : null,
            next_due_at: nextDueAt,
            status,
        });
    }
    return out;
}
// ── GET /api/hardware/haccp/equipment ───────────────────────────────────────
// List temperature-monitored equipment (active only by default).
exports.hardwareRouter.get('/haccp/equipment', async (req, res, next) => {
    try {
        const includeInactive = req.query.includeInactive === 'true';
        const { rows } = await pool_1.pool.query(`SELECT * FROM haccp_equipment ${includeInactive ? '' : 'WHERE active = $1'} ORDER BY name`, includeInactive ? [] : [true]);
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/hardware/haccp/equipment ──────────────────────────────────────
// Register a piece of monitored equipment. Manager role.
exports.hardwareRouter.post('/haccp/equipment', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    try {
        const { name, type, targetTempF, checkFrequency = 'daily' } = req.body ?? {};
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }
        if (!HACCP_EQUIPMENT_TYPES.includes(type)) {
            return res.status(400).json({ error: `type must be one of ${HACCP_EQUIPMENT_TYPES.join(', ')}` });
        }
        const target = Number(targetTempF);
        if (!Number.isFinite(target)) {
            return res.status(400).json({ error: 'targetTempF must be a number (°F)' });
        }
        if (!HACCP_CHECK_FREQUENCIES.includes(checkFrequency)) {
            return res.status(400).json({ error: `checkFrequency must be one of ${HACCP_CHECK_FREQUENCIES.join(', ')}` });
        }
        const id = (0, crypto_1.randomUUID)();
        await pool_1.pool.query(`INSERT INTO haccp_equipment (id, name, type, target_temp_f, check_frequency)
       VALUES ($1, $2, $3, $4, $5)`, [id, name.trim(), type, target, checkFrequency]);
        const saved = await getEquipment(id);
        await auditHaccp(req.userId ?? null, 'HACCP_EQUIPMENT_CREATE', id, 'haccp_equipment', { name: name.trim(), type, targetTempF: target, checkFrequency });
        res.status(201).json(saved);
    }
    catch (err) {
        next(err);
    }
});
// ── PATCH /api/hardware/haccp/equipment/:id ─────────────────────────────────
// Update target temp, frequency, name, or active flag. Manager role.
exports.hardwareRouter.patch('/haccp/equipment/:id', (0, requireAuth_1.requireRole)('manager'), async (req, res, next) => {
    try {
        const existing = await getEquipment(req.params.id);
        if (!existing)
            return res.status(404).json({ error: 'equipment not found' });
        const { name, targetTempF, checkFrequency, active } = req.body ?? {};
        if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
            return res.status(400).json({ error: 'name must be a non-empty string' });
        }
        const target = targetTempF !== undefined ? Number(targetTempF) : null;
        if (targetTempF !== undefined && !Number.isFinite(target)) {
            return res.status(400).json({ error: 'targetTempF must be a number (°F)' });
        }
        if (checkFrequency !== undefined && !HACCP_CHECK_FREQUENCIES.includes(checkFrequency)) {
            return res.status(400).json({ error: `checkFrequency must be one of ${HACCP_CHECK_FREQUENCIES.join(', ')}` });
        }
        if (active !== undefined && typeof active !== 'boolean') {
            return res.status(400).json({ error: 'active must be a boolean' });
        }
        await pool_1.pool.query(`UPDATE haccp_equipment
       SET name = COALESCE($2, name),
           target_temp_f = COALESCE($3, target_temp_f),
           check_frequency = COALESCE($4, check_frequency),
           active = COALESCE($5, active),
           updated_at = NOW()
       WHERE id = $1`, [req.params.id,
            name !== undefined ? name.trim() : null,
            target,
            checkFrequency ?? null,
            active ?? null]);
        const saved = await getEquipment(req.params.id);
        await auditHaccp(req.userId ?? null, 'HACCP_EQUIPMENT_UPDATE', req.params.id, 'haccp_equipment', { name: name ?? undefined, targetTempF: target ?? undefined, checkFrequency: checkFrequency ?? undefined, active: active ?? undefined });
        res.json(saved);
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/hardware/haccp/schedule ────────────────────────────────────────
// Equipment temp schedule with due/overdue surfacing.
exports.hardwareRouter.get('/haccp/schedule', async (_req, res, next) => {
    try {
        const schedule = await buildSchedule();
        const overdue = schedule.filter(s => s.status === 'overdue').length;
        const due = schedule.filter(s => s.status === 'due').length;
        res.json({ generatedAt: new Date().toISOString(), overdue, due, equipment: schedule });
    }
    catch (err) {
        next(err);
    }
});
// ── GET /api/hardware/haccp/logs ───────────────────────────────────────────
// Query persisted temp logs. ?start=YYYY-MM-DD&end=YYYY-MM-DD
// &equipmentId=&violationsOnly=true&checkType=food|equipment
exports.hardwareRouter.get('/haccp/logs', async (req, res, next) => {
    try {
        const { start, end, equipmentId, violationsOnly, checkType } = req.query;
        const conditions = [];
        const params = [];
        const push = (cond, val) => { params.push(val); conditions.push(cond.replace('?', `$${params.length}`)); };
        if (start)
            push(`date(l.recorded_at) >= date(?)`, start);
        if (end)
            push(`date(l.recorded_at) <= date(?)`, end);
        if (equipmentId)
            push(`l.equipment_id = ?`, equipmentId);
        if (violationsOnly === 'true')
            push(`l.compliant = ?`, false);
        if (checkType && ['food', 'equipment'].includes(checkType))
            push(`l.check_type = ?`, checkType);
        // Portable boolean literal: pool.ts maps JS booleans to 1/0 on SQLite;
        // PostgreSQL compares natively against its BOOLEAN column.
        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
        const { rows } = await pool_1.pool.query(`SELECT l.*, e.name AS equipment_name, u.name AS recorded_by_name
       FROM haccp_logs l
       LEFT JOIN haccp_equipment e ON e.id = l.equipment_id
       LEFT JOIN users u ON CAST(u.id AS TEXT) = l.recorded_by
       ${where}
       ORDER BY l.recorded_at DESC
       LIMIT 500`, params);
        res.json(rows);
    }
    catch (err) {
        next(err);
    }
});
// ── POST /api/hardware/haccp/log-temp ───────────────────────────────────────
// Log one temperature check. Manual entry, or a REAL probe reading passed in
// from the tablet's probe abstraction (source='probe' + probeDevice + the
// device's own reading). The server never fabricates a reading: tempF is a
// required measured value.
// Compliance is computed server-side and a violation (non-compliant) CANNOT
// be persisted without correctiveAction text — enforced here AND again by
// the client flow, so a bare LOGGED record can never be created.
exports.hardwareRouter.post('/haccp/log-temp', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const { checkType, itemName = '', equipmentId, tempF, targetTempF, correctiveAction = '', source = 'manual', probeDevice, recordedBy, } = req.body ?? {};
        if (!['food', 'equipment'].includes(checkType)) {
            return res.status(400).json({ error: "checkType must be 'food' or 'equipment'" });
        }
        const measured = Number(tempF);
        if (!Number.isFinite(measured) || measured < -40 || measured > 250) {
            return res.status(400).json({ error: 'tempF must be a measured temperature between -40 and 250 °F' });
        }
        if (typeof itemName !== 'string' || itemName.length > 200) {
            return res.status(400).json({ error: 'itemName must be a string of at most 200 characters' });
        }
        if (!['manual', 'probe'].includes(source)) {
            return res.status(400).json({ error: "source must be 'manual' or 'probe'" });
        }
        if (source === 'probe' && (typeof probeDevice !== 'string' || !probeDevice.trim())) {
            // A probe-sourced reading without an identified device is unverifiable —
            // treat it as manual rather than laundering an anonymous reading.
            return res.status(400).json({ error: 'probeDevice (device name) is required when source is probe' });
        }
        if (typeof correctiveAction !== 'string' || correctiveAction.length > 2000) {
            return res.status(400).json({ error: 'correctiveAction must be a string of at most 2000 characters' });
        }
        // Resolve target temperature + equipment context.
        let equipment = null;
        let target;
        if (checkType === 'equipment') {
            if (!equipmentId) {
                return res.status(400).json({ error: 'equipmentId is required for equipment checks' });
            }
            equipment = await getEquipment(equipmentId);
            if (!equipment)
                return res.status(404).json({ error: 'equipment not found' });
            if (!equipment.active) {
                return res.status(400).json({ error: 'equipment is deactivated — reactivate it before logging' });
            }
            target = targetTempF !== undefined ? Number(targetTempF) : Number(equipment.target_temp_f);
        }
        else {
            // Food checks default to the cook standard (165 °F); hot-hold checks
            // pass their own target (e.g. 140).
            target = targetTempF !== undefined ? Number(targetTempF) : 165;
            if (equipmentId) {
                equipment = await getEquipment(equipmentId);
                if (equipment && equipment.active)
                    target = Number(equipment.target_temp_f);
            }
        }
        if (!Number.isFinite(target)) {
            return res.status(400).json({ error: 'targetTempF must be a number (°F)' });
        }
        // Server-side compliance evaluation.
        const isColdEquipment = equipment ? COLD_EQUIPMENT.has(equipment.type) : false;
        const compliant = isColdEquipment ? measured <= target : measured >= target;
        const action = correctiveAction.trim();
        if (!compliant && !action) {
            // Hard rule: a violation cannot be closed without corrective-action
            // text. The row is NOT persisted — the entry stays open until the
            // corrective action is supplied.
            return res.status(422).json({
                error: 'Violation: temperature is out of range. A corrective action is required before this log can be closed.',
                measuredTempF: measured,
                targetTempF: target,
                compliant: false,
                violationType: deriveViolationType(checkType, equipment, target),
            });
        }
        const id = (0, crypto_1.randomUUID)();
        const by = typeof recordedBy === 'string' && recordedBy.trim()
            ? recordedBy.trim()
            : (req.userId ?? null);
        const violationType = compliant ? null : deriveViolationType(checkType, equipment, target);
        await pool_1.pool.query(`INSERT INTO haccp_logs
         (id, check_type, item_name, equipment_id, temp_f, target_temp_f,
          compliant, violation_type, corrective_action, source, probe_device,
          recorded_by, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`, [id, checkType, itemName.trim(), equipment?.id ?? null, measured, target,
            compliant, violationType, action,
            source, source === 'probe' ? probeDevice.trim() : null,
            by]);
        const { rows: savedRows } = await pool_1.pool.query(`SELECT l.*, e.name AS equipment_name FROM haccp_logs l
       LEFT JOIN haccp_equipment e ON e.id = l.equipment_id
       WHERE l.id = $1`, [id]);
        const record = savedRows[0];
        if (!record) {
            return res.status(500).json({ error: 'HACCP log was not persisted' });
        }
        await auditHaccp(req.userId ?? null, 'HACCP_LOG_TEMP', id, 'haccp_log', { checkType, itemName: itemName.trim(), equipmentId: equipment?.id ?? null, tempF: measured, targetTempF: target, compliant, violationType });
        // Fire the existing violation webhook on real violations (subscribers
        // already exist for haccp.temp.violation — B13 only cut the simulated
        // producer, not the event type).
        if (!compliant) {
            const event = {
                event: 'haccp.temp.violation',
                eventId: (0, crypto_1.randomUUID)(),
                facilityId: process.env.FACILITY_ID ?? 'FAC-001',
                emittedAt: new Date().toISOString(),
                payload: {
                    probeId: source === 'probe' ? probeDevice : 'manual-entry',
                    stationId: equipment ? equipment.name : 'food-check',
                    itemName: itemName.trim() || (equipment ? equipment.name : 'food item'),
                    measuredTempF: measured,
                    requiredMinTempF: target,
                    violationType: violationType,
                    loggedBy: typeof by === 'string' ? by : 'unknown',
                    correctionRequired: true,
                },
            };
            emitter_1.globalWebhookEmitter.emit(event).catch((err) => {
                console.error('[HACCP] Webhook emit error:', err);
            });
        }
        res.status(201).json({ success: true, record });
    }
    catch (err) {
        next(err);
    }
});
// ── PATCH /api/hardware/haccp/logs/:id ─────────────────────────────────────
// Attach (or update) the corrective action on a logged violation. This is the
// only way an OPEN violation closes — the corrective action text is the
// closure requirement. Setting an empty value is rejected.
exports.hardwareRouter.patch('/haccp/logs/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const { correctiveAction } = req.body ?? {};
        if (typeof correctiveAction !== 'string' || !correctiveAction.trim()) {
            return res.status(400).json({ error: 'correctiveAction text is required — a violation cannot be closed without it' });
        }
        if (correctiveAction.length > 2000) {
            return res.status(400).json({ error: 'correctiveAction must be at most 2000 characters' });
        }
        const { rows } = await pool_1.pool.query(`SELECT * FROM haccp_logs WHERE id = $1`, [req.params.id]);
        if (!rows[0])
            return res.status(404).json({ error: 'log not found' });
        await pool_1.pool.query(`UPDATE haccp_logs SET corrective_action = $1 WHERE id = $2`, [correctiveAction.trim(), req.params.id]);
        const { rows: saved } = await pool_1.pool.query(`SELECT * FROM haccp_logs WHERE id = $1`, [req.params.id]);
        await auditHaccp(req.userId ?? null, 'HACCP_CORRECTIVE_ACTION', req.params.id, 'haccp_log', { correctiveAction: correctiveAction.trim() });
        res.json(saved[0]);
    }
    catch (err) {
        next(err);
    }
});
function deriveViolationType(checkType, equipment, target) {
    if (equipment && COLD_EQUIPMENT.has(equipment.type))
        return 'cold_hold_above_41';
    if (checkType === 'food' && target >= 165)
        return 'cook_below_165';
    return 'hot_hold_below_140';
}
