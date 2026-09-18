import { Router } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest, ApiRole } from '../middleware/requireAuth'

export const residentsRouter = Router()

const ResidentSchema = z.object({
  name: z.string().min(1),
  room: z.string().min(1),
  status: z.enum(['Active', 'Hospital', 'LOA', 'Passed Away']).default('Active'),
  dietType: z.string().default('Regular'),
  texture: z.string().default('Regular'),
  portionSize: z.string().default('Regular'),
  ensurePerDay: z.number().int().min(0).default(0),
  allergies: z.array(z.string()).default([]),
  beverages: z.array(z.string()).default([]),
  birthdayMonth: z.string().optional(),
  birthdayDay: z.number().int().nullable().optional(),
  servingLocation: z.string().default('Dining Room'),
  tableAssignment: z.string().default(''),
  likes: z.string().default(''),
  dislikes: z.string().default(''),
  specialInstructions: z.string().default(''),
  // B01: manual NPO / fluid-restriction edits must be possible so the
  // version bump below can fire on them (NPO remains non-overridable downstream).
  isNpo: z.boolean().optional(),
  npoReason: z.string().optional(),
  fluidRestrictionMl: z.number().int().min(0).nullable().optional(),
  // B04: optional effective date for a therapeutic diet order. Only meaningful
  // (and only accepted) alongside a clinical change by a privileged role.
  dietEffectiveDate: z.string().optional().refine(
    (v) => v === undefined || !Number.isNaN(Date.parse(v)),
    { message: 'dietEffectiveDate must be a valid ISO date-time string' }
  ),
})

/**
 * B04 (Owner Decision 3): therapeutic diet order writes are dietitian/manager-only.
 * Strict role equality, following the A05 pattern — NOT rank-based:
 * requireRole('dietitian') would also admit frontdesk, and requireRole('manager')
 * would exclude the dietitian. Neither frontdesk nor admin may write diet orders.
 */
const DIET_WRITE_ROLES = ['dietitian', 'manager'] as const
function canWriteDietOrder(role?: ApiRole): boolean {
  return !!role && (DIET_WRITE_ROLES as readonly string[]).includes(role)
}

/** Fields that constitute a therapeutic diet order (B04). fluidRestrictionMl is
 * part of B01's clinical snapshot, so it gates with the clinical set too. */
const CLINICAL_WRITE_FIELDS = [
  'dietType', 'texture', 'isNpo', 'npoReason', 'allergies',
  'fluidRestrictionMl', 'dietEffectiveDate',
] as const

/** Normalize the allergies column (pg TEXT[] arrives as an array; SQLite stores JSON text). */
function normAllergies(v: any): string[] {
  if (Array.isArray(v)) return [...v].sort()
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      if (Array.isArray(p)) return [...p].sort()
    } catch { /* not JSON — treat as empty */ }
  }
  return []
}

/** Clinical fields tracked by resident_profile_history (migration 013). */
interface ClinicalSnapshot {
  dietType: string
  texture: string
  isNpo: boolean
  npoReason: string
  allergies: string[]
}

function clinicalSnapshot(row: any): ClinicalSnapshot {
  return {
    dietType: row.diet_type ?? 'Regular',
    texture: row.texture ?? 'Regular',
    isNpo: Boolean(row.is_npo),
    npoReason: row.npo_reason ?? '',
    allergies: normAllergies(row.allergies),
  }
}

function clinicalChanged(before: ClinicalSnapshot, after: ClinicalSnapshot) {
  return before.dietType !== after.dietType
    || before.texture !== after.texture
    || before.isNpo !== after.isNpo
    || before.npoReason !== after.npoReason
    || JSON.stringify(before.allergies) !== JSON.stringify(after.allergies)
}

/**
 * B01: bump profile_version when any clinical field changes.
 * Increments residents.profile_version, writes a resident_profile_history row
 * (A06's writer) and a DIET_PROFILE_CHANGED audit entry. Returns the new
 * version, or null when nothing clinical changed (no bump, no writes).
 */
