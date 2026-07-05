/**
 * ============================================================
 * BUILD MODE CONFIGURATION
 * ============================================================
 * Set VITE_MODE in your .env or CI environment before building.
 *
 *   VITE_MODE=local   → LAN build (Setup Wizard, encryption, HIPAA)
 *   VITE_MODE=demo    → Public demo site (fake seed data, no real PHI)
 *   VITE_MODE=web     → Marketing/landing page only
 *
 * Anything behind IS_LOCAL or IS_DEMO is tree-shaken out of builds
 * where it doesn't apply. The demo site literally cannot contain
 * encryption keys or real resident data — they are not in the bundle.
 * ============================================================
 */

const mode = import.meta.env.VITE_MODE as string | undefined

/** Running as the on-premises LAN app (full HIPAA feature set). */
export const IS_LOCAL = mode === 'local'

/** Running as the public demo site (seeded fake data, read-mostly). */
export const IS_DEMO = mode === 'demo'

/** Running as the public marketing/landing page. */
export const IS_WEB = mode === 'web'

/** Development fallback — all features enabled when no mode is set. */
export const IS_DEV = !mode

/**
 * Feature gates — import these where you need conditional behaviour.
 *
 * Examples:
 *   import { FEATURES } from '@/config/mode'
 *   if (FEATURES.setupWizard) { ... }
 */
export const FEATURES = {
  /** First-run HIPAA setup wizard (local only). */
  setupWizard: IS_LOCAL || IS_DEV,

  /** AES-256-GCM encryption layer (local only). */
  encryption: IS_LOCAL || IS_DEV,

  /** Full audit log (local only). */
  auditLog: IS_LOCAL || IS_DEV,

  /** Badge-punch time clock kiosk (local only). */
  timeclock: IS_LOCAL || IS_DEV,

  /** Staff call-out tracking (local + demo). */
  callouts: IS_LOCAL || IS_DEMO || IS_DEV,

  /** Demo seed data loader (demo only). */
  demoSeed: IS_DEMO,

  /** Marketing landing page content (web only). */
  marketing: IS_WEB,
} as const
