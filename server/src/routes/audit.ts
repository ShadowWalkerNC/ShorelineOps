import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireRole } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

export const auditRouter = Router()

const AuditEventSchema = z.object({
  action: z.string(),
  userId: z.string().optional(),
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
  outcome: z.enum(['success', 'failure']),
  userAgent: z.string().optional(),
  details: z.record(z.unknown()).optional(),
})

// POST /api/audit  — receives events from the frontend auditLog utility
auditRouter.post('/', async (req: AuthRequest, res, next) => {
  try {
    const event = AuditEventSchema.parse(req.body)
    await pool.query(
      `INSERT INTO audit_log
         (action, user_id, resource_id, resource_type, outcome, ip_address, user_agent, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        event.action,
        event.userId ?? req.userId ?? null,
        event.resourceId ?? null,
        event.resourceType ?? null,
        event.outcome,
        req.ip,
        event.userAgent ?? req.headers['user-agent'] ?? null,
        event.details ? JSON.stringify(event.details) : null,
      ]
    )
    res.json({ success: true })
  } catch (err) { next(err) }
})

// GET /api/audit  — admin only, view audit log
auditRouter.get('/', requireRole('admin'), async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500'
    )
    res.json(rows)
  } catch (err) { next(err) }
})
