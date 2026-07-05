/**
 * ============================================================
 * PASSWORD POLICY ENGINE
 * ============================================================
 * HIPAA Security Rule §164.308(a)(5)(ii)(D) — Password management
 * SOC 2 CC6.1 — Logical access controls
 * NIST SP 800-63B — Digital identity guidelines
 *
 * Rules enforced:
 *   - Minimum 12 characters
 *   - At least 1 uppercase letter
 *   - At least 1 lowercase letter
 *   - At least 1 number
 *   - At least 1 special character
 *   - Not in last 10 passwords (checked via SHA-256 hash)
 *   - 90-day expiry (warning at 83 days, forced reset at 90)
 * ============================================================
 */

export interface PasswordValidationResult {
  valid: boolean
  score: number // 0-4 (0=very weak, 4=very strong)
  errors: string[]
  suggestions: string[]
}

export interface PasswordExpiryStatus {
  expired: boolean
  daysUntilExpiry: number
  shouldWarn: boolean // warn within 7 days
}

const EXPIRY_DAYS = 90
const WARN_DAYS = 7
const HISTORY_SIZE = 10

// ── Validation ────────────────────────────────────────────────────────────

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = []
  const suggestions: string[] = []

  if (password.length < 12)
    errors.push('Password must be at least 12 characters long.')
  if (!/[A-Z]/.test(password))
    errors.push('Password must contain at least one uppercase letter.')
  if (!/[a-z]/.test(password))
    errors.push('Password must contain at least one lowercase letter.')
  if (!/[0-9]/.test(password))
    errors.push('Password must contain at least one number.')
  if (!/[^A-Za-z0-9]/.test(password))
    errors.push('Password must contain at least one special character (e.g. !@#$%^&*).')

  // Strength score (0-4)
  let score = 0
  if (password.length >= 12) score++
  if (password.length >= 16) score++
  if (/[^A-Za-z0-9]/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)) score++
  if (password.length >= 20) score++

  if (score < 2) suggestions.push('Use a longer passphrase with a mix of words, numbers, and symbols.')
  if (!/[^A-Za-z0-9]/.test(password)) suggestions.push('Adding special characters significantly increases strength.')
  if (password.length < 16) suggestions.push('Passwords of 16+ characters are much harder to crack.')

  return { valid: errors.length === 0, score, errors, suggestions }
}

// ── Hashing ───────────────────────────────────────────────────────────────

/**
 * Hash a password using PBKDF2-SHA256 with a random salt.
 * Returns a storable string: "<base64salt>:<base64hash>"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  )
  const raw = await crypto.subtle.exportKey('raw', derived)
  const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  return `${toB64(salt)}:${toB64(raw)}`
}

/**
 * Verify a plaintext password against a stored hash string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [saltB64, hashB64] = stored.split(':')
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0))
    const enc = new TextEncoder()
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
    const derived = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt']
    )
    const raw = await crypto.subtle.exportKey('raw', derived)
    const candidate = btoa(String.fromCharCode(...new Uint8Array(raw)))
    return candidate === hashB64
  } catch {
    return false
  }
}

/**
 * Check if a new password matches any of the last N stored hashes.
 * Returns true if the password is in history (reuse not allowed).
 */
export async function isPasswordInHistory(
  password: string,
  history: string[]
): Promise<boolean> {
  const recent = history.slice(-HISTORY_SIZE)
  for (const stored of recent) {
    if (await verifyPassword(password, stored)) return true
  }
  return false
}

// ── Expiry ────────────────────────────────────────────────────────────────

export function checkPasswordExpiry(passwordSetAt: string): PasswordExpiryStatus {
  const setDate = new Date(passwordSetAt).getTime()
  const now = Date.now()
  const daysSinceSet = Math.floor((now - setDate) / (1000 * 60 * 60 * 24))
  const daysUntilExpiry = EXPIRY_DAYS - daysSinceSet
  return {
    expired: daysUntilExpiry <= 0,
    daysUntilExpiry: Math.max(0, daysUntilExpiry),
    shouldWarn: daysUntilExpiry <= WARN_DAYS && daysUntilExpiry > 0,
  }
}
