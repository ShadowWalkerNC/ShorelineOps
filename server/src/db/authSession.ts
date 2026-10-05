import { pool, databaseDialect } from './pool'

export interface AuthDatabaseClient {
  query(sql: string, params?: any[]): Promise<{ rows: any[] }>
}

/** A user row lock serializes login/refresh with security changes on PostgreSQL.
 * SQLite's dedicated BEGIN IMMEDIATE client supplies the equivalent write reservation. */
export const AUTH_USER_LOCK = databaseDialect === 'postgres' ? ' FOR UPDATE OF u' : ''

export async function authTransaction<T>(operation: (client: AuthDatabaseClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally { client.release() }
}

export function invalidSession(): Error & { status: number } {
  return Object.assign(new Error('Invalid or revoked session'), { status: 401 })
}