async function bumpProfileVersion(
  residentId: string,
  before: ClinicalSnapshot,
  after: ClinicalSnapshot,
  actorId?: string,
): Promise<number | null> {
  if (!clinicalChanged(before, after)) return null
  // NOTE: no RETURNING — the pool runs UPDATE via sqlite db.run() which
  // returns no rows; re-read the version instead (works on pg + SQLite).
  await pool.query(
    `UPDATE residents
     SET profile_version = COALESCE(profile_version, 1) + 1, updated_at = NOW()
     WHERE id = $1`,
    [residentId]
  )
  const { rows: vRows } = await pool.query(
    'SELECT profile_version FROM residents WHERE id = $1', [residentId]
  )
  const newVersion: number = vRows[0].profile_version
  await pool.query(
    `INSERT INTO resident_profile_history
       (resident_id, profile_version, diet_type, texture, is_npo, allergies)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [residentId, newVersion, after.dietType, after.texture, after.isNpo, after.allergies]
  )
  await pool.query(
    `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
     VALUES ('DIET_PROFILE_CHANGED', $1, $2, 'resident', 'success', $3)`,
    [actorId ?? null, residentId,
     JSON.stringify({ before, after, profile_version: newVersion })]
  )
  return newVersion
}

/** Map DB resident_profile_history row → camelCase object */
function toHistoryRow(row: any) {
  return {
    id: row.id,
    residentId: row.resident_id,
    profileVersion: row.profile_version,
    dietType: row.diet_type,
    texture: row.texture,
    isNpo: Boolean(row.is_npo),
    allergies: normAllergies(row.allergies),
    createdAt: row.created_at,
  }
}

/** Map DB snake_case row → frontend camelCase object */
function toResident(row: any) {
  return {
    id: row.id,
    name: row.name,
    room: row.room,
    status: row.status,
    dietType: row.diet_type,
    texture: row.texture,
    portionSize: row.portion_size,
    ensurePerDay: row.ensure_per_day,
    allergies: row.allergies ?? [],
    beverages: row.beverages ?? [],
    birthdayMonth: row.birthday_month ?? '',
    birthdayDay: row.birthday_day ?? null,
    servingLocation: row.serving_location,
    tableAssignment: row.table_assignment,
    likes: row.likes,
    dislikes: row.dislikes,
    specialInstructions: row.special_instructions,
    // B01: full clinical profile for tray-card generation
    isNpo: Boolean(row.is_npo),
    npoReason: row.npo_reason ?? '',
    fluidRestrictionMl: row.fluid_restriction_ml ?? null,
    profileVersion: row.profile_version ?? 1,
    // B04: diet order provenance (migration 020)
    dietOrderedBy: row.diet_ordered_by ?? null,
    dietOrderDate: row.diet_order_date ?? null,
    dietEffectiveDate: row.diet_effective_date ?? null,
  }
}

// ─────────────────────────────────────────────
// GET /api/residents[?q=<search>]
// ─────────────────────────────────────────────
residentsRouter.get('/', async (req: AuthRequest, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''

    let rows: any[]
    if (q) {
      const like = `%${q}%`
      ;({ rows } = await pool.query(
        `SELECT * FROM residents
         WHERE  name              ILIKE $1
            OR  room              ILIKE $1
            OR  diet_type         ILIKE $1
            OR  status            ILIKE $1
            OR  texture           ILIKE $1
            OR  serving_location  ILIKE $1
         ORDER BY name ASC`,
        [like]
      ))
    } else {
      ;({ rows } = await pool.query('SELECT * FROM residents ORDER BY name ASC'))
    }

    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('VIEW_RESIDENT', $1, 'resident_list', 'success', $2)`,
      [req.userId, JSON.stringify({ search: q || null, count: rows.length })]
    )

    res.json(rows.map(toResident))
  } catch (err) { next(err) }
})

/** Map DB diet_review_flags row → camelCase object */
function toFlag(row: any) {
  return {
    id: row.id,
    residentId: row.resident_id,
    residentName: row.resident_name ?? '',
    residentRoom: row.resident_room ?? '',
    message: row.message ?? '',
    flaggedBy: row.flagged_by ?? null,
    status: row.status,
    createdAt: row.created_at,
    resolvedBy: row.resolved_by ?? null,
    resolvedAt: row.resolved_at ?? null,
  }
}

