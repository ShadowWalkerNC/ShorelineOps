"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trayrunsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const pool_1 = require("../db/pool");
const requireAuth_1 = require("../middleware/requireAuth");
const trayTracking_1 = require("../engine/trayTracking");
exports.trayrunsRouter = (0, express_1.Router)();
// ── Zod schemas ───────────────────────────────────────────────────────────────
const DateString = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const RunBodySchema = zod_1.z.object({
    mealSlot: zod_1.z.enum(trayTracking_1.MEAL_SLOTS),
    serviceDate: DateString,
    wing: zod_1.z.string().max(120).default(''),
    notes: zod_1.z.string().max(2000).default(''),
});
const EnsureBodySchema = zod_1.z.object({
    mealSlot: zod_1.z.enum(trayTracking_1.MEAL_SLOTS),
    serviceDate: DateString.optional(),
    wing: zod_1.z.string().max(120).default(''),
});
const EventBodySchema = zod_1.z.object({
    residentId: zod_1.z.string().uuid().nullable().optional(),
    ticketId: zod_1.z.string().max(64).default(''),
    event: zod_1.z.enum(trayTracking_1.TRAY_EVENTS),
    note: zod_1.z.string().max(2000).default(''),
    /** For 'remade': id of the new tray ticket; folded into the note so the link is durable. */
    newTicketId: zod_1.z.string().max(64).optional(),
}).refine((d) => d.residentId || d.ticketId, {
    message: 'residentId or ticketId is required',
});
// ── Helpers ───────────────────────────────────────────────────────────────────
async function audit(req, action, resourceId, outcome = 'success', details) {
    await pool_1.pool.query(`INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
     VALUES ($1, $2, $3, 'tray_tracking', $4, $5)`, [action, req.userId ?? null, resourceId, outcome, details ? JSON.stringify(details) : null]);
}
function toRun(row) {
    return {
        id: row.id,
        mealSlot: row.meal_slot,
        serviceDate: row.service_date,
        wing: row.wing ?? '',
        notes: row.notes ?? '',
        createdBy: row.created_by ?? null,
        createdAt: row.created_at,
    };
}
function toEvent(row) {
    return {
        id: row.id,
        run_id: row.run_id,
        resident_id: row.resident_id ?? null,
        ticket_id: row.ticket_id ?? '',
        event: row.event,
        at: row.at,
        by: row.by ?? null,
        note: row.note ?? '',
    };
}
async function fetchRun(id) {
    const { rows } = await pool_1.pool.query('SELECT * FROM tray_runs WHERE id = $1', [id]);
    return rows[0] ?? null;
}
async function fetchEvents(runId) {
    const { rows } = await pool_1.pool.query('SELECT * FROM tray_events WHERE run_id = $1 ORDER BY at ASC, created_at ASC', [runId]);
    return rows.map(toEvent);
}
/** Resolve a tray ticket id to a resident (TKT-<id-prefix>-<suffix>, see production.ts). */
async function resolveResidentByTicket(ticketId) {
    if (!ticketId || !ticketId.startsWith('TKT-'))
        return null;
    const prefix = ticketId.split('-')[1];
    if (!prefix)
        return null;
    // CAST(...) instead of ::text — the SQLite translation layer cannot parse :: casts.
    const { rows } = await pool_1.pool.query(`SELECT id, name, room, is_npo, npo_reason FROM residents WHERE CAST(id AS TEXT) LIKE $1 LIMIT 1`, [`${prefix}%`]);
    return rows[0] ?? null;
}
async function residentMap(ids) {
    const uniq = [...new Set(ids.filter((i) => !!i))];
    const map = new Map();
    if (uniq.length === 0)
        return map;
    const placeholders = uniq.map((_, i) => `$${i + 1}`).join(',');
    const { rows } = await pool_1.pool.query(`SELECT id, name, room, diet_type, is_npo FROM residents WHERE id IN (${placeholders})`, uniq);
    for (const r of rows)
        map.set(r.id, r);
    return map;
}
function todayString() {
    return new Date().toISOString().slice(0, 10);
}
function parseSla(req) {
    const raw = typeof req.query.slaMinutes === 'string' ? Number(req.query.slaMinutes) : trayTracking_1.DEFAULT_TRAY_SLA_MINUTES;
    if (!Number.isFinite(raw) || raw < 1 || raw > 480)
        return trayTracking_1.DEFAULT_TRAY_SLA_MINUTES;
    return Math.floor(raw);
}
// ── Run CRUD ──────────────────────────────────────────────────────────────────
// GET /api/trayruns?serviceDate=&mealSlot=
exports.trayrunsRouter.get('/', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const serviceDate = typeof req.query.serviceDate === 'string' ? req.query.serviceDate : null;
        const mealSlot = typeof req.query.mealSlot === 'string' ? req.query.mealSlot : null;
        const conds = [];
        const params = [];
        if (serviceDate) {
            DateString.parse(serviceDate);
            conds.push(`service_date = $${params.length + 1}`);
            params.push(serviceDate);
        }
        if (mealSlot) {
            if (!trayTracking_1.MEAL_SLOTS.includes(mealSlot)) {
                return res.status(400).json({ error: 'Invalid mealSlot' });
            }
            conds.push(`meal_slot = $${params.length + 1}`);
            params.push(mealSlot);
        }
        const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
        const { rows } = await pool_1.pool.query(`SELECT * FROM tray_runs ${where} ORDER BY service_date DESC, created_at DESC LIMIT 100`, params);
        res.json(rows.map(toRun));
    }
    catch (err) {
        next(err);
    }
});
// POST /api/trayruns/ensure — find-or-create the run for a meal (idempotent;
// the QR assembly scanner uses this so it never needs to know run ids).
exports.trayrunsRouter.post('/ensure', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = EnsureBodySchema.parse(req.body);
        const serviceDate = data.serviceDate ?? todayString();
        const wing = data.wing ?? '';
        const { rows } = await pool_1.pool.query(`SELECT * FROM tray_runs WHERE service_date = $1 AND meal_slot = $2 AND wing = $3`, [serviceDate, data.mealSlot, wing]);
        if (rows[0])
            return res.json({ run: toRun(rows[0]), created: false });
        const id = (0, crypto_1.randomUUID)();
        await pool_1.pool.query(`INSERT INTO tray_runs (id, meal_slot, service_date, wing, created_by)
       VALUES ($1, $2, $3, $4, $5)`, [id, data.mealSlot, serviceDate, wing, req.userId ?? null]);
        await audit(req, 'CREATE_TRAY_RUN', id, 'success', { mealSlot: data.mealSlot, serviceDate, wing });
        const created = await fetchRun(id);
        res.status(201).json({ run: toRun(created), created: true });
    }
    catch (err) {
        next(err);
    }
});
// POST /api/trayruns — create a run explicitly (dispatch UI)
exports.trayrunsRouter.post('/', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const data = RunBodySchema.parse(req.body);
        const id = (0, crypto_1.randomUUID)();
        try {
            await pool_1.pool.query(`INSERT INTO tray_runs (id, meal_slot, service_date, wing, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`, [id, data.mealSlot, data.serviceDate, data.wing, data.notes, req.userId ?? null]);
        }
        catch (err) {
            const msg = String(err?.message ?? '');
            if (msg.includes('UNIQUE') || msg.includes('unique') || msg.includes('duplicate')) {
                return res.status(409).json({ error: 'A run already exists for this meal slot, date, and wing' });
            }
            throw err;
        }
        await audit(req, 'CREATE_TRAY_RUN', id, 'success', { mealSlot: data.mealSlot, serviceDate: data.serviceDate, wing: data.wing });
        const created = await fetchRun(id);
        if (!created)
            return res.status(500).json({ error: 'Failed to read created run' });
        res.status(201).json(toRun(created));
    }
    catch (err) {
        next(err);
    }
});
// ── Missed-tray alert (in-app surface; no SMS/push) ───────────────────────────
// GET /api/trayruns/missed?slaMinutes=30&serviceDate=YYYY-MM-DD
// NOTE: defined before '/:id' so 'missed' is not captured as an id.
exports.trayrunsRouter.get('/missed', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const slaMinutes = parseSla(req);
        const serviceDate = typeof req.query.serviceDate === 'string' ? req.query.serviceDate : todayString();
        DateString.parse(serviceDate);
        const { rows: runs } = await pool_1.pool.query('SELECT * FROM tray_runs WHERE service_date = $1 ORDER BY created_at ASC', [serviceDate]);
        const missed = [];
        for (const run of runs) {
            const events = await fetchEvents(run.id);
            const lines = (0, trayTracking_1.computeTrayLines)(events);
            const hits = (0, trayTracking_1.computeMissedTrays)(lines, slaMinutes);
            if (hits.length === 0)
                continue;
            const rmap = await residentMap(hits.map((h) => h.residentId));
            for (const h of hits) {
                const r = h.residentId ? rmap.get(h.residentId) : null;
                missed.push({
                    runId: run.id,
                    mealSlot: run.meal_slot,
                    wing: run.wing ?? '',
                    serviceDate: run.service_date,
                    slaMinutes,
                    ...h,
                    residentName: r?.name ?? null,
                    room: r?.room ?? null,
                });
            }
        }
        res.json({ serviceDate, slaMinutes, missed });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/trayruns/:id
exports.trayrunsRouter.get('/:id', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const run = await fetchRun(req.params.id);
        if (!run)
            return res.status(404).json({ error: 'Tray run not found' });
        res.json(toRun(run));
    }
    catch (err) {
        next(err);
    }
});
// GET /api/trayruns/:id/checklist — residents on the run with latest event per tray line
exports.trayrunsRouter.get('/:id/checklist', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const run = await fetchRun(req.params.id);
        if (!run)
            return res.status(404).json({ error: 'Tray run not found' });
        const slaMinutes = parseSla(req);
        const events = await fetchEvents(run.id);
        const lines = (0, trayTracking_1.computeTrayLines)(events);
        const rmap = await residentMap(lines.map((l) => l.residentId));
        const missed = (0, trayTracking_1.computeMissedTrays)(lines, slaMinutes);
        const missedKeys = new Set(missed.map((m) => m.key));
        const summary = {
            total: lines.length,
            assembled: lines.filter((l) => l.latestEvent === 'assembled').length,
            dispatched: lines.filter((l) => l.latestEvent === 'dispatched').length,
            delivered: lines.filter((l) => l.latestEvent === 'delivered').length,
            missed: lines.filter((l) => l.latestEvent === 'missed').length,
            remade: lines.filter((l) => l.latestEvent === 'remade').length,
            overdue: missed.filter((m) => m.kind === 'overdue').length,
        };
        res.json({
            run: toRun(run),
            slaMinutes,
            summary,
            lines: lines.map((l) => {
                const r = l.residentId ? rmap.get(l.residentId) : null;
                return {
                    key: l.key,
                    residentId: l.residentId,
                    residentName: r?.name ?? null,
                    room: r?.room ?? null,
                    dietType: r?.diet_type ?? null,
                    isNpo: !!r?.is_npo,
                    ticketId: l.ticketId,
                    latestEvent: l.latestEvent,
                    latestAt: l.latestAt,
                    latestNote: l.latestNote,
                    isTerminal: l.isTerminal,
                    allowedNext: l.allowedNext,
                    isOverdue: missedKeys.has(l.key),
                    history: l.history.map((h) => ({
                        id: h.id, event: h.event, at: h.at, by: h.by, note: h.note, ticketId: h.ticket_id,
                    })),
                };
            }),
            missed: missed.map((m) => {
                const r = m.residentId ? rmap.get(m.residentId) : null;
                return { ...m, residentName: r?.name ?? null, room: r?.room ?? null };
            }),
        });
    }
    catch (err) {
        next(err);
    }
});
// ── Event append (append-only: no update/delete endpoints exist) ─────────────
// POST /api/trayruns/:id/events
exports.trayrunsRouter.post('/:id/events', (0, requireAuth_1.requireRole)('staff'), async (req, res, next) => {
    try {
        const run = await fetchRun(req.params.id);
        if (!run)
            return res.status(404).json({ error: 'Tray run not found' });
        const data = EventBodySchema.parse(req.body);
        const residentId = data.residentId ?? null;
        const ticketId = data.ticketId ?? '';
        // Resolve the resident (explicit id, else ticket-prefix lookup).
        let resident = null;
        if (residentId) {
            const { rows } = await pool_1.pool.query('SELECT id, name, room, is_npo, npo_reason FROM residents WHERE id = $1', [residentId]);
            if (!rows[0])
                return res.status(404).json({ error: 'Resident not found' });
            resident = rows[0];
        }
        else {
            resident = await resolveResidentByTicket(ticketId);
        }
        // NPO hard-block (non-overridable): no tray may be assembled, dispatched,
        // delivered, missed, or remade for a resident with an active NPO order.
        if (resident?.is_npo) {
            await audit(req, 'TRAY_EVENT_BLOCKED_NPO', run.id, 'failure', {
                event: data.event, residentId: resident.id, npoReason: resident.npo_reason ?? '',
            });
            return res.status(403).json({
                error: `NPO_ALERT: ${resident.name} is NPO${resident.npo_reason ? ` (${resident.npo_reason})` : ''}. All tray service is prohibited.`,
            });
        }
        // Missed/remade events must carry a reason; remade links the new ticket.
        if ((data.event === 'missed' || data.event === 'remade') && !data.note.trim()) {
            return res.status(400).json({ error: `A reason is required for '${data.event}' events` });
        }
        // Enforce forward-only transitions on this tray line. The grouping matches
        // the engine's lineKey (ticket-first) exactly, so a remake's new ticket
        // starts a fresh line while the old one stays terminal.
        const existing = await fetchEvents(run.id);
        const newKey = (0, trayTracking_1.lineKey)({ resident_id: resident?.id ?? null, ticket_id: ticketId });
        const lineHist = existing
            .filter((e) => (0, trayTracking_1.lineKey)(e) === newKey)
            .map((e) => e.event);
        const allowed = (0, trayTracking_1.allowedNextEvents)(lineHist);
        if (!allowed.includes(data.event)) {
            return res.status(409).json({
                error: lineHist.length === 0
                    ? `Cannot record '${data.event}' before 'assembled' on this tray line`
                    : `Cannot record '${data.event}' after '${lineHist[lineHist.length - 1]}' on this tray line`,
                allowedNext: allowed,
            });
        }
        // Remake linkage: fold the new ticket id into the note so the link is durable.
        let note = data.note.trim();
        if (data.event === 'remade') {
            const newTicket = (data.newTicketId ?? '').trim();
            note = newTicket ? `Remade — new ticket ${newTicket}.${note ? ` ${note}` : ''}` : note;
        }
        const id = (0, crypto_1.randomUUID)();
        // `at` is intentionally omitted: the server timestamp is authoritative
        // (DEFAULT NOW()), keeping events append-only with real user + timestamp.
        await pool_1.pool.query(`INSERT INTO tray_events (id, run_id, resident_id, ticket_id, event, by, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [id, run.id, resident?.id ?? null, ticketId, data.event, req.userId ?? null, note]);
        await audit(req, 'TRAY_EVENT', id, 'success', {
            runId: run.id, event: data.event, residentId: resident?.id ?? null, ticketId,
        });
        const { rows } = await pool_1.pool.query('SELECT * FROM tray_events WHERE id = $1', [id]);
        if (!rows[0])
            return res.status(500).json({ error: 'Failed to read created event' });
        res.status(201).json(toEvent(rows[0]));
    }
    catch (err) {
        next(err);
    }
});
