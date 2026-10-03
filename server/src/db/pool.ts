import { Pool } from 'pg'
import fs from 'node:fs'
import net from 'node:net'
import path from 'path'

const isProd = process.env.NODE_ENV === 'production'
const dbUrl = process.env.DATABASE_URL

const isPostgresUrl = Boolean(dbUrl && /^(postgres|postgresql):\/\//i.test(dbUrl))

export const databaseDialect: 'postgres' | 'sqlite' = isPostgresUrl ? 'postgres' : 'sqlite'

if (isProd && !isPostgresUrl) {
  console.warn('[DB] Operating with local offline SQLite database (PostgreSQL DATABASE_URL not set).')
}

export type PostgresTlsMode = 'verified' | 'unverified' | 'disabled'

export interface ResolvedPostgresTls {
  /**
   * Connection string with every pg TLS parameter stripped, so the installed
   * pg ConnectionParameters cannot overwrite the resolved `ssl` object from
   * the query string (pg does `Object.assign({}, config, parse(url))`, which
   * lets `?sslmode=...` / `?ssl=...` silently replace an explicit `ssl`
   * option). The resolved object below is the single TLS authority.
   */
  connectionString: string
  ssl: false | { rejectUnauthorized: boolean; ca?: string; cert?: string; key?: string }
  mode: PostgresTlsMode
  /** Validated `sslnegotiation` to pass through to the driver (stripped from the URL). */
  sslnegotiation?: 'postgres' | 'direct'
}

/** Every query parameter the installed pg (pg-connection-string) interprets as TLS input. */
const TLS_URL_PARAMS = ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat', 'sslnegotiation'] as const

const VALID_SSLMODES = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full', 'no-verify'] as const
const VALID_SSL_VALUES = ['true', '1', '0', 'false', 'no-verify'] as const

function isLocalIPv4(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!v4) return false
  const octets = v4.slice(1, 5).map(Number)
  if (octets.some((n) => n > 255)) return false
  const [a, b] = octets
  if (a === 127 || a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 169 && b === 254) return true
  return false
}

