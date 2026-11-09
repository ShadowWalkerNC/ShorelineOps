import { Pool, type PoolClient } from 'pg'
import { config } from '../config'

let pool: Pool | null = null
export type Queryable = Pick<PoolClient, 'query'>

export async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// App pool for CONTROL_DATABASE_URL. Tests construct their own Pool directly
// against a gated CONTROL_TEST_DATABASE_URL and pass it to createApp().
export function getPool(): Pool {
  if (pool) return pool
  if (!config.databaseUrl) {
    throw Object.assign(new Error('CONTROL_DATABASE_URL is not set'), { code: 'DB_UNCONFIGURED' })
  }
  pool = new Pool({ connectionString: config.databaseUrl, max: 10, connectionTimeoutMillis: 5000 })
  pool.on('error', () => console.error('Control-plane database connection failed'))
  return pool
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}
