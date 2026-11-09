import crypto from 'crypto'
import { decodeOutboxKey } from '../config'

export interface OutboxPayload {
  to: string
  subject: string
  text: string
}

function keyRequired(): Buffer {
  const key = decodeOutboxKey()
  if (!key) throw Object.assign(new Error('OUTBOX_KEY_UNCONFIGURED'), { code: 'OUTBOX_KEY_UNCONFIGURED' })
  return key
}

// AES-256-GCM; stored as base64(iv 12B || tag 16B || ciphertext).
export function encryptOutbox(payload: OutboxPayload): string {
  const key = keyRequired()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}

export function decryptOutbox(payloadEnc: string): OutboxPayload {
  const key = keyRequired()
  const buf = Buffer.from(payloadEnc, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')) as OutboxPayload
}
