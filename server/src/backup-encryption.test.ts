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

test('artifact publication is exclusive and rejects empty, wrong-key and tampered files without output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-artifact-failure-'))
  try {
    const input = path.join(dir, 'input'), artifact = path.join(dir, 'artifact'), output = path.join(dir, 'output')
    const key = 'synthetic-artifact-secret-key-at-least-32-chars'
    fs.writeFileSync(input, '')
    assert.throws(() => encryptBackupFile(input, artifact, key), /empty/)
    assert.equal(fs.existsSync(artifact), false)
    fs.writeFileSync(input, Buffer.from([0, 255, 42, 13, 10]))
    encryptBackupFile(input, artifact, key)
    const original = fs.readFileSync(artifact)
    assert.throws(() => encryptBackupFile(input, artifact, key), /EEXIST/)
    assert.deepEqual(fs.readFileSync(artifact), original)
    assert.throws(() => decryptBackupFile(artifact, output, 'incorrect-key-with-at-least-32-characters'))
    assert.equal(fs.existsSync(output), false)
    const corrupt = Buffer.from(original); corrupt[corrupt.length - 1] ^= 1
    fs.writeFileSync(artifact, corrupt)
    assert.throws(() => decryptBackupFile(artifact, output, key))
    assert.equal(fs.existsSync(output), false)
    fs.writeFileSync(artifact, original)
    fs.writeFileSync(output, 'existing output')
    assert.throws(() => decryptBackupFile(artifact, output, key), /EEXIST/)
    assert.equal(fs.readFileSync(output, 'utf8'), 'existing output')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

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
  const keyPath = path.join(dir, 'backup.key')
  fs.writeFileSync(keyPath, 'valid-cli-encryption-key-16-chars-min', { mode: 0o600 })

  fs.writeFileSync(plainPath, 'SELECT * FROM audit_log;', 'utf8')

  // Failure when BACKUP_ENCRYPTION_KEY is unset
  const failResult = spawnSync(process.execPath, [scriptPath, 'encrypt', '--key-file', keyPath + '.missing', plainPath, encPath], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: '' },
    encoding: 'utf8',
  })
  assert.notEqual(failResult.status, 0)
  assert.ok(failResult.stderr.includes('ENOENT'))
  assert.equal(fs.existsSync(encPath), false)

  fs.writeFileSync(keyPath, 'too-short')
  const shortResult = spawnSync(process.execPath, [scriptPath, 'check', '--key-file', keyPath], { encoding: 'utf8' })
  assert.notEqual(shortResult.status, 0)
  assert.ok(!shortResult.stderr.includes('too-short'), 'secret content never logged')
  fs.writeFileSync(keyPath, 'valid-cli-encryption-key-16-chars-min')

  // Success when valid key is provided
  const validKey = 'valid-cli-encryption-key-16-chars-min'
  const encResult = spawnSync(process.execPath, [scriptPath, 'encrypt', '--key-file', keyPath, plainPath, encPath], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: validKey },
    encoding: 'utf8',
  })
  assert.equal(encResult.status, 0, `CLI Encrypt failed: ${encResult.stderr}`)

  const decResult = spawnSync(process.execPath, [scriptPath, 'decrypt', '--key-file', keyPath, encPath, restorePath], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: validKey },
    encoding: 'utf8',
  })
  assert.equal(decResult.status, 0, `CLI Decrypt failed: ${decResult.stderr}`)

  assert.equal(fs.readFileSync(restorePath, 'utf8'), 'SELECT * FROM audit_log;')

  // Recovery must retain compatibility with historical SHOR_ENC1 keys,
  // while preventing the same short key from creating new backups.
  const legacyKey = 'legacy-key-123456'
  const legacyEncrypted = path.join(dir, 'legacy.enc')
  const legacyRestored = path.join(dir, 'legacy.sql')
  fs.writeFileSync(keyPath, legacyKey)
  fs.writeFileSync(legacyEncrypted, encryptBackupBuffer(Buffer.from('SELECT 1;'), legacyKey))
  const legacyResult = spawnSync(process.execPath, [scriptPath, 'decrypt', '--key-file', keyPath, legacyEncrypted, legacyRestored], { encoding: 'utf8' })
  assert.equal(legacyResult.status, 0)
  assert.equal(fs.readFileSync(legacyRestored, 'utf8'), 'SELECT 1;')
  const rejectedNew = path.join(dir, 'short-key-new.enc')
  const rejectedResult = spawnSync(process.execPath, [scriptPath, 'encrypt', '--key-file', keyPath, plainPath, rejectedNew], { encoding: 'utf8' })
  assert.notEqual(rejectedResult.status, 0)
  assert.equal(fs.existsSync(rejectedNew), false)

  fs.rmSync(dir, { recursive: true, force: true })
})
