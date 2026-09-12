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
import { pool } from './pool'

/**
 * The single canonical census predicate. Pass a table alias when the query
 * joins residents (e.g. activeResidentWhere('r')); omit it for a bare
 * `FROM residents` subquery.
 */
export function activeResidentWhere(alias?: string): string {
  return `${alias ? `${alias}.` : ''}status = 'Active'`
}

export interface ActiveCensusOptions {
  /** SELECT column list, default '*'. Internal constant only. */
  columns?: string
  /** ORDER BY fragment, default 'room ASC'. Internal constant only. */
  orderBy?: string
}

/** All residents with status='Active' — the one canonical census query. */
export async function activeCensus(opts: ActiveCensusOptions = {}): Promise<any[]> {
  const columns = opts.columns ?? '*'
  const orderBy = opts.orderBy ?? 'room ASC'
  const { rows } = await pool.query(
    `SELECT ${columns} FROM residents WHERE ${activeResidentWhere()} ORDER BY ${orderBy}`
  )
  return rows
}

/** Count of residents with status='Active' — canonical census headcount. */
export async function activeCensusCount(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as n FROM residents WHERE ${activeResidentWhere()}`
  )
  return parseInt(rows[0]?.n || '0', 10)
}

/**
 * Numeric-room-first ordering for resident rosters (101, 102, … before MC-1).
 * NOTE: the `~` regex operator is PostgreSQL-only; this ordering fails on
 * SQLite. Pre-existing behavior, preserved here for parity (see B03 report).
 */
export const ROOM_NUMERIC_ORDER = `
  CASE
    WHEN room ~ '^[0-9]+$' THEN CAST(room AS INTEGER)
    ELSE 999999
  END,
  room
`
