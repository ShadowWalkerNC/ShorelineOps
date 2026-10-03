/**
 * ShorelineOps — static shell routing decisions (server-only).
 *
 * Pure decisions over a unified dist/ tree, shared by the Express static
 * handlers (`server/src/index.ts`) and the maintained node:test suite.
 * Guarantees:
 * - `/` and marketing paths serve the marketing shell,
 * - `/demo` and `/demo/*` serve the demo shell, `/app` and `/app/*` the app
 *   shell (direct open and SPA reloads),
 * - a missing shell bundle is an honest 503, never marketing HTML served as
 *   application HTML,
 * - a missing asset (bundle, chunk, image, …) is an honest 404, never
 *   marketing HTML served as a script or stylesheet,
 * - `/api`, `/health`, and `/ready` pass through to Express (never shells).
 */
import fs from 'fs'
import path from 'path'

export type StaticDecision =
  | { kind: 'file'; file: string }
  | { kind: 'status'; status: number; body: string }
  | { kind: 'next' }

export const MISSING_DEMO_BUNDLE_BODY = 'Demo bundle unavailable'
export const MISSING_APP_BUNDLE_BODY = 'App bundle unavailable'
export const MISSING_ASSET_BODY = 'Not found'

/** Asset-like request: a filename with an extension, or a known asset prefix. */
export function isAssetPath(pathname: string): boolean {
  if (!pathname || typeof pathname !== 'string') return false
  const clean = pathname.split('?')[0].split('#')[0]
  const last = clean.substring(clean.lastIndexOf('/') + 1)
  if (last.includes('.')) return true
  return (
    clean.startsWith('/demo/assets/') ||
    clean.startsWith('/app/assets/') ||
    clean.startsWith('/_astro/')
  )
}

/**
 * Paths Express itself must handle. Mirrors the previous catch-all guard
 * exactly (`startsWith('/api')`, `/health`, `/ready`).
 */
export function isPassthroughPath(pathname: string): boolean {
  if (!pathname || typeof pathname !== 'string') return false
  return pathname.startsWith('/api') || pathname === '/health' || pathname === '/ready'
}

/**
 * Shell for a pathname. Case-insensitive for the shell prefix to match
 * Express's case-insensitive route matching (`/DEMO/x` hits the demo route).
 */
export function shellForPath(pathname: string): 'demo' | 'app' | 'marketing' {
  const lower = (pathname || '').toLowerCase()
  if (lower === '/demo' || lower.startsWith('/demo/')) return 'demo'
  if (lower === '/app' || lower.startsWith('/app/')) return 'app'
  return 'marketing'
}

export function resolveStaticRequest(distRoot: string, pathname: string): StaticDecision {
  if (isPassthroughPath(pathname)) return { kind: 'next' }

  if (isAssetPath(pathname)) {
    const clean = pathname.split('?')[0].split('#')[0]
    const file = path.normalize(path.join(distRoot, clean))
    const root = path.normalize(distRoot)
    if (file !== root && !file.startsWith(root + path.sep)) {
      return { kind: 'status', status: 404, body: MISSING_ASSET_BODY }
    }
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      return { kind: 'file', file }
    }
    return { kind: 'status', status: 404, body: MISSING_ASSET_BODY }
  }

  const shell = shellForPath(pathname)
  if (shell === 'demo') {
    const demoIndex = path.join(distRoot, 'demo', 'index.html')
    if (fs.existsSync(demoIndex)) return { kind: 'file', file: demoIndex }
    return { kind: 'status', status: 503, body: MISSING_DEMO_BUNDLE_BODY }
  }
  if (shell === 'app') {
    const appIndex = path.join(distRoot, 'app', 'index.html')
    if (fs.existsSync(appIndex)) return { kind: 'file', file: appIndex }
    return { kind: 'status', status: 503, body: MISSING_APP_BUNDLE_BODY }
  }
  return { kind: 'file', file: path.join(distRoot, 'index.html') }
}
