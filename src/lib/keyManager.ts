/**
 * ============================================================
 * KEY MANAGER — In-Memory AES-256-GCM Key via PBKDF2
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(iv) — Encryption/Decryption
 * NIST SP 800-132 — Password-Based Key Derivation
 *
 * The derived CryptoKey lives ONLY in memory (never written to
 * localStorage, sessionStorage, or any persistent store).
 *
 * Flow:
 *   1. Setup wizard: user sets facility passphrase
 *      → generateRecoveryKey() stores salt in sl_key_salt
 *      → initKey(passphrase) derives and holds key in memory
 *   2. Each login: initKey(passphrase) re-derives the key
 *   3. Logout / session timeout: clearKey() wipes it from memory
 *   4. Recovery: importRecoveryKey(base64Salt, passphrase)
 *
 * Salt is NOT secret — it is stored in plain localStorage.
 * Security depends entirely on passphrase strength.
 * ============================================================
 */

const SALT_STORAGE_KEY = 'sl_key_salt'
const PBKDF2_ITERATIONS = 100_000
const KEY_USAGE: KeyUsage[] = ['encrypt', 'decrypt']

let _key: CryptoKey | null = null

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    KEY_USAGE
  )
}

/**
 * Called once during setup wizard to generate and persist the salt.
 * Returns base64-encoded salt as the "recovery key" the admin must save.
 */
async function generateRecoveryKey(passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltB64 = toBase64(salt)
  localStorage.setItem(SALT_STORAGE_KEY, saltB64)
  _key = await deriveKey(passphrase, salt)
  return saltB64
}

/**
 * Called at login — re-derives the key from the stored salt.
 * Throws if no salt found (setup not complete).
 */
async function initKey(passphrase: string): Promise<void> {
  const saltB64 = localStorage.getItem(SALT_STORAGE_KEY)
  if (!saltB64) throw new Error('[KeyManager] No salt found — has setup wizard been completed?')
  const salt = fromBase64(saltB64)
  _key = await deriveKey(passphrase, salt)
}

/**
 * Called during recovery flow — supply saved salt + passphrase.
 */
async function importRecoveryKey(saltB64: string, passphrase: string): Promise<void> {
  const salt = fromBase64(saltB64)
  localStorage.setItem(SALT_STORAGE_KEY, saltB64)
  _key = await deriveKey(passphrase, salt)
}

/** Wipe key from memory — called on logout and session timeout. */
function clearKey(): void {
  _key = null
}

/** Returns the in-memory key, or null if not loaded. */
function getKey(): CryptoKey | null {
  return _key
}

/** Guard — check before any PHI read/write. */
function isKeyReady(): boolean {
  return _key !== null
}

export const keyManager = {
  generateRecoveryKey,
  initKey,
  importRecoveryKey,
  clearKey,
  getKey,
  isKeyReady,
}
