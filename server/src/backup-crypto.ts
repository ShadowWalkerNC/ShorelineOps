import fs from 'node:fs'
import crypto from 'node:crypto'

export const SHORELINE_BACKUP_MAGIC = 'SHOR_ENC1'

export interface EncryptedBackupHeader {
  magic: string
  salt: Buffer
  iv: Buffer
  tag: Buffer
}

/**
 * Encrypt a backup buffer using AES-256-GCM with key derived via PBKDF2 (100,000 iterations SHA-256).
 * Output format: [9 bytes magic 'SHOR_ENC1'] [16 bytes salt] [12 bytes IV] [16 bytes auth tag] [ciphertext]
 */
export function encryptBackupBuffer(plaintext: Buffer, passphrase: string): Buffer {
  if (!passphrase || passphrase.trim().length < 16) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required and must be at least 16 characters.')
  }
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = crypto.pbkdf2Sync(passphrase.trim(), salt, 100_000, 32, 'sha256')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  const magic = Buffer.from(SHORELINE_BACKUP_MAGIC, 'utf8')
  return Buffer.concat([magic, salt, iv, tag, ciphertext])
}

/**
 * Decrypt a backup buffer previously encrypted with encryptBackupBuffer.
 * Fails closed if the header magic is invalid, file is truncated, passphrase is wrong, or auth tag fails.
 */
export function decryptBackupBuffer(encryptedBuffer: Buffer, passphrase: string): Buffer {
  if (!passphrase || passphrase.trim().length < 16) {
    throw new Error('BACKUP_ENCRYPTION_KEY is required and must be at least 16 characters.')
  }
  const minLength = 9 + 16 + 12 + 16
  if (encryptedBuffer.length < minLength) {
    throw new Error('Invalid encrypted backup payload: file size is smaller than header.')
  }
  const magic = encryptedBuffer.subarray(0, 9).toString('utf8')
  if (magic !== SHORELINE_BACKUP_MAGIC) {
    throw new Error(`Invalid encrypted backup header: expected '${SHORELINE_BACKUP_MAGIC}', got '${magic}'.`)
  }
  let offset = 9
  const salt = encryptedBuffer.subarray(offset, offset + 16)
  offset += 16
  const iv = encryptedBuffer.subarray(offset, offset + 12)
  offset += 12
  const tag = encryptedBuffer.subarray(offset, offset + 16)
  offset += 16
  const ciphertext = encryptedBuffer.subarray(offset)

  const key = crypto.pbkdf2Sync(passphrase.trim(), salt, 100_000, 32, 'sha256')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function encryptBackupFile(inputPath: string, outputPath: string, passphrase: string): void {
  const plaintext = fs.readFileSync(inputPath)
  const encrypted = encryptBackupBuffer(plaintext, passphrase)
  fs.writeFileSync(outputPath, encrypted)
}

export function decryptBackupFile(inputPath: string, outputPath: string, passphrase: string): void {
  const encrypted = fs.readFileSync(inputPath)
  const decrypted = decryptBackupBuffer(encrypted, passphrase)
  fs.writeFileSync(outputPath, decrypted)
}
