import type { NextFunction, Request, Response } from 'express'

/**
 * Plaintext deployments (LAN / offline-first facility servers) serve over
 * HTTP. Helmet's global CSP includes `upgrade-insecure-requests`, which
 * makes browsers upgrade every subresource to https:// against a plaintext
 * server — every fetch fails TLS and the page renders blank with zero JS
 * errors. Strip just that directive when the request did not arrive over
 * TLS. HTTPS deployments (direct, or behind a trusting proxy that sets
 * X-Forwarded-Proto) keep the directive untouched.
 *
 * Mount BEFORE helmet: it wraps res.setHeader so helmet's own write is
 * filtered. Mounted after, the header is already stored and nothing happens.
 */
export function stripUpgradeInsecureRequests(req: Request, res: Response, next: NextFunction): void {
  if (!req.secure) {
    const original = res.setHeader.bind(res) as (name: string, value: number | string | string[]) => Response
    res.setHeader = ((name: string, value: number | string | string[]) => {
      if (name.toLowerCase() === 'content-security-policy' && typeof value === 'string') {
        const kept = value
          .split(';')
          .map((directive) => directive.trim())
          .filter((directive) => directive !== '' && directive !== 'upgrade-insecure-requests')
        return original(name, kept.join('; '))
      }
      return original(name, value)
    }) as typeof res.setHeader
  }
  next()
}
