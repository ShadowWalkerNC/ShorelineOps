import { Pool } from 'pg'
import path from 'path'

const isProd = process.env.NODE_ENV === 'production'
const dbUrl = process.env.DATABASE_URL

const isPostgresUrl = Boolean(dbUrl && /^(postgres|postgresql):\/\//i.test(dbUrl))

export const databaseDialect: 'postgres' | 'sqlite' = isPostgresUrl ? 'postgres' : 'sqlite'

if (isProd && !isPostgresUrl) {
  console.warn('[DB] Operating with local offline SQLite database (PostgreSQL DATABASE_URL not set).')
}

let pgPool: Pool | null = isPostgresUrl
  ? new Pool({
      connectionString: dbUrl,
      ssl: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }, // Render/Supabase/Neon managed PostgreSQL requires rejectUnauthorized: false
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  : null

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
    .replace(/\$(\d+)/g, '?')
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