// ─────────────────────────────────────────────
// GET /api/residents/flags  — open RD review worklist
// B04: dietitian/manager only (strict). NOTE: registered BEFORE '/:id' so
// Express doesn't treat "flags" as a resident id.
// ─────────────────────────────────────────────
residentsRouter.get('/flags', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    if (!canWriteDietOrder(req.userRole)) {
      return res.status(403).json({
        error: 'The diet review worklist is only visible to the dietitian and manager roles.',
      })
    }
    const { rows } = await pool.query(`
      SELECT f.*, r.name AS resident_name, r.room AS resident_room
      FROM diet_review_flags f
      LEFT JOIN residents r ON r.id = f.resident_id
      WHERE f.status = 'OPEN'
      ORDER BY f.created_at ASC
    `)
    res.json(rows.map(toFlag))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// GET /api/residents/:id
// ─────────────────────────────────────────────
residentsRouter.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM residents WHERE id = $1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Resident not found' })
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('VIEW_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(toResident(rows[0]))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// GET /api/residents/:id/history
// Diet/texture/allergy/NPO change trail, newest first (A06 audit trail).
// Same auth as the resident read (requireAuth is mounted at the router level).
// ─────────────────────────────────────────────
residentsRouter.get('/:id/history', async (req: AuthRequest, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      'SELECT id FROM residents WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Resident not found' })
    const { rows } = await pool.query(
      `SELECT * FROM resident_profile_history
       WHERE resident_id = $1
       ORDER BY created_at DESC, profile_version DESC`,
      [req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('VIEW_DIET_HISTORY', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )
    res.json(rows.map(toHistoryRow))
  } catch (err) { next(err) }
})

/** Helper function to parse CSV lines taking into account quoted cells and commas */
export function parseCsvRows(text: string): Record<string, string>[] {
  const lines: string[] = []
  let currentLine = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      inQuotes = !inQuotes
      currentLine += char
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') {
        i++
      }
      if (currentLine.trim()) {
        lines.push(currentLine)
      }
      currentLine = ''
    } else {
      currentLine += char
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine)
  }

  if (lines.length < 2) return []

  const parseLine = (line: string): string[] => {
    const values: string[] = []
    let cur = ''
    let inside = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inside && line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inside = !inside
        }
      } else if (c === ',' && !inside) {
        values.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
    values.push(cur.trim())
    return values
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
  const results: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = vals[idx] !== undefined ? vals[idx] : ''
    })
    results.push(row)
  }
  return results
}

