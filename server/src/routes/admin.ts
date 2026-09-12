import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

const RoleEnum = z.enum([
  'admin',
  'manager',
  'frontdesk',
  'dietary',
  'activities',
  'server',
  'staff',
  'readonly',
])

export const adminRouter = Router()

// All admin routes require at minimum staff; most require admin.
// requireAuth is already applied at the app level for /api/admin.

// ── Mappers ────────────────────────────────────────────────────────────────────

function toUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at ?? null,
  }
}

function toAuditEntry(row: any) {
  return {
    id: row.id,
    action: row.action,
    userId: row.user_id ?? undefined,
    userName: row.user_name ?? undefined,
    resourceId: row.resource_id ?? undefined,
    resourceType: row.resource_type ?? undefined,
    timestamp: row.created_at,
    outcome: row.outcome,
    ipAddress: row.ip_address ?? undefined,
    details: row.details ?? undefined,
  }
}

function toSettings(row: any) {
  return {
    facilityName: row.facility_name,
    timezone: row.timezone,
    sessionTimeoutMinutes: row.session_timeout_minutes,
    mfaRequired: row.mfa_required,
    allowReadonlyExport: row.allow_readonly_export,
    maintenanceMode: row.maintenance_mode,
  }
}

// ════════════════════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin/users
adminRouter.get('/users', requireRole('admin'), async (_req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, active, created_at, last_login_at FROM users ORDER BY name ASC'
    )
    res.json(rows.map(toUser))
  } catch (err) { next(err) }
})

// POST /api/admin/users
adminRouter.post('/users', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: RoleEnum,
      password: z.string().min(12).optional(),
    }).parse(req.body)

    // Generate a cryptographically strong initial password if one is not supplied
    const plainPassword = data.password ?? (crypto.randomBytes(18).toString('base64url') + 'A1!')
    const passwordHash = await bcrypt.hash(plainPassword, 12)

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, active, created_at, last_login_at`,
      [data.name, data.email.toLowerCase(), passwordHash, data.role]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome)
       VALUES ('CREATE_USER', $1, $2, 'user', 'success')`,
      [req.userId, rows[0].id]
    )
    // Return new user + temporary password so admin can share it
    res.status(201).json({ ...toUser(rows[0]), temporaryPassword: data.password ? undefined : plainPassword })
  } catch (err) { next(err) }
})

