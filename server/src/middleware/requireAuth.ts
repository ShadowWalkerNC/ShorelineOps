import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

/** Roles accepted by the API — aligned with frontend UserRole. */
export const API_ROLES = [
  'admin',
  'manager',
  'frontdesk',
  'dietary',
  'activities',
  'server',
  'staff',
  'readonly',
] as const

export type ApiRole = (typeof API_ROLES)[number]

const ROLE_RANK: Record<ApiRole, number> = {
  readonly: 0,
  staff: 1,
  server: 2,
  activities: 3,
  dietary: 4,
  frontdesk: 5,
  manager: 6,
  admin: 7,
}

export interface AuthRequest extends Request {
  userId?: string
  userRole?: ApiRole
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a value at least 32 characters long')
  }
  return secret
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, getJwtSecret()) as {
      sub: string
      role?: string
    }
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    req.userId = payload.sub
    if (payload.role && payload.role in ROLE_RANK) {
      req.userRole = payload.role as ApiRole
    }
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/** Require the caller to have at least the given role rank. */
export function requireRole(role: ApiRole) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole || ROLE_RANK[req.userRole] < ROLE_RANK[role]) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
