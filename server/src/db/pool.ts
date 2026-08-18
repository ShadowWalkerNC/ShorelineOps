import { Pool } from 'pg'
import path from 'path'
import sqlite3 from 'sqlite3'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const isProd = process.env.NODE_ENV === 'production'
const dbUrl = process.env.DATABASE_URL

if (isProd && !dbUrl) {
  throw new Error('[DB] DATABASE_URL is required in production')
}

let pgPool: Pool | null = dbUrl
  ? new Pool({
      connectionString: dbUrl,
      // Verify TLS certificates in production unless explicitly overridden for managed DBs
      // that provide self-signed certs via DATABASE_SSL_REJECT_UNAUTHORIZED=false
      ssl: isProd
        ? {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
          }
        : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 2_000,
    })
  : null

let useSqlite = !dbUrl
let sqliteDb: sqlite3.Database | null = null

const sqlitePath = path.join(__dirname, '..', '..', 'shoreline.db')

function getSqlite() {
  if (isProd) {
    throw new Error('[DB] SQLite fallback is not allowed in production. Configure DATABASE_URL.')
  }
  if (!sqliteDb) {
    console.log(`[DB] Using local offline SQLite database at ${sqlitePath}`)
    sqliteDb = new sqlite3.Database(sqlitePath)

    sqliteDb.serialize(() => {
      sqliteDb?.run('PRAGMA foreign_keys = ON')

      sqliteDb?.run(`
        CREATE TABLE IF NOT EXISTS users (
          id          TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          email       TEXT UNIQUE NOT NULL,
          password    TEXT NOT NULL,
          role        TEXT NOT NULL,
          mfa_enabled INTEGER DEFAULT 0,
          active      INTEGER DEFAULT 1,
          created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `)

      sqliteDb?.get('SELECT COUNT(*) as cnt FROM users', (err, row: any) => {
        if (err || !row || row.cnt !== 0) return

        const email = process.env.SEED_ADMIN_EMAIL
        const password = process.env.SEED_ADMIN_PASSWORD
        if (!email || !password || password.length < 12) {
          console.warn(
            '[DB] SQLite users table empty. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (min 12 chars) to create a local admin.'
          )
          return
        }

        const passHash = bcrypt.hashSync(password, 12)
        sqliteDb?.run(
          `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), 'Administrator', email.toLowerCase(), passHash, 'admin'],
          (insertErr) => {
            if (insertErr) {
              console.error('[DB] Failed to seed SQLite admin:', insertErr.message)
            } else {
              console.log(`[DB] Seeded local SQLite admin: ${email}`)
            }
          }
        )
      })
    })
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
    .replace(/COMMENT ON COLUMN[\s\S]*?;/gi, '')
    .replace(/GENERATED ALWAYS AS[\s\S]*?STORED/gi, '')

  const translatedParams = params.map((p) => {
    if (Array.isArray(p)) return JSON.stringify(p)
    if (typeof p === 'boolean') return p ? 1 : 0
    return p
  })

  return { sql: translatedSql, params: translatedParams }
}

export const pool = {
  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (!useSqlite && pgPool) {
      try {
        return await pgPool.query(sql, params)
      } catch (err: any) {
        if (!isProd && (err.code === 'ECONNREFUSED' || err.message?.includes('connect'))) {
          console.warn('[DB] PostgreSQL connection refused. Switching to SQLite for local development only.')
          useSqlite = true
          pgPool = null
        } else {
          throw err
        }
      }
    }

    const db = getSqlite()
    const { sql: sQuery, params: sParams } = translateQuery(sql, params)

    return new Promise((resolve, reject) => {
      const sqlCleaned = sQuery.replace(/--.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (sqlCleaned.length === 0) {
        return resolve({ rows: [] })
      }

      const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)\b/i.test(sQuery)

      if (isWrite) {
        const hasParams = sParams && sParams.length > 0
        if (!hasParams && sQuery.includes(';')) {
          db.exec(sQuery, (err) => {
            if (err) {
              if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
                return resolve({ rows: [] })
              }
              console.error('[SQLite Exec Error]', err.message, '\nQuery:', sQuery)
              reject(err)
            } else {
              resolve({ rows: [] })
            }
          })
        } else {
          db.run(sQuery, sParams, function (err) {
            if (err) {
              if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
                return resolve({ rows: [] })
              }
              console.error('[SQLite Run Error]', err.message, '\nQuery:', sQuery)
              reject(err)
            } else {
              resolve({ rows: [] })
            }
          })
        }
      } else {
        db.all(sQuery, sParams, (err, rows) => {
          if (err) {
            console.error('[SQLite Read Error]', err.message, '\nQuery:', sQuery)
            reject(err)
          } else {
            const mappedRows = (rows || []).map((row: any) => {
              const mapped = { ...row }
              for (const key of Object.keys(mapped)) {
                if (key.toLowerCase().startsWith('count(')) {
                  mapped.count = mapped[key]
                }
              }
              for (const [key, val] of Object.entries(mapped)) {
                if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                  try {
                    mapped[key] = JSON.parse(val)
                  } catch { /* keep string */ }
                }
              }
              return mapped
            })
            resolve({ rows: mappedRows })
          }
        })
      }
    })
  },

  async connect(): Promise<any> {
    if (!useSqlite && pgPool) {
      try {
        return await pgPool.connect()
      } catch (err: any) {
        if (!isProd && (err.code === 'ECONNREFUSED' || err.message?.includes('connect'))) {
          useSqlite = true
          pgPool = null
        } else {
          throw err
        }
      }
    }

    return {
      query: (sql: string, params: any[] = []) => this.query(sql, params),
      release: () => {},
    }
  },

  on(event: 'connect' | 'error' | 'release' | 'acquire' | 'remove', callback: (...args: any[]) => void) {
    if (pgPool) pgPool.on(event, callback)
  },

  async end() {
    if (pgPool) await pgPool.end()
  },
}
