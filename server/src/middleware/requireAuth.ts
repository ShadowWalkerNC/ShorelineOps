import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool'

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
  sessionId: string
  authVersion: number
  /**
   * Display-scoped session (TV wall boards). Absent on older tokens and all
   * human sessions. Display tokens are denied by default and only admitted
   * on routes mounted with requireAuth({ allowDisplay: true }).
   */
  display?: boolean
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
        typeof payload.sessionId !== 'string' || !payload.sessionId.trim() ||
        !Number.isSafeInteger(payload.authVersion) || Number(payload.authVersion) < 0 ||
        (payload.display !== undefined && typeof payload.display !== 'boolean') ||
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
  displayOnly?: boolean
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a value at least 32 characters long')
  }
  return secret
}

/** Verify identity and revocable persisted session without trusting stale JWT privileges. */
export async function validateAccessSession(token: string): Promise<AccessTokenClaims> {
  const payload = verifyAccessToken(token)
  let rows: any[]
  try {
    const result = await pool.query(
      `SELECT u.role, u.facility_id, u.platform_admin, u.auth_version, rt.mfa_verified
       FROM users u JOIN refresh_tokens rt ON rt.user_id = u.id
       WHERE u.id = $1 AND u.active = true AND rt.id = $2 AND rt.expires_at > $3
         AND rt.auth_version = u.auth_version`,
      [payload.sub, payload.sessionId, new Date().toISOString()],
    )
    rows = result.rows
  } catch {
    throw Object.assign(new Error('Authentication service unavailable'), { status: 503 })
  }
  const user = rows[0]
  if (!user || user.role !== payload.role || (user.facility_id || 'default') !== payload.facilityId ||
      !!user.platform_admin !== payload.platformAdmin || Number(user.auth_version) !== payload.authVersion) {
    throw Object.assign(new Error('Invalid or revoked session'), { status: 401 })
  }
  if (!!user.mfa_verified !== payload.mfa) throw Object.assign(new Error('Invalid or revoked session'), { status: 401 })
  return payload
}

export interface RequireAuthOptions {
  allowDisplay?: boolean
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void>
export function requireAuth(options: RequireAuthOptions): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
export function requireAuth(reqOrOptions: AuthRequest | RequireAuthOptions, res?: Response, next?: NextFunction): Promise<void> | ((req: AuthRequest, res: Response, next: NextFunction) => Promise<void>) {
  if (typeof (reqOrOptions as AuthRequest).headers === 'undefined' || typeof res === 'undefined' || typeof next === 'undefined') {
    const options = reqOrOptions as RequireAuthOptions
    return (req: AuthRequest, innerRes: Response, innerNext: NextFunction) => runRequireAuth(req, innerRes, innerNext, options)
  }
  return runRequireAuth(reqOrOptions as AuthRequest, res, next, {})
}

async function runRequireAuth(req: AuthRequest, res: Response, next: NextFunction, options: RequireAuthOptions): Promise<void> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = await validateAccessSession(token)
    if (payload.display === true && options.allowDisplay !== true) {
      res.status(403).json({ error: 'Display sessions are limited to TV routes' })
      return
    }
    req.userId = payload.sub
    req.userRole = payload.role
    req.facilityId = payload.facilityId
    req.platformAdmin = payload.platformAdmin
    req.displayOnly = payload.display === true
    next()
  } catch (error: any) {
    if (error.status === 503) { res.status(503).json({ error: 'Authentication service unavailable' }); return }
    res.status(401).json({ error: 'Invalid or expired token' })
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