// PATCH /api/admin/users/:id
// Handles role changes, activate/deactivate, and optional password reset.
adminRouter.patch('/users/:id', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      role:     RoleEnum.optional(),
      active:   z.boolean().optional(),
      password: z.string().min(12).optional(),
    }).parse(req.body)

    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE id = $1', [req.params.id]
    )
    if (!existing[0]) return res.status(404).json({ error: 'User not found' })

    let passwordHash: string | null = null
    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, 12)
    }

    const { rows } = await pool.query(
      `UPDATE users SET
         role       = COALESCE($1, role),
         active     = COALESCE($2, active),
         password   = CASE WHEN $3::text IS NOT NULL THEN $3::text ELSE password END,
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, role, active, created_at, last_login_at`,
      [data.role ?? null, data.active ?? null, passwordHash, req.params.id]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_id, resource_type, outcome, details)
       VALUES ('UPDATE_USER', $1, $2, 'user', 'success', $3)`,
      [req.userId, req.params.id, JSON.stringify({
        changedFields: Object.keys(data).filter(k => (data as any)[k] !== undefined && k !== 'password'),
      })]
    )
    res.json(toUser(rows[0]))
  } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin/audit?limit=50&offset=0&userId=<uuid>
adminRouter.get('/audit', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const limit  = Math.min(parseInt(String(req.query.limit  ?? 50),  10), 200)
    const offset = parseInt(String(req.query.offset ?? 0),  10)
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null

    let queryText: string
    let queryParams: any[]

    if (userId) {
      queryText = `
        SELECT a.*, u.name AS user_name
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2 OFFSET $3`
      queryParams = [userId, limit, offset]
    } else {
      queryText = `
        SELECT a.*, u.name AS user_name
        FROM audit_log a
        LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2`
      queryParams = [limit, offset]
    }

    const { rows } = await pool.query(queryText, queryParams)
    res.json(rows.map(toAuditEntry))
  } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM SETTINGS
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin/settings
adminRouter.get('/settings', requireRole('admin'), async (_req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM system_settings WHERE id = 1')
    if (!rows[0]) return res.status(404).json({ error: 'Settings not found' })
    res.json(toSettings(rows[0]))
  } catch (err) { next(err) }
})

// PATCH /api/admin/settings
adminRouter.patch('/settings', requireRole('admin'), async (req: AuthRequest, res, next) => {
  try {
    const data = z.object({
      facilityName:           z.string().min(1).optional(),
      timezone:               z.string().optional(),
      sessionTimeoutMinutes:  z.number().int().min(1).max(1440).optional(),
      mfaRequired:            z.boolean().optional(),
      allowReadonlyExport:    z.boolean().optional(),
      maintenanceMode:        z.boolean().optional(),
    }).parse(req.body)

    const { rows } = await pool.query(
      `UPDATE system_settings SET
         facility_name           = COALESCE($1, facility_name),
         timezone                = COALESCE($2, timezone),
         session_timeout_minutes = COALESCE($3, session_timeout_minutes),
         mfa_required            = COALESCE($4, mfa_required),
         allow_readonly_export   = COALESCE($5, allow_readonly_export),
         maintenance_mode        = COALESCE($6, maintenance_mode),
         updated_at              = NOW()
       WHERE id = 1 RETURNING *`,
      [
        data.facilityName          ?? null,
        data.timezone              ?? null,
        data.sessionTimeoutMinutes ?? null,
        data.mfaRequired           ?? null,
        data.allowReadonlyExport   ?? null,
        data.maintenanceMode       ?? null,
      ]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('UPDATE_SETTINGS', $1, 'system_settings', 'success', $2)`,
      [req.userId, JSON.stringify(data)]
    )
    res.json(toSettings(rows[0]))
  } catch (err) { next(err) }
})

// ════════════════════════════════════════════════════════════════════════════
// FACILITY SETTINGS (C04: server-synced, multi-device)
// ════════════════════════════════════════════════════════════════════════════
//
// The Settings page sections (facility profile, operations, integrations,
// security) live in the facility_settings table keyed by (facility_id, key)
// so every device in the facility sees the same values. Reads require only
// authentication; writes require manager role and are audit-logged.
// Migration 024 owns the DDL + default seeds; the GET below also
// materializes rows once from the setup-wizard facility_config row so a
// facility that ran the wizard picks up its values automatically.

// Server-side copy of the client DEFAULT_SETTINGS in
// src/state/settingsStore.ts — fallback when no rows exist yet.
const DEFAULT_FACILITY_SETTINGS = {
  facility: {
    name: 'Shoreline Healthcare & Rehabilitation',
    organization: 'Shoreline Senior Living Group LLC',
    npiNumber: '1942857102',
    licenseNumber: 'SNF-ME-40891',
    facilityType: 'Skilled Nursing',
    address: '104 Shoreline Drive, Portland, ME 04101',
    phone: '(207) 555-0199',
    email: 'dietary.ops@shorelinecare.com',
    directorOfDining: 'Chef Marcus Vance, CDM, CFPP',
    registeredDietitian: 'Sarah Jenkins, MS, RDN, LD',
  },
  operations: {
    wings: ['Coastal Wing (Assisted Living)', 'Harbor View (Memory Care)', 'Atlantic Rehab Unit'],
    diningRooms: ['Main Dining Hall', 'Harbor Bistro', 'In-Room Bedside Tray Service'],
    targetCpd: 8.75,
    mealTimes: { breakfast: '07:30', lunch: '12:00', dinner: '17:30', snack: '20:00' },
    temperatureUnit: 'F',
    iddsiStrictEnforcement: true,
    fourteenHourRuleCheck: true,
  },
  integrations: {
    primaryDistributor: 'dennis',
    distributorCustomerNumber: 'DEN-884910',
    pccFacilityId: 'FAC-PORTLAND-01',
    autoSyncCensus: true,
    invoiceOcrAutoApprove: false,
  },
  security: {
    sessionTimeoutMinutes: 30,
    hipaaAuditRetentionDays: 2555,
    baaSignedDate: '2026-01-15',
    baaSignee: 'Marcus Vance (Executive Director)',
  },
} as const

