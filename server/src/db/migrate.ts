import 'dotenv/config'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pool } from './pool'

async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')
  console.log('[migrate] Running schema...')
  await pool.query(sql)
  console.log('[migrate] Done.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('[migrate] Error:', err)
  process.exit(1)
})
