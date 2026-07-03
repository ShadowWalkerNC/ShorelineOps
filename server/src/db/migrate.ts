import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pool } from './pool'

export async function runMigrations() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  console.log('[migrate] Running schema...')
  await pool.query(sql)
  console.log('[migrate] Done.')
}

// Allow running directly: node dist/db/migrate.js
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[migrate] Error:', err)
      process.exit(1)
    })
}
