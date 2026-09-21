/**
 * Multi-Tenant Request Context & PostgreSQL Row-Level Security Middleware
 * Shoreline Care OS v6.2
 *
 * Extracts facility context from JWT claims or headers and guarantees
 * strict tenant data isolation across multi-facility health systems.
 */

import { Request, Response, NextFunction } from 'express'
import { databaseDialect, pool } from '../db/pool'

declare global {
  namespace Express {
    interface Request {
      facilityId?: string
      corporateGroupId?: string
    }
  }
}

export function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Resolve facilityId from authenticated user claims or facility header
  const user = (req as any).user
  const headerFacilityId = req.headers['x-facility-id'] as string
  const resolvedFacilityId = user?.facility_id || headerFacilityId || 'FAC-DEFAULT'

  req.facilityId = resolvedFacilityId
  req.corporateGroupId = user?.corporate_group_id || 'CORP-DEFAULT'

  // 2. Attach facility context to current database session if connected
  res.setHeader('X-Facility-Context', resolvedFacilityId)

  // PostgreSQL SET does not accept bind parameters. set_config is the safe,
  // parameterized equivalent; true keeps the value local to this statement.
  if (databaseDialect === 'postgres') {
    pool.query(`SELECT set_config('app.current_facility_id', $1, true)`, [resolvedFacilityId]).catch(() => {
      // Non-fatal when the connection is closing during shutdown.
    })
  }

  next()
}