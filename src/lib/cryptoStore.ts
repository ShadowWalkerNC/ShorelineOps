/**
 * ============================================================
 * CRYPTO STORE — AES-256-GCM Encrypted localStorage
 * ============================================================
 * HIPAA Security Rule §164.312(a)(2)(iv) — Encryption/Decryption
 * SOC 2 CC6.1 — Logical access / data protection
 *
 * PHI keys are encrypted at rest using AES-256-GCM.
 * Each value gets a fresh random IV (12 bytes).
 * Salt is stored alongside ciphertext (not secret — security
 * comes from the passphrase strength, not salt secrecy).
 *
 * Usage:
 *   await cs.get<Resident[]>(LS_KEYS.residents, [])
 *   await cs.set(LS_KEYS.residents, residents)
 *   await cs.remove(LS_KEYS.residents)
 * ============================================================
 */

import { keyManager } from './keyManager'
import { LS_KEYS, type LsKey } from './localStorage'

// Keys that contain PHI — must be encrypted
export const PHI_KEYS = new Set<LsKey>([
  LS_KEYS.residents,
  LS_KEYS.staffProfiles,
  LS_KEYS.callOuts,
  LS_KEYS.timePunches,
  LS_KEYS.threads,
  LS_KEYS.approvals,
  LS_KEYS.budgetEntries,
  LS_KEYS.budgetPeriods,
])

interface EncryptedEnvelope {
  /** base64-encoded IV (12 bytes) */
  iv: string
  /** base64-encoded ciphertext */
  ct: string
  /** schema version for future migrations */
  v: 1
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function encrypt(plaintext: string): Promise<EncryptedEnvelope> {
  const key = keyManager.getKey()
  if (!key) throw new Error('[CryptoStore] Encryption key not loaded. Call keyManager.initKey() first.')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { iv: toBase64(iv), ct: toBase64(ciphertext), v: 1 }
}

async function decrypt(envelope: EncryptedEnvelope): Promise<string> {
  const key = keyManager.getKey()
  if (!key) throw new Error('[CryptoStore] Encryption key not loaded.')
  const iv = fromBase64(envelope.iv)
  const ct = fromBase64(envelope.ct)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plaintext)
}

async function get<T>(key: LsKey, fallback: T): Promise<T> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    if (PHI_KEYS.has(key)) {
      if (!keyManager.isKeyReady()) {
        console.warn(`[CryptoStore] Key not ready — cannot decrypt "${key}"`)
        return fallback
      }
      const envelope = JSON.parse(raw) as EncryptedEnvelope
      const plain = await decrypt(envelope)
      return JSON.parse(plain) as T
    }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function set<T>(key: LsKey, value: T): Promise<void> {
  try {
    if (PHI_KEYS.has(key)) {
      if (!keyManager.isKeyReady()) {
        throw new Error(`[CryptoStore] Cannot encrypt "${key}" — key not loaded.`)
      }
      const envelope = await encrypt(JSON.stringify(value))
      localStorage.setItem(key, JSON.stringify(envelope))
    } else {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch (e) {
    console.error(`[CryptoStore] Could not write key "${key}"`, e)
    throw e
  }
}

function remove(key: LsKey): void {
  localStorage.removeItem(key)
}

export const cs = { get, set, remove, PHI_KEYS }
