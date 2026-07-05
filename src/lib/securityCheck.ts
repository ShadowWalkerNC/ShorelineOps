/**
 * ============================================================
 * SECURITY CHECK — Runtime Environment Guards
 * ============================================================
 * HIPAA Security Rule §164.312(e)(2)(ii) — Encryption in transit
 * SOC 2 CC6.6 — Transmission protection
 *
 * Checks run on app load and are surfaced in:
 *   1. A blocking banner if HTTPS is not present
 *   2. The admin security dashboard
 *   3. The setup wizard network step
 * ============================================================
 */

import { keyManager } from './keyManager'

export interface SecurityWarning {
  code: string
  severity: 'critical' | 'high' | 'medium'
  title: string
  description: string
  remediation: string
}

/**
 * Returns true if the app is running over HTTPS (or localhost for dev).
 * Localhost is permitted because dev environments use self-signed or
 * Vite's built-in HTTPS. Production LAN must use HTTPS.
 */
export function isHttps(): boolean {
  const { protocol, hostname } = window.location
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  return protocol === 'https:' || isLocalhost
}

/**
 * Returns true if the app is being accessed from a remote LAN device
 * (not localhost) over plain HTTP — this is the dangerous case.
 */
export function isRemoteHttp(): boolean {
  const { protocol, hostname } = window.location
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  return protocol === 'http:' && !isLocalhost
}

/**
 * Returns the setup completion flag.
 */
export function isSetupComplete(): boolean {
  return localStorage.getItem('sl_setup_complete') === 'true'
}

/**
 * Returns all active security warnings for dashboard display.
 */
export function getSecurityWarnings(): SecurityWarning[] {
  const warnings: SecurityWarning[] = []

  if (isRemoteHttp()) {
    warnings.push({
      code: 'NO_HTTPS_REMOTE',
      severity: 'critical',
      title: 'PHI Transmitted Over Unencrypted Connection',
      description:
        'This application is being accessed from a remote device over HTTP. ' +
        'Protected Health Information (PHI) is visible to anyone on the network. ' +
        'This violates HIPAA Security Rule §164.312(e)(2)(ii).',
      remediation:
        'Configure HTTPS using mkcert or a self-signed certificate on the host machine. ' +
        'See SETUP_LOCAL.md → HTTPS Setup for step-by-step instructions.',
    })
  }

  if (!keyManager.isKeyReady()) {
    warnings.push({
      code: 'KEY_NOT_LOADED',
      severity: 'high',
      title: 'Encryption Key Not Loaded',
      description:
        'The facility encryption key has not been initialized for this session. ' +
        'PHI stored in this application cannot be read or written until the key is loaded.',
      remediation:
        'Log in with your facility passphrase to initialize the encryption key.',
    })
  }

  if (!isSetupComplete()) {
    warnings.push({
      code: 'SETUP_INCOMPLETE',
      severity: 'high',
      title: 'Initial Setup Not Completed',
      description:
        'The setup wizard has not been completed. HIPAA compliance requires ' +
        'administrative safeguards, an assigned Security Officer, and workforce ' +
        'acknowledgments before PHI may be entered.',
      remediation:
        'Complete the setup wizard to configure your facility and compliance settings.',
    })
  }

  return warnings
}

/**
 * Returns true if any critical warnings are active.
 * Used to gate PHI access in the app shell.
 */
export function hasCriticalWarnings(): boolean {
  return getSecurityWarnings().some(w => w.severity === 'critical')
}
