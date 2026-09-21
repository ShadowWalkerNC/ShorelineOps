"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_NUMERIC_ORDER = void 0;
exports.activeResidentWhere = activeResidentWhere;
exports.activeCensus = activeCensus;
exports.activeCensusCount = activeCensusCount;
/**
 * Canonical active-census helper (B03).
 *
 * Every meal-count path — weekly order initialization, the production sheet,
 * and tray-card generation — must include only residents with status='Active'.
 * One query, one predicate: Hospital / LOA / Passed Away residents never
 * appear in counts, rosters, or cards.
 *
 * `servingLocation` (Dining Room / Room Tray / Memory Care) is a
 * service-routing field, NOT a census field — never filter census on it.
 *
 * `columns` / `orderBy` accept only internal constant fragments (never user
 * input), so they are interpolated rather than parameterized.
 */
const pool_1 = require("./pool");
/**
 * The single canonical census predicate. Pass a table alias when the query
 * joins residents (e.g. activeResidentWhere('r')); omit it for a bare
 * `FROM residents` subquery.
 */
function activeResidentWhere(alias) {
    return `${alias ? `${alias}.` : ''}status = 'Active'`;
}
/** All residents with status='Active' — the one canonical census query. */
async function activeCensus(opts = {}) {
    const columns = opts.columns ?? '*';
    const orderBy = opts.orderBy ?? 'room ASC';
    const { rows } = await pool_1.pool.query(`SELECT ${columns} FROM residents WHERE ${activeResidentWhere()} ORDER BY ${orderBy}`);
    return rows;
}
/** Count of residents with status='Active' — canonical census headcount. */
async function activeCensusCount() {
    const { rows } = await pool_1.pool.query(`SELECT COUNT(*) as n FROM residents WHERE ${activeResidentWhere()}`);
    return parseInt(rows[0]?.n || '0', 10);
}
/**
 * Numeric-room-first ordering for resident rosters (101, 102, … before MC-1).
 * NOTE: the `~` regex operator is PostgreSQL-only; this ordering fails on
 * SQLite. Pre-existing behavior, preserved here for parity (see B03 report).
 */
exports.ROOM_NUMERIC_ORDER = `
  CASE
    WHEN room ~ '^[0-9]+$' THEN CAST(room AS INTEGER)
    ELSE 999999
  END,
  room
`;
