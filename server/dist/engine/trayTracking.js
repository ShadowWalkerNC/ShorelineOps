"use strict";
/**
 * B12 — Tray tracking engine (pure, DB-agnostic logic).
 *
 * Tray lifecycle per tray line (one resident/ticket within a tray run):
 *   assembled → dispatched → delivered
 *                           ↘ missed
 *                           ↘ remade  (note carries the new ticket id)
 *
 * Events are append-only: the API layer exposes no UPDATE/DELETE for
 * tray_events, and this state machine rejects out-of-order or duplicate
 * terminal events so a line can only ever move forward.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TRAY_SLA_MINUTES = exports.TERMINAL_TRAY_EVENTS = exports.MEAL_SLOTS = exports.TRAY_EVENTS = void 0;
exports.allowedNextEvents = allowedNextEvents;
exports.lineKey = lineKey;
exports.computeTrayLines = computeTrayLines;
exports.computeMissedTrays = computeMissedTrays;
exports.inferMealSlot = inferMealSlot;
exports.TRAY_EVENTS = ['assembled', 'dispatched', 'delivered', 'missed', 'remade'];
exports.MEAL_SLOTS = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'];
/** Terminal events — nothing may follow them on the same tray line. */
exports.TERMINAL_TRAY_EVENTS = ['delivered', 'missed', 'remade'];
/** Default missed-tray SLA: minutes after dispatch before a tray is overdue. */
exports.DEFAULT_TRAY_SLA_MINUTES = 30;
/**
 * State machine: which events may legally follow the given history on one
 * tray line. Empty history ⇒ only 'assembled'. Terminal ⇒ nothing.
 */
function allowedNextEvents(history) {
    const last = history[history.length - 1];
    if (!last)
        return ['assembled'];
    if (exports.TERMINAL_TRAY_EVENTS.includes(last))
        return [];
    switch (last) {
        case 'assembled':
            return ['dispatched'];
        case 'dispatched':
            return ['delivered', 'missed', 'remade'];
        default:
            return [];
    }
}
/**
 * Tray-line identity. Ticket-scoped when a ticket id is known (a remake gets a
 * NEW ticket, so it starts a NEW line), resident-scoped otherwise.
 */
function lineKey(ev) {
    return ev.ticket_id || ev.resident_id || '';
}
function parseMs(ts) {
    if (!ts)
        return null;
    // SQLite stores CURRENT_TIMESTAMP as 'YYYY-MM-DD HH:MM:SS'; V8 parses the
    // 'T' form reliably, so normalize before parsing.
    const ms = Date.parse(String(ts).replace(' ', 'T'));
    return Number.isNaN(ms) ? null : ms;
}
/** Groups a run's events into per-tray-line timelines with latest state. */
function computeTrayLines(events) {
    const groups = new Map();
    for (const ev of events) {
        const key = lineKey(ev);
        if (!key)
            continue;
        const arr = groups.get(key);
        if (arr)
            arr.push(ev);
        else
            groups.set(key, [ev]);
    }
    const lines = [];
    for (const [key, hist] of groups) {
        const sorted = [...hist].sort((a, b) => String(a.at).localeCompare(String(b.at)));
        const last = sorted[sorted.length - 1];
        const typeHist = sorted.map((e) => e.event);
        lines.push({
            key,
            residentId: last.resident_id,
            ticketId: last.ticket_id,
            latestEvent: last.event,
            latestAt: last.at,
            latestBy: last.by,
            latestNote: last.note,
            history: sorted,
            isTerminal: exports.TERMINAL_TRAY_EVENTS.includes(last.event),
            allowedNext: allowedNextEvents(typeHist),
        });
    }
    return lines.sort((a, b) => String(a.latestAt).localeCompare(String(b.latestAt)));
}
/**
 * Missed-tray alert computation. A line is 'overdue' when its latest event is
 * 'dispatched' and the dispatch happened more than `slaMinutes` ago; a line
 * explicitly marked 'missed' is always surfaced.
 */
function computeMissedTrays(lines, slaMinutes, nowMs = Date.now()) {
    const out = [];
    for (const line of lines) {
        if (line.latestEvent === 'missed') {
            out.push({
                key: line.key,
                residentId: line.residentId,
                ticketId: line.ticketId,
                kind: 'missed',
                dispatchedAt: line.latestAt,
                minutesOverdue: null,
            });
        }
        else if (line.latestEvent === 'dispatched') {
            const dispatchedMs = parseMs(line.latestAt);
            if (dispatchedMs != null) {
                const overdueMins = (nowMs - dispatchedMs) / 60000 - slaMinutes;
                if (overdueMins > 0) {
                    out.push({
                        key: line.key,
                        residentId: line.residentId,
                        ticketId: line.ticketId,
                        kind: 'overdue',
                        dispatchedAt: line.latestAt,
                        minutesOverdue: Math.floor(overdueMins),
                    });
                }
            }
        }
    }
    return out.sort((a, b) => (b.minutesOverdue ?? Number.MAX_SAFE_INTEGER) - (a.minutesOverdue ?? Number.MAX_SAFE_INTEGER));
}
/**
 * Infers the current meal slot from the facility-local time. Used only when a
 * caller (e.g. the QR assembly scanner) cannot name the slot explicitly.
 */
function inferMealSlot(date = new Date()) {
    const h = date.getHours() + date.getMinutes() / 60;
    if (h < 10)
        return 'breakfast';
    if (h < 11)
        return 'morningSnack';
    if (h < 14)
        return 'lunch';
    if (h < 16)
        return 'afternoonSnack';
    if (h < 20.5)
        return 'dinner';
    return 'breakfast';
}
