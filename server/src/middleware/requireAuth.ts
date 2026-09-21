import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

/** Roles accepted by the API — aligned with frontend UserRole. */
export const API_ROLES = [
  'admin',
  'manager',
  'dietitian',
  'frontdesk',
  'dietary',
  'distributor',
  'activities',
  'server',
  'staff',
  'readonly',
] as const

export type ApiRole = (typeof API_ROLES)[number]

export const ACCESS_TOKEN_AUDIENCE = 'shoreline-api'
export const MFA_TOKEN_AUDIENCE = 'shoreline-mfa'

/** Only completed login/refresh flows issue this token class. MFA may be optional. */
export interface AccessTokenClaims extends jwt.JwtPayload {
  sub: string
  role: ApiRole
  purpose: 'access'
  mfa: boolean
  facilityId: string
  platformAdmin: boolean
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      audience: ACCESS_TOKEN_AUDIENCE,
    })
    if (typeof payload === 'string' ||
        typeof payload.sub !== 'string' || !payload.sub.trim() ||
        payload.purpose !== 'access' ||
        typeof payload.mfa !== 'boolean' ||
        typeof payload.facilityId !== 'string' ||
        typeof payload.platformAdmin !== 'boolean' ||
        typeof payload.exp !== 'number' ||
        !(API_ROLES as readonly unknown[]).includes(payload.role)) {
      throw new Error('Invalid access token claims')
    }
    return payload as AccessTokenClaims
  } catch {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 })
  }
}

const ROLE_RANK: Record<ApiRole, number> = {
  readonly:    0,
  distributor: 1,
  staff:       2,
  server:      3,
  activities:  4,
  dietary:     5,
  dietitian:   6,
  frontdesk:   7,
  manager:     8,
  admin:       9,
}

export interface AuthRequest extends Request {
  userId?: string
  userRole?: ApiRole
  facilityId?: string
  platformAdmin?: boolean
}

export function getJwtSecret(): string {
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
    const payload = verifyAccessToken(token)
    req.userId = payload.sub
    req.userRole = payload.role
    req.facilityId = payload.facilityId
    req.platformAdmin = payload.platformAdmin
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.platformAdmin) {
    return res.status(403).json({ error: 'ShorelineOps platform-owner access required' })
  }
  next()
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
