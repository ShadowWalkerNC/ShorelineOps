#!/usr/bin/env node
// Shares the server's existing SHOR_ENC1 format. No secret CLI arguments.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
try {
  const [mode, flag, keyPath, input, output, ...extra] = process.argv.slice(2)
  if (!['check', 'encrypt', 'decrypt'].includes(mode) || flag !== '--key-file' || !keyPath || extra.length || (mode !== 'check' && (!input || !output)) || (mode === 'check' && input)) throw new Error('Usage: backup-tool.mjs check|encrypt|decrypt --key-file <file> [input output]')
  const stat = fs.lstatSync(keyPath)
  if (!stat.isFile() || stat.size > 4096 || (process.platform !== 'win32' && (stat.mode & 0o077))) throw new Error('Key must be a restricted regular file (Unix mode 600), at most 4096 bytes.')
  const key = fs.readFileSync(keyPath, 'utf8').trim()
  // Existing SHOR_ENC1 artifacts accepted 16-character passphrases. Preserve
  // recovery of those artifacts; new backups and preflight require 32.
  const minimum = mode === 'decrypt' ? 16 : 32
  if (key.length < minimum) throw new Error(`Key file requires at least ${minimum} characters; use a randomly generated key for new backups.`)
  const { encryptBackupFile, decryptBackupFile } = require('../server/dist/backup-crypto.js')
  if (mode === 'encrypt') encryptBackupFile(input, output, key)
  if (mode === 'decrypt') decryptBackupFile(input, output, key)
  console.log('Backup artifact operation completed.')
} catch (error) {
  console.error('Backup artifact operation failed: ' + (error.code === 'MODULE_NOT_FOUND' ? 'Build server first.' : error.code || error.message))
  process.exitCode = 1
}