const FACILITY_SETTING_KEYS = ['facility', 'operations', 'integrations', 'security'] as const
type FacilitySettingKey = (typeof FACILITY_SETTING_KEYS)[number]

const FacilitySectionSchema = z.object({
  name: z.string().min(1),
  organization: z.string(),
  npiNumber: z.string(),
  licenseNumber: z.string(),
  facilityType: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  directorOfDining: z.string(),
  registeredDietitian: z.string(),
}).partial()

const OperationsSectionSchema = z.object({
  wings: z.array(z.string()),
  diningRooms: z.array(z.string()),
  targetCpd: z.number().nonnegative(),
  mealTimes: z.object({
    breakfast: z.string(),
    lunch: z.string(),
    dinner: z.string(),
    snack: z.string(),
  }).partial(),
  temperatureUnit: z.enum(['F', 'C']),
  iddsiStrictEnforcement: z.boolean(),
  fourteenHourRuleCheck: z.boolean(),
}).partial()

const IntegrationsSectionSchema = z.object({
  primaryDistributor: z.enum(['dennis', 'sysco', 'usfoods', 'gordon', 'pfg']),
  distributorCustomerNumber: z.string(),
  pccFacilityId: z.string(),
  autoSyncCensus: z.boolean(),
  invoiceOcrAutoApprove: z.boolean(),
}).partial()

const SecuritySectionSchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(1).max(1440),
  hipaaAuditRetentionDays: z.number().int().positive(),
  baaSignedDate: z.string(),
  baaSignee: z.string(),
}).partial()

const FacilitySettingsBodySchema = z.object({
  facility: FacilitySectionSchema.optional(),
  operations: OperationsSectionSchema.optional(),
  integrations: IntegrationsSectionSchema.optional(),
  security: SecuritySectionSchema.optional(),
}).refine(
  b => b.facility !== undefined || b.operations !== undefined ||
       b.integrations !== undefined || b.security !== undefined,
  { message: 'At least one settings section is required' }
)