// ─────────────────────────────────────────────
// POST /api/residents/import-csv
// Decision 9: Bulk Census & Diet Order CSV Importer
// Dietitian / Manager / Admin only
// ─────────────────────────────────────────────
residentsRouter.post('/import-csv', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    if (!canWriteDietOrder(req.userRole) && req.userRole !== 'admin') {
      return res.status(403).json({
        error: 'Importing census and clinical diet orders requires the dietitian, manager, or admin role.',
      })
    }

    const { csv } = z.object({ csv: z.string().min(1, 'CSV content cannot be empty') }).parse(req.body)

    const parsedRows = parseCsvRows(csv)
    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in CSV.' })
    }

    let createdCount = 0
    let updatedCount = 0
    const errors: string[] = []

    for (let i = 0; i < parsedRows.length; i++) {
      const r = parsedRows[i]
      const rowNum = i + 2 // 1-based index accounting for header
      const name = (r.name || r.residentname || r.patientname || '').trim()
      const room = (r.room || r.roomnumber || r.bed || '').trim()

      if (!name || !room) {
        errors.push(`Row ${rowNum}: Missing required 'name' or 'room'`)
        continue
      }

      const statusRaw = (r.status || 'Active').trim()
      const validStatuses = ['Active', 'Hospital', 'LOA', 'Passed Away']
      const status = validStatuses.includes(statusRaw) ? statusRaw : 'Active'

      const dietType = (r.diettype || r.diet || 'Regular').trim()
      const texture = (r.texture || r.iddsi || 'Regular').trim()
      const portionSize = (r.portionsize || r.portion || 'Regular').trim()
      const ensurePerDay = parseInt(r.ensureperday || '0', 10) || 0

      // Split allergies and beverages by comma, semicolon, or pipe
      const parseList = (val?: string): string[] => {
        if (!val) return []
        return val.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
      }
      const allergies = parseList(r.allergies || r.allergen)
      const beverages = parseList(r.beverages || r.drinks)

      const birthdayMonth = (r.birthdaymonth || r.birthmonth || '').trim() || null
      const birthdayDay = parseInt(r.birthdayday || r.birthday || '', 10) || null
      const servingLocation = (r.servinglocation || r.location || 'Dining Room').trim()
      const tableAssignment = (r.tableassignment || r.table || '').trim()
      const likes = (r.likes || '').trim()
      const dislikes = (r.dislikes || '').trim()
      const specialInstructions = (r.specialinstructions || r.instructions || r.notes || '').trim()

      const npoRaw = (r.isnpo || r.npo || '').trim().toLowerCase()
      const isNpo = ['true', 'yes', '1', 'y'].includes(npoRaw) || dietType.toUpperCase() === 'NPO'
      const npoReason = (r.nporeason || '').trim()
      const fluidRestrictionMl = parseInt(r.fluidrestrictionml || r.fluidlimit || r.fluidrestriction || '', 10) || null

      // Check if resident exists
      const { rows: existingRows } = await pool.query(
        'SELECT * FROM residents WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND LOWER(TRIM(room)) = LOWER(TRIM($2))',
        [name, room]
      )

      if (existingRows.length > 0) {
        const existing = existingRows[0]
        const before = clinicalSnapshot(existing)
        const after: ClinicalSnapshot = {
          dietType,
          texture,
          isNpo,
          npoReason,
          allergies: normAllergies(allergies),
        }

        await pool.query(
          `UPDATE residents SET
             status = $1, diet_type = $2, texture = $3, portion_size = $4,
             ensure_per_day = $5, allergies = $6, beverages = $7,
             birthday_month = COALESCE($8, birthday_month),
             birthday_day = COALESCE($9, birthday_day),
             serving_location = $10, table_assignment = $11,
             likes = $12, dislikes = $13, special_instructions = $14,
             is_npo = $15, npo_reason = $16,
             fluid_restriction_ml = COALESCE($17, fluid_restriction_ml),
             updated_at = NOW()
           WHERE id = $18`,
          [
            status, dietType, texture, portionSize,
            ensurePerDay, allergies, beverages,
            birthdayMonth, birthdayDay,
            servingLocation, tableAssignment,
            likes, dislikes, specialInstructions,
            isNpo, npoReason,
            fluidRestrictionMl,
            existing.id,
          ]
        )

        await bumpProfileVersion(existing.id, before, after, req.userId)
        updatedCount++
      } else {
        const newId = randomUUID()
        await pool.query(
          `INSERT INTO residents
             (id, name, room, status, diet_type, texture, portion_size, ensure_per_day,
              allergies, beverages, birthday_month, birthday_day, serving_location,
              table_assignment, likes, dislikes, special_instructions,
              is_npo, npo_reason, fluid_restriction_ml, profile_version,
              diet_ordered_by, diet_order_date, diet_effective_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,1,$21,NOW(),NOW())`,
          [
            newId, name, room, status, dietType, texture, portionSize, ensurePerDay,
            allergies, beverages, birthdayMonth, birthdayDay, servingLocation,
            tableAssignment, likes, dislikes, specialInstructions,
            isNpo, npoReason, fluidRestrictionMl,
            req.userId ?? null,
          ]
        )

        await pool.query(
          `INSERT INTO resident_profile_history
             (resident_id, profile_version, diet_type, texture, is_npo, allergies)
           VALUES ($1, 1, $2, $3, $4, $5)`,
          [newId, dietType, texture, isNpo, allergies]
        )

        createdCount++
      }
    }

    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('IMPORT_RESIDENTS_CSV', $1, 'resident', 'success', $2)`,
      [req.userId, JSON.stringify({ created: createdCount, updated: updatedCount, errors })]
    )

    res.status(200).json({
      success: true,
      created: createdCount,
      updated: updatedCount,
      totalProcessed: parsedRows.length,
      errors,
    })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/residents
// ─────────────────────────────────────────────
residentsRouter.post('/', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ResidentSchema.parse(req.body)
    // Portable write: the pool's SQLite path drops RETURNING rows and
    // uuid_generate_v4() defaults don't exist on SQLite, so generate the
    // id client-side and re-read the row after INSERT (B05 inventory pattern).
    const id = randomUUID()
    await pool.query(`
      INSERT INTO residents
        (id, name, room, status, diet_type, texture, portion_size, ensure_per_day,
         allergies, beverages, birthday_month, birthday_day, serving_location,
         table_assignment, likes, dislikes, special_instructions,
         diet_ordered_by, diet_order_date, diet_effective_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
              NOW(), NOW())`,
      [
        id, data.name, data.room, data.status, data.dietType, data.texture,
        data.portionSize, data.ensurePerDay, data.allergies, data.beverages,
        data.birthdayMonth ?? null, data.birthdayDay ?? null,
        data.servingLocation, data.tableAssignment,
        data.likes, data.dislikes, data.specialInstructions,
        // B04: the admission diet order carries provenance too.
        req.userId ?? null,
      ]
    )
    const { rows } = await pool.query(
      'SELECT * FROM residents WHERE id = $1', [id]
    )
    if (!rows[0]) throw new Error('Resident insert failed: row not readable after INSERT')
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, rows[0].id]
    )
    res.status(201).json(toResident(rows[0]))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// PUT /api/residents/:id
// ─────────────────────────────────────────────
residentsRouter.put('/:id', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const data = ResidentSchema.partial().parse(req.body)
    const { rows: existing } = await pool.query(
      `SELECT diet_type, texture, allergies, is_npo, npo_reason, profile_version
       FROM residents WHERE id = $1`, [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Resident not found' })

    // B04 (Owner Decision 3): clinical diet fields are dietitian/manager-only.
    // Aides and every other role may still edit demographics below, but a
    // request that touches a clinical field without a privileged role is
    // refused with 403 — the field-level split, not a whole-endpoint gate.
    const requestedClinical = (Object.keys(req.body ?? {}) as string[]).filter(
      (k) => (CLINICAL_WRITE_FIELDS as readonly string[]).includes(k)
        && (req.body as Record<string, unknown>)[k] !== undefined
    )
    if (requestedClinical.length > 0 && !canWriteDietOrder(req.userRole)) {
      await pool.query(
        `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
         VALUES ('DIET_ORDER_DENIED', $1, $2, 'resident', 'failure', $3)`,
        [req.userId ?? null, req.params.id,
         JSON.stringify({ role: req.userRole ?? 'unknown', fields: requestedClinical })]
      )
      return res.status(403).json({
        error: 'Diet order changes (diet type, texture, NPO, allergies, fluid restriction) ' +
               'require the dietitian or manager role. Use the "Flag for RD review" action instead.',
      })
    }

    // B04: a therapeutic NPO diet order implies the NPO hard-block flag.
    // Privileged roles only (this line is unreachable for other roles, which
    // were refused above). NPO remains non-overridable downstream.
    if (data.dietType === 'NPO') {
      data.isNpo = true
    }

    const before = clinicalSnapshot(existing[0])

    // B01: the pool runs UPDATE via sqlite db.run() (no RETURNING rows),
    // so re-read the row instead of depending on RETURNING *.
    await pool.query(`
      UPDATE residents SET
        name                 = COALESCE($1,  name),
        room                 = COALESCE($2,  room),
        status               = COALESCE($3,  status),
        diet_type            = COALESCE($4,  diet_type),
        texture              = COALESCE($5,  texture),
        portion_size         = COALESCE($6,  portion_size),
        ensure_per_day       = COALESCE($7,  ensure_per_day),
        allergies            = COALESCE($8,  allergies),
        beverages            = COALESCE($9,  beverages),
        birthday_month       = COALESCE($10, birthday_month),
        birthday_day         = COALESCE($11, birthday_day),
        serving_location     = COALESCE($12, serving_location),
        table_assignment     = COALESCE($13, table_assignment),
        likes                = COALESCE($14, likes),
        dislikes             = COALESCE($15, dislikes),
        special_instructions = COALESCE($16, special_instructions),
        is_npo               = COALESCE($17, is_npo),
        npo_reason           = COALESCE($18, npo_reason),
        fluid_restriction_ml = COALESCE($19, fluid_restriction_ml),
        updated_at           = NOW()
      WHERE id = $20`,
      [
        data.name ?? null, data.room ?? null, data.status ?? null,
        data.dietType ?? null, data.texture ?? null,
        data.portionSize ?? null, data.ensurePerDay ?? null,
        data.allergies ?? null, data.beverages ?? null,
        data.birthdayMonth ?? null, data.birthdayDay ?? null,
        data.servingLocation ?? null, data.tableAssignment ?? null,
        data.likes ?? null, data.dislikes ?? null, data.specialInstructions ?? null,
        data.isNpo ?? null, data.npoReason ?? null, data.fluidRestrictionMl ?? null,
        req.params.id,
      ]
    )
    const { rows } = await pool.query(
      'SELECT * FROM residents WHERE id = $1', [req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('EDIT_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )

    // B01: any diet/texture/NPO/allergy change bumps profile_version so
    // previously printed tray cards scan SUPERSEDED. NPO/allergen
    // restrictions remain non-overridable downstream.
    const after = clinicalSnapshot(rows[0])
    const newVersion = await bumpProfileVersion(req.params.id, before, after, req.userId)

    // B04: every clinical change records diet order provenance — who ordered
    // it, when it was ordered, and when it takes effect (optional effective
    // date from the request; otherwise effective immediately).
    let finalRow = rows[0]
    if (newVersion !== null) {
      const effective = data.dietEffectiveDate
        ? new Date(data.dietEffectiveDate).toISOString()
        : null
      await pool.query(
        `UPDATE residents
         SET diet_ordered_by    = $1,
             diet_order_date    = NOW(),
             diet_effective_date = COALESCE($2, NOW())
         WHERE id = $3`,
        [req.userId ?? null, effective, req.params.id]
      )
      const { rows: fresh } = await pool.query(
        'SELECT * FROM residents WHERE id = $1', [req.params.id]
      )
      finalRow = fresh[0]
    }

    res.json(toResident({
      ...finalRow,
      profile_version: newVersion ?? finalRow.profile_version,
    }))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/residents/:id/flags — flag for RD review
// B04 (Owner Decision 3): aides are read-only on clinical diet fields, so
// they get this path instead of edit access. Any staff role may flag.
// ─────────────────────────────────────────────
residentsRouter.post('/:id/flags', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    const { message } = z.object({
      message: z.string().trim().min(1).max(1000),
    }).parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id FROM residents WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Resident not found' })
    // Client-generated id: the pool runs INSERT via sqlite db.run(), which
    // returns no RETURNING rows (B01 pattern) — SELECT by id is deterministic
    // on both backends.
    const flagId = randomUUID()
    await pool.query(`
      INSERT INTO diet_review_flags (id, resident_id, message, flagged_by)
      VALUES ($1, $2, $3, $4)`,
      [flagId, req.params.id, message, req.userId ?? null]
    )
    const { rows } = await pool.query(`
      SELECT f.*, r.name AS resident_name, r.room AS resident_room
      FROM diet_review_flags f
      LEFT JOIN residents r ON r.id = f.resident_id
      WHERE f.id = $1`,
      [flagId]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DIET_FLAG_CREATED', $1, $2, 'resident', 'success')`,
      [req.userId ?? null, req.params.id]
    )
    res.status(201).json(toFlag(rows[0]))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/residents/flags/:flagId/resolve — RD worklist resolution
