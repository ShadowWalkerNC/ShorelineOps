import cors, { type CorsOptions } from 'cors'
import type { NextFunction, Request, Response } from 'express'

/**
 * CORS that never rejects its own origin.
 *
 * Subresources fetched with the `crossorigin` attribute (ES module scripts,
 * preloads, stylesheets) use CORS mode and therefore carry an `Origin`
 * header even when same-origin. A strict allowlist that only names
 * FRONTEND_URL would reject those with a 500 JSON error — blanking every
 * page on any deployment whose origin isn't prelisted (LAN IPs, offline
 * servers). Same-origin requests need no CORS processing at all, so let
 * them through and apply the allowlist only to the rest.
 */
export function sameOriginCors(options: CorsOptions) {
  const corsMiddleware = cors(options)
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin
    const host = req.headers.host
    if (typeof origin === 'string' && typeof host === 'string') {
      try {
        if (new URL(origin).host.toLowerCase() === host.split(',')[0].trim().toLowerCase()) {
          // Mirror what cors() emits for an allowed origin so same-origin
          // CORS-mode responses stay indistinguishable from allowlisted ones.
          res.setHeader('Access-Control-Allow-Origin', origin)
          res.setHeader('Vary', 'Origin')
          if (options.credentials) res.setHeader('Access-Control-Allow-Credentials', 'true')
          return next()
        }
      } catch {
        /* malformed Origin — fall through to the allowlist */
      }
    }
    corsMiddleware(req, res, next)
  }
}
