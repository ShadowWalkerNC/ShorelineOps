"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const path_1 = __importDefault(require("path"));
const isProd = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;
const isPostgresUrl = Boolean(dbUrl && /^(postgres|postgresql):\/\//i.test(dbUrl));
if (isProd && !isPostgresUrl) {
    console.warn('[DB] Operating with local offline SQLite database (PostgreSQL DATABASE_URL not set).');
}
let pgPool = isPostgresUrl
    ? new pg_1.Pool({
        connectionString: dbUrl,
        ssl: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'
            ? { rejectUnauthorized: true }
            : { rejectUnauthorized: false }, // Render/Supabase/Neon managed PostgreSQL requires rejectUnauthorized: false
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    })
    : null;
let useSqlite = !isPostgresUrl;
let sqliteDb = null;
let sqliteLoadFailed = false;
const rawCustomPath = process.env.SQLITE_PATH || (dbUrl && !isPostgresUrl ? dbUrl.replace(/^(file|sqlite):(\/\/)?/i, '') : null);
const sqlitePath = rawCustomPath ? path_1.default.resolve(rawCustomPath) : path_1.default.join(__dirname, '..', '..', 'shoreline.db');
function getSqlite() {
    if (sqliteLoadFailed) {
        return null;
    }
    if (!sqliteDb) {
        try {
            // Dynamically load sqlite3 so cloud platforms (Render/Docker) with glibc mismatches don't fail at startup
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const sqlite3 = require('sqlite3');
            console.log(`[DB] Using local offline SQLite database at ${sqlitePath}`);
            sqliteDb = new sqlite3.Database(sqlitePath);
            // Schema and admin seeding are handled exclusively by the canonical
            // migration path (server/src/db/migrate.ts runMigrations + db/seed.ts runSeed).
            // No DDL lives here by design (A03 consolidation).
            sqliteDb?.run('PRAGMA foreign_keys = ON');
        }
        catch (loadErr) {
            console.warn('[DB] SQLite native library could not be loaded:', loadErr.message);
            sqliteLoadFailed = true;
            sqliteDb = null;
            return null;
        }
    }
    return sqliteDb;
}
function translateQuery(sql, params = []) {
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
        .replace(/GENERATED ALWAYS AS[\s\S]*?STORED/gi, '');
    const translatedParams = params.map((p) => {
        if (Array.isArray(p))
            return JSON.stringify(p);
        if (typeof p === 'boolean')
            return p ? 1 : 0;
        return p;
    });
    return { sql: translatedSql, params: translatedParams };
}
exports.pool = {
    async query(sql, params = []) {
        if (!useSqlite && pgPool) {
            try {
                return await pgPool.query(sql, params);
            }
            catch (err) {
                console.error(`[DB] PostgreSQL query error: ${err.message}`);
                throw err;
            }
        }
        const db = getSqlite();
        if (!db) {
            // In-memory fallback if no database is connected in cloud demo
            return { rows: [] };
        }
        const { sql: sQuery, params: sParams } = translateQuery(sql, params);
        return new Promise((resolve, reject) => {
            const sqlCleaned = sQuery.replace(/--.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
            if (sqlCleaned.length === 0) {
                return resolve({ rows: [] });
            }
            // A02: route on the comment-stripped SQL. Migration bodies (and some
            // queries) begin with `--` comment lines; testing the raw text would
            // misclassify them as reads, and node-sqlite3's db.all() then silently
            // executes ONLY the first statement — dropping the remaining tables
            // with no error (this is how 010/011/012 lost tables on SQLite).
            // sqlCleaned is only used for the routing decision; the driver still
            // receives the original sQuery unchanged.
            const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|PRAGMA)\b/i.test(sqlCleaned);
            if (isWrite) {
                const hasParams = sParams && sParams.length > 0;
                if (!hasParams && sQuery.includes(';')) {
                    db.exec(sQuery, (err) => {
                        if (err) {
                            if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
                                return resolve({ rows: [] });
                            }
                            console.error('[SQLite Exec Error]', err.message, '\nQuery:', sQuery);
                            reject(err);
                        }
                        else {
                            resolve({ rows: [] });
                        }
                    });
                }
                else {
                    db.run(sQuery, sParams, function (err) {
                        if (err) {
                            if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
                                return resolve({ rows: [] });
                            }
                            console.error('[SQLite Run Error]', err.message, '\nQuery:', sQuery);
                            reject(err);
                        }
                        else {
                            resolve({ rows: [] });
                        }
                    });
                }
            }
            else {
                db.all(sQuery, sParams, (err, rows) => {
                    if (err) {
                        console.error('[SQLite Read Error]', err.message, '\nQuery:', sQuery);
                        reject(err);
                    }
                    else {
                        const mappedRows = (rows || []).map((row) => {
                            const mapped = { ...row };
                            for (const key of Object.keys(mapped)) {
                                if (key.toLowerCase().startsWith('count(')) {
                                    mapped.count = mapped[key];
                                }
                            }
                            for (const [key, val] of Object.entries(mapped)) {
                                if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
                                    try {
                                        mapped[key] = JSON.parse(val);
                                    }
                                    catch { /* keep string */ }
                                }
                            }
                            return mapped;
                        });
                        resolve({ rows: mappedRows });
                    }
                });
            }
        });
    },
    async connect() {
        if (!useSqlite && pgPool) {
            try {
                return await pgPool.connect();
            }
            catch (err) {
                console.error(`[DB] PostgreSQL connect error: ${err.message}`);
                throw err;
            }
        }
        return {
            query: (sql, params = []) => this.query(sql, params),
            release: () => { },
        };
    },
    on(event, callback) {
        if (pgPool)
            pgPool.on(event, callback);
    },
    async end() {
        if (pgPool)
            await pgPool.end();
    },
};
