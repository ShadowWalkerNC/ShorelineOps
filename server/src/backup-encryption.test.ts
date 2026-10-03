import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  encryptBackupBuffer,
  decryptBackupBuffer,
  encryptBackupFile,
  decryptBackupFile,
  SHORELINE_BACKUP_MAGIC,
} from './backup-crypto'

const repoRoot = path.resolve(__dirname, '..', '..')

test('backup encryption & decryption roundtrip preserves exact byte fidelity', () => {
  const payload = Buffer.from('CREATE TABLE residents (id UUID, name TEXT, allergies TEXT[]); -- CLINICAL DATA')
  const validKey = 'production-grade-backup-key-at-least-16-chars'

  const encrypted = encryptBackupBuffer(payload, validKey)
  assert.ok(encrypted.length > payload.length, 'encrypted payload includes headers, iv, tag')
  assert.equal(encrypted.subarray(0, 9).toString('utf8'), SHORELINE_BACKUP_MAGIC)

  const decrypted = decryptBackupBuffer(encrypted, validKey)
  assert.deepEqual(decrypted, payload, 'decrypted buffer matches original plaintext exactly')
})

test('backup encryption fails closed with insufficient key length', () => {
  const payload = Buffer.from('plaintext')
  assert.throws(
    () => encryptBackupBuffer(payload, 'short'),
    /BACKUP_ENCRYPTION_KEY is required and must be at least 16 characters/
  )
  assert.throws(
    () => encryptBackupBuffer(payload, ''),
    /BACKUP_ENCRYPTION_KEY is required and must be at least 16 characters/
  )
})

test('backup decryption fails closed on incorrect key or tampered payload', () => {
  const payload = Buffer.from('RESIDENT PHI CONFIDENTIAL')
  const key1 = 'correct-passphrase-at-least-16-chars'
  const key2 = 'different-passphrase-at-least-16-chars'

  const encrypted = encryptBackupBuffer(payload, key1)

  // Incorrect passphrase
  assert.throws(() => decryptBackupBuffer(encrypted, key2))

  // Truncated buffer
  assert.throws(
    () => decryptBackupBuffer(encrypted.subarray(0, 20), key1),
    /file size is smaller than header/
  )

  // Invalid magic header
  const corruptedMagic = Buffer.from(encrypted)
  corruptedMagic[0] = 0x58 // 'X'
  assert.throws(
    () => decryptBackupBuffer(corruptedMagic, key1),
    /Invalid encrypted backup header/
  )

  // Tampered ciphertext (GCM auth tag mismatch)
  const tampered = Buffer.from(encrypted)
  tampered[tampered.length - 1] ^= 0xff
  assert.throws(() => decryptBackupBuffer(tampered, key1))
})

test('backup file helper encrypts and decrypts on filesystem with isolated temp files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-crypto-test-'))
  const plainPath = path.join(dir, 'plain.sql')
  const encPath = path.join(dir, 'backup.sql.enc')
  const restorePath = path.join(dir, 'restored.sql')

  const originalContent = 'INSERT INTO residents (name) VALUES (\'Alice\');\n'
  fs.writeFileSync(plainPath, originalContent, 'utf8')

  const key = 'backup-key-for-filesystem-test-12345'
  encryptBackupFile(plainPath, encPath, key)
  assert.ok(fs.existsSync(encPath))

  decryptBackupFile(encPath, restorePath, key)
  const restoredContent = fs.readFileSync(restorePath, 'utf8')
  assert.equal(restoredContent, originalContent)

  fs.rmSync(dir, { recursive: true, force: true })
})

test('backup-tool.mjs CLI executes successfully and fails closed without key', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-cli-test-'))
  const plainPath = path.join(dir, 'plain.sql')
  const encPath = path.join(dir, 'backup.sql.enc')
  const restorePath = path.join(dir, 'restored.sql')
  const scriptPath = path.join(repoRoot, 'scripts', 'backup-tool.mjs')

  fs.writeFileSync(plainPath, 'SELECT * FROM audit_log;', 'utf8')

  // Failure when BACKUP_ENCRYPTION_KEY is unset
  const failResult = spawnSync(process.execPath, [scriptPath, 'encrypt', plainPath, encPath], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: '' },
    encoding: 'utf8',
  })
  assert.notEqual(failResult.status, 0)
  assert.ok(failResult.stderr.includes('BACKUP_ENCRYPTION_KEY environment variable is required'))

  // Success when valid key is provided
  const validKey = 'valid-cli-encryption-key-16-chars-min'
  const encResult = spawnSync(process.execPath, [scriptPath, 'encrypt', plainPath, encPath], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: validKey },
    encoding: 'utf8',
  })
  assert.equal(encResult.status, 0, `CLI Encrypt failed: ${encResult.stderr}`)

  const decResult = spawnSync(process.execPath, [scriptPath, 'decrypt', encPath, restorePath], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: validKey },
    encoding: 'utf8',
  })
  assert.equal(decResult.status, 0, `CLI Decrypt failed: ${decResult.stderr}`)

  assert.equal(fs.readFileSync(restorePath, 'utf8'), 'SELECT * FROM audit_log;')

  fs.rmSync(dir, { recursive: true, force: true })
})