function isLocalIPv6(host: string): boolean {
  // Caller guarantees lowercase, zone-stripped, net.isIP(host) === 6.
  if (host === '::1') return true
  const groups = host.split(':')
  if (groups.length === 8 && groups[7] === '1' && groups.slice(0, 7).every((g) => g === '0' || g === '')) {
    return true // expanded loopback 0:0:0:0:0:0:0:1
  }
  const first = groups[0]
  if (!first) return false // some other ::-compressed global address
  const value = parseInt(first, 16)
  if (Number.isNaN(value)) return false
  if ((value & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((value & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  return false
}

function isIPv4MappedIPv6(host: string): boolean {
  // Caller guarantees lowercased, zone-stripped, net.isIP(host) === 6 with '.'.
  // True only for ::ffff:a.b.c.d (compressed) and 0:0:0:0:0:ffff:a.b.c.d
  // (expanded, zero groups allow leading zeros). Any other dotted IPv6
  // (e.g. 2001:db8::10.0.0.1) is regular IPv6, classified by its own prefix.
  if (/^::ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^(0{1,4}:){5}ffff:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

/**
 * Hosts where explicit plaintext (`?sslmode=disable` / `?ssl=0`) is accepted:
 * loopback, RFC 1918 / link-local addresses (v4 + v6), unix socket paths,
 * `.local` / `.internal` names, and single-label names (Docker Compose
 * services, LAN short names). Anything else with plaintext requested fails
 * closed instead of sending credentials and PHI in plaintext to a remote host.
 *
 * IPv6 scope is validated with net.isIP plus bitmask checks — never with
 * string prefixes, which misclassify public hostnames such as "fc01.example"
 * or "fdserver" as local.
 */
export function isLocalPostgresHost(hostname: string): boolean {
  let host = hostname.trim().toLowerCase()
  if (!host) return false
  host = host.replace(/^\[|\]$/g, '')
  const zone = host.indexOf('%')
  if (zone !== -1) host = host.slice(0, zone) // strip interface zone (fe80::1%eth0)
  if (!host) return false
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.startsWith('/')) return true // unix domain socket paths are local by definition
  if (!host.includes('.') && !host.includes(':')) return true // single-label service names
  if (host.endsWith('.local') || host.endsWith('.internal')) return true
  const version = net.isIP(host)
  if (version === 4) return isLocalIPv4(host)
  if (version === 6) {
    // Only true IPv4-mapped IPv6 classifies by the embedded IPv4; every
    // other dotted IPv6 (e.g. 2001:db8::10.0.0.1) classifies by its own prefix.
    if (host.includes('.')) {
      const embedded = host.slice(host.lastIndexOf(':') + 1)
      if (net.isIP(embedded) === 4 && isIPv4MappedIPv6(host)) return isLocalIPv4(embedded)
    }
    return isLocalIPv6(host)
  }
  return false
}

function readTlsFile(param: string, filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (err: any) {
    throw new Error(
      `[DB] Could not read ${param} file at "${filePath}": ${err?.message || err}. ` +
        'Provide a readable PEM file path, or remove the parameter (remote TLS verifies against the system CA store by default).'
    )
  }
}

/**
 * PostgreSQL TLS policy (fails closed for remote hosts).
 *
 * - Default is verified TLS (`rejectUnauthorized: true`).
 * - `?sslmode=disable` / `?ssl=0` / `?ssl=false` select plaintext, accepted
 *   only for local/private hosts (see isLocalPostgresHost); remote hosts
 *   throw instead of connecting insecurely. The classified host is the
 *   *effective* host: a single `?host=` overrides the URL hostname (pg
 *   falls back to the URL hostname for a single empty `?host=`), so that
 *   effective value is what gets classified; duplicate `?host=` values are
 *   rejected outright because pg silently applies the last while blank
 *   values fall back, which would desync classification from the driver.
 * - `?sslmode=require|prefer|allow` requests TLS; verification still defaults
 *   to on unless explicitly disabled (a bare `require` must not silently
 *   skip verification for a remote database).
 * - `?sslmode=verify-ca|verify-full` always verifies.
 * - `?sslmode=no-verify` / `?ssl=no-verify` select explicit unverified TLS.
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is the explicit unverified-TLS
 *   escape hatch for providers with untrusted chains (e.g. auto-injected
 *   managed URLs that cannot carry query parameters); it never overrides an
 *   explicit `verify-*` sslmode or re-enables TLS when plaintext is set.
 * - `?sslcert=` / `?sslkey=` / `?sslrootcert=` are resolved by reading the
 *   referenced PEM files into the `ssl` object (client cert / custom CA).
 * - `?sslnegotiation=postgres|direct` is validated and passed through to the
 *   driver; `direct` with plaintext is rejected (the driver requires TLS).
 * - Anything ambiguous or unsupported fails fast with an actionable error:
 *   duplicate `host`/`sslmode`/`ssl`/`sslnegotiation` parameters, `ssl` and
 *   `sslmode` combined, unknown `sslmode`/`ssl` values, `uselibpqcompat`
 *   (ShorelineOps TLS resolution is the single authority; libpq-compat
 *   remapping of `require` to weaker semantics is not applied), plaintext
 *   combined with certificate parameters, and unparseable URLs.
 *
 * The returned connection string has every TLS parameter stripped so the
 * installed pg ConnectionParameters cannot overwrite the resolved `ssl`
 * object from the query string; the resolved object is the single authority.
 */
export function resolvePostgresTls(connectionString: string): ResolvedPostgresTls {
  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error(
      '[DB] DATABASE_URL could not be parsed as a URL, so its TLS parameters cannot be resolved safely. ' +
        'Provide a valid postgresql:// connection string (see .env.example).'
    )
  }
  const params = parsed.searchParams

  // Effective host: a single ?host= overrides the URL hostname, so
  // classify that override — not the URL hostname — to avoid a
  // local/plaintext bypass via ?host=remote. Duplicates are rejected
  // outright: pg silently applies the last value, but a blank last value
  // (?host=localhost&host=) falls back to the URL hostname, so filtering
  // blanks would classify local while pg targets remote.
  const rawHostOverrides = params.getAll('host')
  if (rawHostOverrides.length > 1) {
    throw new Error(
      '[DB] Duplicate host parameters in DATABASE_URL (pg applies the last, silently; a blank value falls back to the URL hostname). ' +
        'Specify exactly one host, e.g. ?host=db.'
    )
  }
  const rawHost = rawHostOverrides.length === 1 ? rawHostOverrides[0] : null
  if (rawHost !== null && rawHost !== '' && rawHost !== rawHost.trim()) {
    throw new Error(
      '[DB] Invalid host parameter in DATABASE_URL: leading/trailing whitespace is ambiguous (pg preserves it while classification trims). ' +
        'Specify an exact host with no surrounding whitespace.'
    )
  }
  // A single empty ?host= matches pg semantics: empty is falsy, so pg falls
  // back to the URL hostname instead of connecting to an empty host.
  const hostOverrides = rawHost !== null && rawHost !== '' ? [rawHost] : []
  const effectiveHost = hostOverrides.length > 0 ? hostOverrides[0] : parsed.hostname || 'localhost'

  const sslmodes = params.getAll('sslmode')
  if (sslmodes.length > 1) {
    throw new Error(
      '[DB] Duplicate sslmode parameters in DATABASE_URL (pg applies the last, silently). ' +
        'Specify exactly one sslmode, e.g. ?sslmode=require.'
    )
  }
  const sslParams = params.getAll('ssl')
  if (sslParams.length > 1) {
    throw new Error('[DB] Duplicate ssl parameters in DATABASE_URL (pg applies the last, silently). Specify exactly one, e.g. ?ssl=true.')
  }
  const sslmode = (sslmodes[0] || '').toLowerCase()
  const sslParam = (sslParams[0] || '').toLowerCase()
  if (sslmodes.length === 1 && sslParams.length === 1) {
    throw new Error('[DB] DATABASE_URL sets both sslmode and ssl; specify exactly one TLS mechanism to avoid conflicting resolution.')
  }
  if (sslmode && !(VALID_SSLMODES as readonly string[]).includes(sslmode)) {
    throw new Error(`[DB] Unknown sslmode "${sslmodes[0]}" in DATABASE_URL. Valid values: ${VALID_SSLMODES.join(', ')}.`)
  }
  if (sslParam && !(VALID_SSL_VALUES as readonly string[]).includes(sslParam)) {
    throw new Error(`[DB] Unknown ssl value "${sslParams[0]}" in DATABASE_URL. Valid values: ${VALID_SSL_VALUES.join(', ')}.`)
  }
  if (params.has('uselibpqcompat')) {
    throw new Error(
      '[DB] uselibpqcompat in DATABASE_URL is not supported: ShorelineOps resolves TLS itself (bare require stays verified) ' +
        'instead of applying libpq-compat remapping. Remove uselibpqcompat; use sslmode=verify-full for strict verification or ' +
        'DATABASE_SSL_REJECT_UNAUTHORIZED=false for explicit unverified TLS.'
    )
  }
  for (const name of ['sslcert', 'sslkey', 'sslrootcert'] as const) {
    if (params.getAll(name).length > 1) {
      throw new Error(`[DB] Duplicate ${name} parameters in DATABASE_URL (pg applies the last, silently). Specify exactly one.`)
    }
  }
  const sslcertPath = params.get('sslcert') || ''
  const sslkeyPath = params.get('sslkey') || ''
  const sslrootcertPath = params.get('sslrootcert') || ''

  const wantsPlaintext = sslmode === 'disable' || sslParam === '0' || sslParam === 'false'
  if (wantsPlaintext && (sslcertPath || sslkeyPath || sslrootcertPath)) {
    throw new Error('[DB] DATABASE_URL requests plaintext TLS-disable and also provides certificate parameters; remove one of the two.')
  }

  const negotiations = params.getAll('sslnegotiation')
  if (negotiations.length > 1) {
    throw new Error('[DB] Duplicate sslnegotiation parameters in DATABASE_URL (pg applies the last, silently). Specify exactly one.')
  }
  const negotiation = (negotiations[0] || '').toLowerCase()
  if (negotiation && negotiation !== 'postgres' && negotiation !== 'direct') {
    throw new Error('[DB] Invalid sslnegotiation value in DATABASE_URL: expected "postgres" or "direct" (pg rejects anything else at connect).')
  }
  if (wantsPlaintext && negotiation === 'direct') {
    throw new Error('[DB] sslnegotiation=direct requires TLS; it cannot be combined with plaintext (sslmode=disable / ssl=0).')
  }

  const extra: { ca?: string; cert?: string; key?: string } = {}
  if (sslrootcertPath) extra.ca = readTlsFile('sslrootcert', sslrootcertPath)
  if (sslcertPath) extra.cert = readTlsFile('sslcert', sslcertPath)
  if (sslkeyPath) extra.key = readTlsFile('sslkey', sslkeyPath)

  for (const name of TLS_URL_PARAMS) params.delete(name)
  const sanitized = parsed.toString()

  const passthrough = negotiation ? { sslnegotiation: negotiation as 'postgres' | 'direct' } : {}

  if (wantsPlaintext) {
    if (!isLocalPostgresHost(effectiveHost)) {
      const via = hostOverrides.length > 0 ? ' (effective host from ?host= override)' : ''
      throw new Error(
        `[DB] Refusing plaintext PostgreSQL connection to non-local host "${effectiveHost}"${via}. ` +
        'Plaintext (sslmode=disable / ssl=0) is only supported on loopback, private-network, or Compose-service hosts; ' +
        'remote databases must use verified TLS.'
      )
    }
    console.warn('[DB] PostgreSQL TLS disabled via explicit plaintext mode for a local/private host.')
    return { connectionString: sanitized, ssl: false, mode: 'disabled', ...passthrough }
  }

  const explicitVerify = sslmode === 'verify-ca' || sslmode === 'verify-full'
  if (explicitVerify) {
    return { connectionString: sanitized, ssl: { rejectUnauthorized: true, ...extra }, mode: 'verified', ...passthrough }
  }
  const explicitNoVerify = sslmode === 'no-verify' || sslParam === 'no-verify'
  if (explicitNoVerify) {
    console.warn('[DB] PostgreSQL certificate verification explicitly disabled via no-verify TLS mode.')
    return { connectionString: sanitized, ssl: { rejectUnauthorized: false, ...extra }, mode: 'unverified', ...passthrough }
  }
  if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false') {
    return { connectionString: sanitized, ssl: { rejectUnauthorized: true, ...extra }, mode: 'verified', ...passthrough }
  }
  console.warn('[DB] PostgreSQL certificate verification explicitly disabled via DATABASE_SSL_REJECT_UNAUTHORIZED=false.')
  return { connectionString: sanitized, ssl: { rejectUnauthorized: false, ...extra }, mode: 'unverified', ...passthrough }
}

let pgPool: Pool | null = null
if (isPostgresUrl) {
  const tls = resolvePostgresTls(dbUrl as string)
  pgPool = new Pool({
    connectionString: tls.connectionString,
    ssl: tls.ssl,
    // Conditional spread: @types/pg predates the driver's sslnegotiation
    // option, and spreads are exempt from excess-property checks.
    ...(tls.sslnegotiation ? { sslnegotiation: tls.sslnegotiation } : {}),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
}

let useSqlite = !isPostgresUrl
let sqliteDb: any = null
let sqliteLoadFailed = false

const rawCustomPath = process.env.SQLITE_PATH || (dbUrl && !isPostgresUrl ? dbUrl.replace(/^(file|sqlite):(\/\/)?/i, '') : null)
const sqlitePath = rawCustomPath ? path.resolve(rawCustomPath) : path.join(__dirname, '..', '..', 'shoreline.db')

function getSqlite(): any {
  if (sqliteLoadFailed) {
    return null
  }
  if (!sqliteDb) {
    try {
      // Dynamically load sqlite3 so cloud platforms (Render/Docker) with glibc mismatches don't fail at startup
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqlite3 = require('sqlite3')
      console.log(`[DB] Using local offline SQLite database at ${sqlitePath}`)
      sqliteDb = new sqlite3.Database(sqlitePath)

      // Schema and admin seeding are handled exclusively by the canonical
      // migration path (server/src/db/migrate.ts runMigrations + db/seed.ts runSeed).
      // No DDL lives here by design (A03 consolidation).
      sqliteDb.configure('busyTimeout', 5000)
      sqliteDb?.run('PRAGMA foreign_keys = ON')
    } catch (loadErr: any) {
      console.warn('[DB] SQLite native library could not be loaded:', loadErr.message)
      sqliteLoadFailed = true
      sqliteDb = null
      return null
    }
  }
  return sqliteDb
}

function translateQuery(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let translatedSql = sql
    // Preserve PostgreSQL numbered bindings ($1, $2, ...) as SQLite numbered
    // bindings (?1, ?2, ...). Anonymous '?' placeholders bind positionally, so
    // repeated ($1 ... $1) or reordered ($2 ... $1) parameters would corrupt.
    .replace(/\$(\d+)/g, '?$1')
    .replace(/CREATE EXTENSION IF NOT EXISTS.*/gi, '')
    .replace(/CREATE INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s+USING\s+GIN.*/gi, '-- GIN index ignored')
    .replace(/UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/gi, 'TEXT PRIMARY KEY')
    .replace(/UUID PRIMARY KEY/gi, 'TEXT PRIMARY KEY')
    .replace(/DEFAULT uuid_generate_v4\(\)/gi, '')
    .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
    .replace(/\bJSONB\b/gi, 'TEXT')
    .replace(/\bTEXT\[\]\b/gi, 'TEXT')
    .replace(/\bUUID\b/gi, 'TEXT')
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/CHECK \(role IN .*\)/gi, '')
    .replace(/ADD COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN')
    .replace(/INSERT INTO system_settings DEFAULT VALUES/gi, 'INSERT OR IGNORE INTO system_settings DEFAULT VALUES')
    .replace(/DEFAULT VALUES\s+ON CONFLICT\s*\(?\w*\)?\s*DO\s*NOTHING/gi, 'DEFAULT VALUES')
    .replace(/ON CONFLICT\s*\(([^)]+)\)\s*DO\s*NOTHING/gi, 'ON CONFLICT($1) DO NOTHING')
    .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?\$\$ LANGUAGE plpgsql;/gi, '')
    .replace(/DROP TRIGGER IF EXISTS[\s\S]*?;/gi, '')
    .replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION[\s\S]*?;/gi, '')
    .replace(/ALTER TABLE \w+ DROP CONSTRAINT[\s\S]*?;/gi, '')
    .replace(/ALTER TABLE \w+ ADD CONSTRAINT[\s\S]*?;/gi, '')
    // A02: strip COMMENT ON COLUMN statements for SQLite. The quoted-string-aware
    // pattern is required because comment text may itself contain semicolons
    // (e.g. 009's 'Base32 TOTP secret; null when MFA not enrolled'), which a
    // naive non-greedy match would stop at, leaving broken SQL behind.
    .replace(/COMMENT ON COLUMN(?:'[^']*'|[^;])*;/gi, '')
    .replace(/SET LOCAL.*/gi, '-- SET LOCAL ignored')
    .replace(/GENERATED ALWAYS AS[\s\S]*?STORED/gi, '')

  const translatedParams = params.map((p) => {
    if (Array.isArray(p)) return JSON.stringify(p)
    if (typeof p === 'boolean') return p ? 1 : 0
    return p
  })

  return { sql: translatedSql, params: translatedParams }
}

/** Execute on the supplied connection; transaction clients must never share a handle. */
function sqliteQuery(db: any, sql: string, params: any[] = []): Promise<{ rows: any[] }> {
  const translated = translateQuery(sql, params)
  const cleaned = translated.sql.replace(/--.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
  if (!cleaned) return Promise.resolve({ rows: [] })
  return new Promise((resolve, reject) => {
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)\b/i.test(cleaned)
    const finishWrite = (err: any) => {
      if (err) {
        // Existing migration compatibility: repeated ADD COLUMN is idempotent.
        if (err.message.includes('duplicate column name')) return resolve({ rows: [] })
        return reject(err)
      }
      resolve({ rows: [] })
    }
    if (isWrite && !/\bRETURNING\b/i.test(cleaned)) {
      if (translated.params.length === 0 && translated.sql.includes(';')) {
        db.exec(translated.sql, finishWrite)
      } else {
        db.run(translated.sql, translated.params, finishWrite)
      }
    } else {
      db.all(translated.sql, translated.params, (err: any, rows: any[]) => {
        if (err) return reject(err)
        resolve({ rows: (rows || []).map(row => {
          const mapped = { ...row }
          for (const [key, value] of Object.entries(mapped)) {
            if (key.toLowerCase().startsWith('count(')) mapped.count = value
            if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
              try { mapped[key] = JSON.parse(value) } catch { /* preserve text */ }
            }
          }
          return mapped
        }) })
      })
    }
  })
}

export const pool = {
  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (!useSqlite && pgPool) return pgPool.query(sql, params)
    const db = getSqlite()
    if (!db) throw new Error('SQLite database is unavailable')
    return sqliteQuery(db, sql, params)
  },

  async connect(): Promise<any> {
    if (!useSqlite && pgPool) return pgPool.connect()
    // A dedicated connection keeps unrelated pool.query calls out of this
    // transaction and lets SQLite serialize writers across processes.
    const sqlite3 = require('sqlite3')
    const db: any = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(sqlitePath, (err: Error | null) =>
        err ? reject(err) : resolve(connection))
    })
    db.configure('busyTimeout', 5000)
    await sqliteQuery(db, 'PRAGMA foreign_keys = ON')
    let released = false
    return {
      query: (sql: string, params: any[] = []) => {
        if (released) throw new Error('Database client already released')
        // Acquire the write reservation before reading decision inputs.
        return sqliteQuery(db, /^\s*BEGIN\s*;?\s*$/i.test(sql) ? 'BEGIN IMMEDIATE' : sql, params)
      },
      release: () => { if (!released) { released = true; db.close() } },
    }
  },

  on(event: 'connect' | 'error' | 'release' | 'acquire' | 'remove', callback: (...args: any[]) => void) {
    if (pgPool) pgPool.on(event, callback)
  },

  async end() {
    if (pgPool) await pgPool.end()
    if (sqliteDb) {
      const db = sqliteDb
      sqliteDb = null
      await new Promise<void>((resolve, reject) => db.close((err: Error | null) => err ? reject(err) : resolve()))
    }
  },
}
