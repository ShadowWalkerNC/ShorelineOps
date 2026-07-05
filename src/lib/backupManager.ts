/**
 * ============================================================
 * BACKUP MANAGER — Encrypted Full Export / Import
 * ============================================================
 * HIPAA Security Rule §164.308(a)(7) — Contingency plan
 * HIPAA Security Rule §164.312(c)(1) — Integrity controls
 * SOC 2 A1.2 — Availability — backup and recovery
 *
 * exportBackup():
 *   Collects all localStorage keys, wraps in a manifest with
 *   SHA-256 checksum, encrypts the entire payload with AES-256-GCM
 *   using the current session key. Returns base64 string.
 *   Download as .shorelinebackup file.
 *
 * importBackup(data, passphrase):
 *   Derives key from passphrase + stored salt, decrypts,
 *   verifies checksum, restores all keys.
 *
 * verifyBackup(data, passphrase):
 *   Decrypt + checksum only — no restore. Use to validate
 *   before committing to restore.
 *
 * Backup history stored in sl_backup_history (plain LS).
 * ============================================================
 */

import { keyManager } from './keyManager'
import { auditLog } from '../security/auditLog'

const BACKUP_HISTORY_KEY = 'sl_backup_history'
const BACKUP_VERSION = '1.0'

export interface BackupManifest {
  version: string
  exportedAt: string
  facilityName: string
  keyCount: number
  checksum: string   // SHA-256 hex of the raw JSON payload
}

export interface BackupHistoryEntry {
  id: string
  exportedAt: string
  facilityName: string
  keyCount: number
  sizeBytes: number
}

interface BackupEnvelope {
  manifest: BackupManifest
  iv: string   // base64
  ct: string   // base64 ciphertext
  v: 1
}

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function collectAllData(): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      try {
        data[key] = JSON.parse(localStorage.getItem(key) ?? 'null')
      } catch {
        data[key] = localStorage.getItem(key)
      }
    }
  }
  return data
}

function getBackupHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(BACKUP_HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addBackupHistory(entry: BackupHistoryEntry): void {
  const history = getBackupHistory()
  history.push(entry)
  // Keep last 50 backup records
  localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(history.slice(-50)))
}

/**
 * Export all localStorage data as an encrypted .shorelinebackup file.
 * Returns base64-encoded envelope string.
 */
export async function exportBackup(
  facilityName: string,
  userId: string,
  userName: string
): Promise<string> {
  const key = keyManager.getKey()
  if (!key) throw new Error('[BackupManager] Encryption key not loaded.')

  const data = collectAllData()
  const payload = JSON.stringify(data)
  const checksum = await sha256Hex(payload)

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    facilityName,
    keyCount: Object.keys(data).length,
    checksum,
  }

  // Encrypt payload
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(payload)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  const envelope: BackupEnvelope = {
    manifest,
    iv: toBase64(iv),
    ct: toBase64(ciphertext),
    v: 1,
  }

  const result = btoa(JSON.stringify(envelope))

  // Record in backup history
  addBackupHistory({
    id: crypto.randomUUID(),
    exportedAt: manifest.exportedAt,
    facilityName,
    keyCount: manifest.keyCount,
    sizeBytes: result.length,
  })

  await auditLog('BACKUP_CREATED', {
    userId,
    userName,
    outcome: 'success',
    details: { facilityName, keyCount: manifest.keyCount, checksum },
  })

  return result
}

/**
 * Verify a backup file without restoring.
 * Returns the manifest if valid, throws if checksum fails or decryption fails.
 */
export async function verifyBackup(
  base64Data: string,
  passphrase: string
): Promise<BackupManifest> {
  const envelope = JSON.parse(atob(base64Data)) as BackupEnvelope
  const saltB64 = localStorage.getItem('sl_key_salt')
  if (!saltB64) throw new Error('[BackupManager] No key salt found on this device.')
  const salt = fromBase64(saltB64)
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  const verifyKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const iv = fromBase64(envelope.iv)
  const ct = fromBase64(envelope.ct)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, verifyKey, ct)
  const payload = new TextDecoder().decode(plain)
  const checksum = await sha256Hex(payload)
  if (checksum !== envelope.manifest.checksum) {
    throw new Error('[BackupManager] Checksum mismatch — backup file may be corrupted or tampered.')
  }
  return envelope.manifest
}

/**
 * Import (restore) a backup file.
 * All existing localStorage data is REPLACED.
 */
export async function importBackup(
  base64Data: string,
  passphrase: string,
  userId: string,
  userName: string
): Promise<BackupManifest> {
  const manifest = await verifyBackup(base64Data, passphrase)
  // Verified — now restore
  const envelope = JSON.parse(atob(base64Data)) as BackupEnvelope
  const saltB64 = localStorage.getItem('sl_key_salt')!
  const salt = fromBase64(saltB64)
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  const restoreKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const iv = fromBase64(envelope.iv)
  const ct = fromBase64(envelope.ct)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, restoreKey, ct)
  const data = JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>

  localStorage.clear()
  for (const [k, v] of Object.entries(data)) {
    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v))
  }

  await auditLog('BACKUP_RESTORED', {
    userId,
    userName,
    outcome: 'success',
    details: { facilityName: manifest.facilityName, exportedAt: manifest.exportedAt, keyCount: manifest.keyCount },
  })

  return manifest
}

export { getBackupHistory }