function parseSettingValue(raw: unknown): Record<string, any> {
  if (raw == null) return {}
  if (typeof raw === 'object') return raw as Record<string, any>
  try {
    const parsed = JSON.parse(String(raw))
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Deep-merge plain objects (arrays are replaced) so a partial nested patch
 *  like { mealTimes: { lunch: '12:30' } } never wipes sibling fields. */
function deepMerge(base: Record<string, any>, patch: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = isPlainObject(v) && isPlainObject(out[k]) ? deepMerge(out[k], v) : v
  }
  return out
}

// One-time materialization for databases that have no facility_settings rows
// yet (e.g. a facility that ran the setup wizard before migration 024):
// carry the wizard's facility_config values into the new table, layered over
// the default seeds so nothing the operator entered is lost.
async function seedFacilitySettingsFromConfig(facilityId: string, updatedBy: string | null) {
  const { rows: cfgRows } = await pool.query(
    'SELECT facility_name, npi_license, address, primary_contact_email, facility_type, wings, dining_rooms, baa_signee_name FROM facility_config WHERE id = $1',
    [facilityId]
  )
  const cfg = cfgRows[0]
  const sections: Record<FacilitySettingKey, Record<string, any>> = {
    facility: { ...DEFAULT_FACILITY_SETTINGS.facility },
    operations: { ...DEFAULT_FACILITY_SETTINGS.operations, mealTimes: { ...DEFAULT_FACILITY_SETTINGS.operations.mealTimes } },
    integrations: { ...DEFAULT_FACILITY_SETTINGS.integrations },
    security: { ...DEFAULT_FACILITY_SETTINGS.security },
  }
  if (cfg) {
    if (cfg.facility_name) sections.facility.name = cfg.facility_name
    if (cfg.address) sections.facility.address = cfg.address
    if (cfg.npi_license) sections.facility.npiNumber = cfg.npi_license
    if (cfg.facility_type) sections.facility.facilityType = cfg.facility_type
    if (cfg.primary_contact_email) sections.facility.email = cfg.primary_contact_email
    if (cfg.baa_signee_name) sections.security.baaSignee = cfg.baa_signee_name
    // facility_config stores wings/dining_rooms as JSON arrays (sqlite read
    // path may already have parsed them); accept either form.
    const wings = typeof cfg.wings === 'string' ? parseSettingValue(cfg.wings) : cfg.wings
    if (Array.isArray(wings) && wings.length) sections.operations.wings = wings.map(String)
    const rooms = typeof cfg.dining_rooms === 'string' ? parseSettingValue(cfg.dining_rooms) : cfg.dining_rooms
    if (Array.isArray(rooms) && rooms.length) sections.operations.diningRooms = rooms.map(String)
  }
  for (const key of FACILITY_SETTING_KEYS) {
    await pool.query(
      `INSERT INTO facility_settings (facility_id, key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (facility_id, key) DO NOTHING`,
      [facilityId, key, JSON.stringify(sections[key]), updatedBy]
    )
  }
}

async function readFacilitySettings(facilityId: string) {
  const { rows } = await pool.query(
    'SELECT key, value, updated_by, updated_at FROM facility_settings WHERE facility_id = $1',
    [facilityId]
  )
  const settings: Record<string, any> = {}
  const meta: Record<string, { updatedBy: string | null; updatedAt: string | null }> = {}
  for (const row of rows) {
    settings[row.key] = parseSettingValue(row.value)
    meta[row.key] = { updatedBy: row.updated_by ?? null, updatedAt: row.updated_at ?? null }
  }
  for (const key of FACILITY_SETTING_KEYS) {
    if (!settings[key]) {
      settings[key] = JSON.parse(JSON.stringify(DEFAULT_FACILITY_SETTINGS[key]))
    }
  }
  return { settings, meta }
}

// GET /api/admin/facility-settings — any authenticated device can read
// (meal times, wings, dining rooms are needed by kitchen tablets).
adminRouter.get('/facility-settings', async (req: AuthRequest, res, next) => {
  try {
    const facilityId = 'default'
    let { rows } = await pool.query(
      'SELECT 1 FROM facility_settings WHERE facility_id = $1 LIMIT 1',
      [facilityId]
    )
    if (rows.length === 0) {
      await seedFacilitySettingsFromConfig(facilityId, req.userId ?? null)
    }
    const { settings, meta } = await readFacilitySettings(facilityId)
    res.json({ facilityId, settings, meta })
  } catch (err) { next(err) }
})

// PUT /api/admin/facility-settings — manager+ only, audit-logged.
// Partial sections are merged server-side so concurrent edits to different
// sections don't clobber each other. Last write wins per section; the
// client surfaces "server wins" when it detects it was out of date.
adminRouter.put('/facility-settings', requireRole('manager'), async (req: AuthRequest, res, next) => {
  try {
    const body = FacilitySettingsBodySchema.parse(req.body)
    const facilityId = 'default'
    const changedKeys: FacilitySettingKey[] = []
    for (const key of FACILITY_SETTING_KEYS) {
      const patch = body[key]
      if (patch === undefined) continue
      const { rows } = await pool.query(
        'SELECT value FROM facility_settings WHERE facility_id = $1 AND key = $2',
        [facilityId, key]
      )
      const current = rows[0] ? parseSettingValue(rows[0].value) : {}
      const merged = deepMerge(current, patch as Record<string, any>)
      await pool.query(
        `INSERT INTO facility_settings (facility_id, key, value, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (facility_id, key)
         DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [facilityId, key, JSON.stringify(merged), req.userId ?? null]
      )
      changedKeys.push(key)
    }
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('UPDATE_FACILITY_SETTINGS', $1, 'facility_settings', 'success', $2)`,
      [req.userId, JSON.stringify({ facilityId, keys: changedKeys })]
    )
    const { settings, meta } = await readFacilitySettings(facilityId)
    res.json({ facilityId, settings, meta })
  } catch (err) { next(err) }
})
