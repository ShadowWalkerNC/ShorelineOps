/**
 * Facility request context middleware.
 * Shoreline Care OS v6.2
 *
 * Extracts the authenticated facility context. This context scopes routes that
 * explicitly query by facility; it is not a substitute for database RLS.
 */

import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken } from './requireAuth'

declare global {
  namespace Express {
    interface Request {
      facilityId?: string
      corporateGroupId?: string
    }
  }
}

export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  // Resolve tenant context only from a verified access token. A platform owner
  // may deliberately select a facility with X-Facility-Id; ordinary users may not.
  let resolvedFacilityId = 'default'
  let platformAdmin = false
  const authorization = req.headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    try {
      const claims = verifyAccessToken(authorization.slice(7))
      resolvedFacilityId = claims.facilityId || 'default'
      platformAdmin = claims.platformAdmin
    } catch {
      // Authentication middleware returns the authoritative 401 later.
    }
  }
  const requestedFacility = req.headers['x-facility-id']
  if (platformAdmin && typeof requestedFacility === 'string' && requestedFacility.trim()) {
    resolvedFacilityId = requestedFacility.trim()
  }

  req.facilityId = resolvedFacilityId
  req.corporateGroupId = 'shorelineops'

  // Attach facility context to the response for diagnostics.
  res.setHeader('X-Facility-Context', resolvedFacilityId)

  next()
}
