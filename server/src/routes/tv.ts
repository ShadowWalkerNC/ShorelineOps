import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'
import { requireCapability } from '../middleware/permissions'
import { issueSession } from './auth'

export const tvRouter = Router()

/**
 * Wall-display pairing + aggregate feeds for facility TVs.
 *
 * No endpoint in this router returns resident-level data. The ops feed is
 * counts only (COUNT/GROUP BY over status columns); menu content flows
 * through the existing menu.read endpoints whose payloads carry no PHI.
 *
 * Display sessions are `readonly` sessions carrying the signed `display`
 * claim, bound to the approving manager's facility. requireAuth denies them
 * everywhere except mounts opted in with allowDisplay (auth refresh, menu,
 * production, trayrun reads, TV ops feed), so a display token — or its
 * thief — cannot reach resident, clinical, or write routes.
 *
 * Pairing binds tokens to the requesting TV via a claim secret: only the
 * holder of the claim secret returned by /pair/request can collect the
 * session from /pair/status. Managers must approve only codes physically
 * shown on a facility TV.
 *
 * Revocation: disable the facility's TV Display user (sticky — approval
 * refuses while disabled), bump its auth_version, or delete its session.
 */

// ── Pairing store (in-memory, single-use codes) ──────────────────────────────

const PAIR_TTL_MS = 10 * 60 * 1000
const MAX_PENDING = 200
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

interface PairingEntry {
  label: string
  /** Secret binding the code to the requesting TV; required to collect tokens. */
  claimToken: string
  createdAt: number
  /** Synchronous claim flag: set before the approval awaits to serialize races. */
  approving: boolean
  approved?: { accessToken: string; refreshToken: string; facilityId: string }
}

const pendingPairings = new Map<string, PairingEntry>()

function prunePairings(now = Date.now()): void {
  for (const [code, entry] of pendingPairings) {
    if (now - entry.createdAt > PAIR_TTL_MS) pendingPairings.delete(code)
  }
}

function newPairingCode(): string {
  let code = ''
  do {
    code = Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('')
  } while (pendingPairings.has(code))
  return code
}

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z2-9]{6}$/.test(code) ? code : null
}

const pairRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
})

// ── Display identity ─────────────────────────────────────────────────────────

const DISPLAY_NAME = 'TV Display'

function displayEmail(facilityId: string): string {
  const slug = facilityId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'default'
  return `tv-display+${slug}@shoreline.local`
}

/** Ensure the reserved read-only service identity for this facility's TVs. */
async function ensureDisplayUser(facilityId: string): Promise<{
  id: string; name: string; email: string; role: string;
  auth_version: number; facility_id?: string; platform_admin?: boolean;
}> {
  const email = displayEmail(facilityId)
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email])
  if (rows[0]) {
    // Disable-based revocation is sticky: refusing while inactive keeps an
    // admin's revoke-all-walls action in force until they re-enable the user.
    if (!rows[0].active) {
      throw Object.assign(new Error('TV Display identity is disabled for this facility'), { status: 403 })
    }
    await pool.query(
      `UPDATE users SET role = 'readonly', facility_id = $2, updated_at = NOW() WHERE id = $1`,
      [rows[0].id, facilityId]
    )
    return {
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: 'readonly',
      auth_version: Number(rows[0].auth_version ?? 0),
      facility_id: facilityId,
      platform_admin: false,
    }
  }
  const id = crypto.randomUUID()
  const password = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 10)
  await pool.query(
    `INSERT INTO users (id, name, email, password, role, active, platform_admin, facility_id)
     VALUES ($1, $2, $3, $4, 'readonly', true, false, $5)`,
    [id, DISPLAY_NAME, email, password, facilityId]
  )
  return { id, name: DISPLAY_NAME, email, role: 'readonly', auth_version: 0, facility_id: facilityId, platform_admin: false }
}

// ── Pairing endpoints ────────────────────────────────────────────────────────

// POST /api/tv/pair/request — TV asks for a short code to show on screen.
tvRouter.post('/pair/request', pairRequestLimiter, async (req, res, next) => {
  try {
    const { label } = z.object({ label: z.string().max(64).optional().default('') }).parse(req.body ?? {})
    // Attacker-controlled label is shown to the approver: strip control
    // characters and collapse whitespace before storing.
    const cleanLabel = label.replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim().slice(0, 64)
    prunePairings()
    if (pendingPairings.size >= MAX_PENDING) {
      return res.status(503).json({ error: 'Too many pending pairings, try again shortly' })
    }
    const code = newPairingCode()
    const claimToken = crypto.randomBytes(32).toString('hex')
    pendingPairings.set(code, { label: cleanLabel, claimToken, createdAt: Date.now(), approving: false })
    res.status(201).json({ code, claimToken, expiresInSeconds: Math.floor(PAIR_TTL_MS / 1000) })
  } catch (err) {
    next(err)
  }
})

