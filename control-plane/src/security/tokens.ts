import crypto from 'crypto'

export function newToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function sha256hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex')
}
