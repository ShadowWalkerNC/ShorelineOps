import type { Request, Response, NextFunction, RequestHandler } from 'express'
import type { Pool } from 'pg'
import { config } from '../config'
import { getSessionAccount, readSessionCookie, type SessionInfo } from './sessions'

export function asyncRoute(handler: (req: SessionRequest, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { void handler(req, res, next).catch(next) }
}

export function db(req: Request): Pool {
  return req.app.locals.pool as Pool
}

export interface SessionRequest extends Request {
  session?: SessionInfo
}

function hasBearer(req: Request): boolean {
  const auth = req.headers.authorization
  return !!auth && auth.toLowerCase().startsWith('bearer ')
}

function bearerRejection(res: Response) {
  return res
    .status(401)
    .json({ error: 'CONTROL_SESSION_REQUIRED', message: 'Control plane accepts opaque account sessions only.' })
}

// Clinical staff JWTs must never authenticate here: any Bearer credential
// (facility access/refresh/MFA token) is rejected outright, never verified.
export function rejectBearer(req: Request, res: Response, next: NextFunction) {
  if (hasBearer(req)) return bearerRejection(res)
  next()
}

export const requireSession = asyncRoute(async (req: SessionRequest, res: Response, next: NextFunction) => {
  if (hasBearer(req)) return bearerRejection(res)
  const token = readSessionCookie(req)
  const session = token ? await getSessionAccount(db(req), token) : null
  if (!session) return res.status(401).json({ error: 'SESSION_REQUIRED' })
  req.session = session
  next()
})

// Origin guard for cookie-authenticated mutations. Safe methods pass through;
// requests without the session cookie have nothing to forge. Same-host Origin
// (or CONTROL_ALLOWED_ORIGINS) is required otherwise.
export function csrfGuard(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (auth && auth.toLowerCase().startsWith('bearer ')) return next() // Bearer is rejected downstream with 401, deterministically
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  if ((Number(req.headers['content-length']) > 0 || req.headers['transfer-encoding']) && !req.is('application/json')) return res.status(415).json({ error: 'JSON_REQUIRED' })
  const candidate = req.headers.origin ?? req.headers.referer
  if (!candidate) return readSessionCookie(req) ? res.status(403).json({ error: 'ORIGIN_FORBIDDEN' }) : next()
  let origin: string
  try {
    origin = new URL(candidate).origin
  } catch {
    return res.status(403).json({ error: 'ORIGIN_FORBIDDEN' })
  }
  if ([config.publicOrigin, ...config.allowedOrigins].includes(origin)) return next()
  return res.status(403).json({ error: 'ORIGIN_FORBIDDEN' })
}