// B04: dietitian/manager only (strict) — same authority as the diet writes
// the flag is asking about. Does NOT touch the A05 EHR reconcile path.
// ─────────────────────────────────────────────
residentsRouter.post('/flags/:flagId/resolve', requireRole('staff'), async (req: AuthRequest, res, next) => {
  try {
    if (!canWriteDietOrder(req.userRole)) {
      return res.status(403).json({
        error: 'Resolving diet review flags requires the dietitian or manager role.',
      })
    }
    const { action } = z.object({
      action: z.enum(['RESOLVED', 'DISMISSED']),
    }).parse(req.body)
    const { rows: existing } = await pool.query(
      'SELECT id, status FROM diet_review_flags WHERE id = $1', [req.params.flagId]
    )
    if (!existing[0]) return res.status(404).json({ error: 'Flag not found' })
    if (existing[0].status !== 'OPEN') {
      return res.status(409).json({ error: `Flag is already ${existing[0].status}` })
    }
    await pool.query(
      `UPDATE diet_review_flags
       SET status = $1, resolved_by = $2, resolved_at = NOW()
       WHERE id = $3`,
      [action, req.userId ?? null, req.params.flagId]
    )
    const { rows } = await pool.query(`
      SELECT f.*, r.name AS resident_name, r.room AS resident_room
      FROM diet_review_flags f
      LEFT JOIN residents r ON r.id = f.resident_id
      WHERE f.id = $1`,
      [req.params.flagId]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('DIET_FLAG_RESOLVED', $1, $2, 'diet_review_flag', 'success', $3)`,
      [req.userId ?? null, req.params.flagId, JSON.stringify({ action })]
    )
    res.json(toFlag(rows[0]))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// DELETE /api/residents/:id  (admin only)
// ─────────────────────────────────────────────
residentsRouter.delete('/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id FROM residents WHERE id = $1', [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Resident not found' })
    await pool.query('DELETE FROM residents WHERE id = $1', [req.params.id])
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('DELETE_RESIDENT', $1, $2, 'resident', 'success')`,
      [req.userId, req.params.id]
    )
    res.status(204).send()
  } catch (err) { next(err) }
})
