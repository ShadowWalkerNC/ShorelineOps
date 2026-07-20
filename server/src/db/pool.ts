import { Pool } from 'pg'
import path from 'path'
import sqlite3 from 'sqlite3'
import crypto from 'crypto'

// Use PostgreSQL by default if DATABASE_URL is set, but test connection first.
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shoreline'
let pgPool: Pool | null = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

let useSqlite = false
let sqliteDb: sqlite3.Database | null = null

// Fallback SQLite Database path
const sqlitePath = path.join(__dirname, '..', '..', 'shoreline.db')

function getSqlite() {
  if (!sqliteDb) {
    console.log(`[DB] Using local offline SQLite database at ${sqlitePath}`)
    sqliteDb = new sqlite3.Database(sqlitePath)
    
    // Enable foreign keys
    sqliteDb.serialize(() => {
      sqliteDb?.run('PRAGMA foreign_keys = ON')
      
      // Seed initial mock user admin account if users table is empty
      // User: admin@shoreline.com / admin123
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
        if (!err && row && row.cnt === 0) {
          console.log('[DB] Seeding default SQLite admin account (admin@shoreline.com / admin123)')
          // bcrypt hash for 'admin123'
          const passHash = '$2a$10$tZ2M9m8i4v0wXw5Bw84l2em.e6gC6j6Uoq5h9wQdKx5r0b5J3a2mK'
          sqliteDb?.run(`
            INSERT INTO users (id, name, email, password, role)
            VALUES (?, ?, ?, ?, ?)
          `, [crypto.randomUUID(), 'Administrator', 'admin@shoreline.com', passHash, 'admin'])
        }
      })
    })
  }
  return sqliteDb
}

// Translate PostgreSQL query logic to SQLite
function translateQuery(sql: string, params: any[] = []): { sql: string; params: any[] } {
  let translatedSql = sql
    // Replace $1, $2, ... with ?
    .replace(/\$(\d+)/g, '?')
    // Remove PG extension commands
    .replace(/CREATE EXTENSION IF NOT EXISTS.*/gi, '')
    // Replace GIN index lines entirely to prevent syntax issues
    .replace(/CREATE INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s+USING\s+GIN.*/gi, '-- GIN index ignored')
    // Replace serial / uuid defaults
    .replace(/UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/gi, 'TEXT PRIMARY KEY')
    .replace(/UUID PRIMARY KEY/gi, 'TEXT PRIMARY KEY')
    .replace(/DEFAULT uuid_generate_v4\(\)/gi, '')
    // Replace data types
    .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
    .replace(/\bJSONB\b/gi, 'TEXT')
    .replace(/\bTEXT\[\]\b/gi, 'TEXT')
    .replace(/\bUUID\b/gi, 'TEXT')
    // Replace ILIKE with LIKE
    .replace(/\bILIKE\b/gi, 'LIKE')
    // Replace NOW()
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    // Replace check role constraints that might mismatch
    .replace(/CHECK \(role IN .*\)/gi, '')
    // Replace PG alter table ADD COLUMN IF NOT EXISTS for SQLite
    .replace(/ADD COLUMN\s+IF\s+NOT\s+EXISTS/gi, 'ADD COLUMN')
    // Replace PG insert default values with SQLite compatible insert or ignore
    .replace(/INSERT INTO system_settings DEFAULT VALUES/gi, 'INSERT OR IGNORE INTO system_settings DEFAULT VALUES')
    // Remove conflict blocks for SQLite since we use OR IGNORE
    .replace(/ON CONFLICT\s*\(?\w*\)?\s*DO\s*NOTHING/gi, '')

  // Translate parameter types (e.g. convert arrays to strings/JSON)
  const translatedParams = params.map(p => {
    if (Array.isArray(p)) {
      return JSON.stringify(p)
    }
    if (typeof p === 'boolean') {
      return p ? 1 : 0
    }
    return p
  })

  return { sql: translatedSql, params: translatedParams }
}

// Transparent wrapper that implements the pg Pool interface
export const pool = {
  async query(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    if (!useSqlite && pgPool) {
      try {
        return await pgPool.query(sql, params)
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
          console.warn('[DB] PostgreSQL connection refused. Switching whole app to SQLite mode.')
          useSqlite = true
          pgPool = null
        } else {
          throw err
        }
      }
    }

    // Run query in SQLite
    const db = getSqlite()
    const { sql: sQuery, params: sParams } = translateQuery(sql, params)

    return new Promise((resolve, reject) => {
      // Check if query is empty or comments-only after removing comments
      const sqlCleaned = sQuery.replace(/--.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (sqlCleaned.length === 0) {
        return resolve({ rows: [] })
      }

      // If it is a modification statement (INSERT, UPDATE, DELETE, CREATE)
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
          db.run(sQuery, sParams, function(err) {
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
            // Map rows back to resemble standard PG result structure
            const mappedRows = (rows || []).map((row: any) => {
              const mapped = { ...row }
              // Parse JSON columns back into arrays if needed (matching postgres TEXT[] mapping)
              for (const [key, val] of Object.entries(mapped)) {
                if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                  try {
                    mapped[key] = JSON.parse(val)
                  } catch {}
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

  // Mock connection client for transaction blocks
  async connect(): Promise<any> {
    if (!useSqlite && pgPool) {
      try {
        return await pgPool.connect()
      } catch (err: any) {
        if (err.code === 'ECONNREFUSED' || err.message.includes('connect')) {
          useSqlite = true
          pgPool = null
        } else {
          throw err
        }
      }
    }

    return {
      query: (sql: string, params: any[] = []) => this.query(sql, params),
      release: () => {}
    }
  },

  on(event: string, callback: (...args: any[]) => void) {
    if (pgPool) pgPool.on(event, callback)
  }
}
