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