function claimMatches(raw: unknown, expected: string): boolean {
  if (typeof raw !== 'string') return false
  const a = Buffer.from(raw, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// GET /api/tv/pair/status?code=XXXXXX&claim=… — TV polls until approved.
tvRouter.get('/pair/status', async (req, res) => {
  const code = normalizeCode(req.query.code)
  const entry = code ? pendingPairings.get(code) : undefined
  if (!code || !entry || Date.now() - entry.createdAt > PAIR_TTL_MS) {
    if (code) pendingPairings.delete(code)
    return res.status(404).json({ error: 'Invalid or expired code' })
  }
  if (!claimMatches(req.query.claim, entry.claimToken)) {
    return res.status(404).json({ error: 'Invalid or expired code' })
  }
  if (!entry.approved) {
    const remaining = Math.max(0, Math.ceil((PAIR_TTL_MS - (Date.now() - entry.createdAt)) / 1000))
    return res.json({ status: 'pending', expiresInSeconds: remaining })
  }
  pendingPairings.delete(code)
  res.json({ status: 'approved', ...entry.approved })
})

// POST /api/tv/pair/approve — manager/admin approves a code shown on a TV.
tvRouter.post('/pair/approve', requireAuth, requireRole('manager'), async (req: AuthRequest, res, next) => {
  try {
    const { code: rawCode } = z.object({ code: z.string().min(1).max(16) }).parse(req.body ?? {})
    const code = normalizeCode(rawCode)
    const entry = code ? pendingPairings.get(code) : undefined
    if (!code || !entry || Date.now() - entry.createdAt > PAIR_TTL_MS) {
      if (code) pendingPairings.delete(code)
      return res.status(404).json({ error: 'Invalid or expired code' })
    }
    if (entry.approved || entry.approving) {
      return res.status(409).json({ error: 'Code already used' })
    }
    // Synchronous claim: concurrent approves of one code serialize here
    // instead of double-issuing sessions across the awaits below.
    entry.approving = true
    try {
      const facilityId = req.facilityId || 'default'
      const displayUser = await ensureDisplayUser(facilityId)
      const session = await issueSession(displayUser, false, true)
      entry.approved = { accessToken: session.accessToken, refreshToken: session.refreshToken, facilityId }
      await pool.query(
        `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
         VALUES ('TV_PAIR_APPROVE', $1, 'tv_display', 'success', $2)`,
        [req.userId ?? null, JSON.stringify({ label: entry.label || undefined, facilityId })]
      )
    } catch (err) {
      entry.approving = false
      throw err
    }
    res.json({ status: 'approved', label: entry.label })
  } catch (err) {
    next(err)
  }
})

// ── Aggregate ops feed (counts only — no PHI by construction) ────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

const toCount = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

// GET /api/tv/ops-today — counts for the wall display. Any read role passes;
// the payload is identical for every caller because it contains no PHI.
tvRouter.get('/ops-today', requireAuth({ allowDisplay: true }), requireCapability('production.read', 'trayruns.read'), async (_req: AuthRequest, res, next) => {
  try {
    const date = todayString()
    let facilityName = 'Shoreline'
    try {
      const { rows } = await pool.query('SELECT facility_name FROM system_settings WHERE id = 1')
      if (rows[0]?.facility_name) facilityName = String(rows[0].facility_name)
    } catch {
      /* fall back to default name */
    }

    const { rows: weeks } = await pool.query(
      'SELECT id FROM menu_weeks WHERE active = true ORDER BY updated_at DESC LIMIT 1'
    )
    const activeWeekId: string | null = weeks[0]?.id ?? null

    let sheetsTotal = 0
    let sheetsSigned = 0
    if (activeWeekId) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS total, COUNT(signed_off_at) AS signed
         FROM production_sheets WHERE menu_week_id = $1`,
        [activeWeekId]
      )
      sheetsTotal = toCount(rows[0]?.total)
      sheetsSigned = toCount(rows[0]?.signed)
    }

    const { rows: runRows } = await pool.query(
      'SELECT COUNT(*) AS runs FROM tray_runs WHERE service_date = $1',
      [date]
    )
    const { rows: eventRows } = await pool.query(
      `SELECT event, COUNT(*) AS n FROM tray_events
       WHERE run_id IN (SELECT id FROM tray_runs WHERE service_date = $1)
       GROUP BY event`,
      [date]
    )
    const events: Record<string, number> = { assembled: 0, dispatched: 0, delivered: 0, missed: 0, remade: 0 }
    for (const row of eventRows) {
      // Own-key check: event names come from a CHECK-constrained column, but a
      // prototype-chain `in` test would still accept names like 'toString'.
      if (typeof row.event === 'string' && Object.prototype.hasOwnProperty.call(events, row.event)) {
        events[row.event] = toCount(row.n)
      }
    }

    res.json({
      date,
      facilityName,
      production: { total: sheetsTotal, signedOff: sheetsSigned, pending: Math.max(0, sheetsTotal - sheetsSigned) },
      trays: { runs: toCount(runRows[0]?.runs), ...events },
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/tv/crew-today — Active dietary crew for the wall (names + roles
// only). Column-explicit: phone, email, emergency contacts, certifications,
// and manager notes never leave the server.
tvRouter.get('/crew-today', requireAuth({ allowDisplay: true }), requireCapability('kitchen.read'), async (_req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT first_name, preferred_name, last_name, position, department
       FROM staff_profiles WHERE status = 'Active' AND department = 'Dietary'
       ORDER BY CASE role WHEN 'manager' THEN 0 ELSE 1 END, last_name, first_name
       LIMIT 50`
    )
    const crew = rows.map(row => ({
      name: `${row.preferred_name || row.first_name} ${row.last_name}`.trim(),
      position: String(row.position ?? ''),
      department: String(row.department ?? ''),
    }))
    res.json({ date: todayString(), crew, generatedAt: new Date().toISOString() })
  } catch (err) {
    next(err)
  }
})
