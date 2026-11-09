// Central config. Reads variable NAMES only; no function here returns or prints
// a credential value. All secrets stay in the hosting environment, never in files.
function name(name: string): string {
  return (process.env[name] ?? '').trim()
}

export const config = {
  get port(): number {
    const p = Number(process.env.PORT ?? 3101)
    return Number.isFinite(p) && p > 0 ? p : 3101
  },
  get isProd(): boolean {
    return (process.env.NODE_ENV ?? '') === 'production'
  },
  get databaseUrl(): string {
    return name('CONTROL_DATABASE_URL')
  },
  get allowedOrigins(): string[] {
    return name('CONTROL_ALLOWED_ORIGINS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  },
  get cookieSecure(): boolean {
    if (config.isProd) return true
    if (process.env.CONTROL_COOKIE_SECURE === 'false') return false
    if (process.env.CONTROL_COOKIE_SECURE === 'true') return true
    return (process.env.NODE_ENV ?? '') === 'production'
  },
  get publicOrigin(): string {
    const raw = name('CONTROL_PUBLIC_ORIGIN') || (config.isProd ? '' : 'http://127.0.0.1:3101')
    if (!raw) throw new Error('CONTROL_PUBLIC_ORIGIN is required')
    const url = new URL(raw)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid public origin')
    if (url.protocol !== 'https:' && (config.isProd || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('HTTPS public origin required')
    return url.origin
  },
}

// 32-byte AES key for the email outbox, base64 in CONTROL_OUTBOX_ENC_KEY.
// Returns null when missing/invalid so callers can fail closed honestly.
export function decodeOutboxKey(): Buffer | null {
  const raw = name('CONTROL_OUTBOX_ENC_KEY')
  if (!raw) return null
  try {
    const key = Buffer.from(raw, 'base64')
    return key.length === 32 ? key : null
  } catch {
    return null
  }
}
