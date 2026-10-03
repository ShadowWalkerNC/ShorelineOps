#!/usr/bin/env node
/**
 * CLI utility to encrypt or decrypt ShorelineOps database backups using AES-256-GCM.
 * Usage:
 *   node backup-tool.mjs encrypt <input_file> <output_file>
 *   node backup-tool.mjs decrypt <input_file> <output_file>
 * Reads passphrase from BACKUP_ENCRYPTION_KEY environment variable.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const SHORELINE_BACKUP_MAGIC = 'SHOR_ENC1'

function getPassphrase() {
  const key = process.env.BACKUP_ENCRYPTION_KEY?.trim()
  if (!key || key.length < 16) {
    console.error('ERROR: BACKUP_ENCRYPTION_KEY environment variable is required (min 16 chars).')
    process.exit(1)
  }
  return key
}

function encrypt(inputPath, outputPath) {
  const passphrase = getPassphrase()
  const plaintext = fs.readFileSync(inputPath)
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  const magic = Buffer.from(SHORELINE_BACKUP_MAGIC, 'utf8')
  const payload = Buffer.concat([magic, salt, iv, tag, ciphertext])
  fs.writeFileSync(outputPath, payload)
  console.log(`Successfully encrypted ${inputPath} -> ${outputPath}`)
}

function decrypt(inputPath, outputPath) {
  const passphrase = getPassphrase()
  const fileData = fs.readFileSync(inputPath)
  const minLength = 9 + 16 + 12 + 16
  if (fileData.length < minLength) {
    console.error('ERROR: File is too small to be a valid ShorelineOps encrypted backup.')
    process.exit(1)
  }
  const magic = fileData.subarray(0, 9).toString('utf8')
  if (magic !== SHORELINE_BACKUP_MAGIC) {
    console.error(`ERROR: Header mismatch. Expected '${SHORELINE_BACKUP_MAGIC}', got '${magic}'.`)
    process.exit(1)
  }
  let offset = 9
  const salt = fileData.subarray(offset, offset + 16)
  offset += 16
  const iv = fileData.subarray(offset, offset + 12)
  offset += 12
  const tag = fileData.subarray(offset, offset + 16)
  offset += 16
  const ciphertext = fileData.subarray(offset)

  try {
    const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    fs.writeFileSync(outputPath, decrypted)
    console.log(`Successfully decrypted ${inputPath} -> ${outputPath}`)
  } catch (err) {
    console.error('ERROR: Decryption failed (invalid key or corrupted artifact):', err.message)
    process.exit(1)
  }
}

const [mode, src, dst] = process.argv.slice(2)
if (mode === 'encrypt' && src && dst) {
  encrypt(src, dst)
} else if (mode === 'decrypt' && src && dst) {
  decrypt(src, dst)
} else {
  console.error('Usage: node backup-tool.mjs [encrypt|decrypt] <input> <output>')
  process.exit(1)
}
