import fs from 'fs'
import path from 'path'
import type { Pool } from 'pg'
import { getPool, closePool, transaction } from './pool'

// Resolves to control-plane/migrations from both src (tsx) and dist (node).
export function migrationsDir(): string {
  return path.join(__dirname, '..', '..', 'migrations')
}

export async function migrate(pool: Pool): Promise<string[]> {
  return transaction(pool, async client => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('shoreline-control-migrations'))")
  await client.query(
    'CREATE TABLE IF NOT EXISTS _control_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())'
  )
  const files = fs.readdirSync(migrationsDir()).filter((f) => f.endsWith('.sql')).sort()
  const applied: string[] = []
  for (const file of files) {
    const { rows } = await client.query('SELECT 1 FROM _control_migrations WHERE name = $1', [file])
    if (rows.length) continue
    const sql = fs.readFileSync(path.join(migrationsDir(), file), 'utf8')
      await client.query(sql)
      await client.query('INSERT INTO _control_migrations (name) VALUES ($1)', [file])
      applied.push(file)
  }
  return applied
  })
}

if (require.main === module) {
  ;(async () => {
    const pool = getPool()
    try {
      const applied = await migrate(pool)
      console.log(`migrations applied: ${applied.join(', ') || 'none'}`)
    } finally {
      await closePool()
    }
  })().catch((err: unknown) => {
    console.error('migrate failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
}
