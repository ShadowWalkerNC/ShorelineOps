import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool'
import { ACCESS_TOKEN_AUDIENCE, getJwtSecret } from '../middleware/requireAuth'
import type { ApiRole } from '../middleware/requireAuth'

/** Synthetic fixture only: provision a real persisted session, never bypass middleware. */
export async function issueTestAccessToken(
  claims: { sub: string; role: ApiRole; facilityId?: string; platformAdmin?: boolean; mfa?: boolean },
  options: { expiresIn?: jwt.SignOptions['expiresIn'] } = {},
): Promise<string> {
  if (process.env.NODE_ENV !== 'test') throw new Error('Synthetic access fixtures require NODE_ENV=test')
  await pool.query(
    `INSERT INTO users (id, name, email, password, role, active, facility_id, platform_admin)
     VALUES ($1, $2, $3, $4, $5, true, $6, $7) ON CONFLICT(id) DO NOTHING`,
    [claims.sub, 'Synthetic fixture', `fixture-${crypto.randomUUID()}@example.invalid`, 'not-a-login-password', claims.role,
      claims.facilityId || 'default', claims.platformAdmin ?? false],
  )
  const { rows } = await pool.query('SELECT auth_version FROM users WHERE id = $1', [claims.sub])
  const authVersion = Number(rows[0].auth_version)
  const sessionId = crypto.randomUUID()
  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, auth_version, mfa_verified) VALUES ($1,$2,$3,$4,$5,$6)',
    [sessionId, claims.sub, crypto.randomBytes(32).toString('hex'), new Date(Date.now() + 3600000).toISOString(), authVersion, claims.mfa ?? false],
  )
  return jwt.sign({ ...claims, facilityId: claims.facilityId || 'default', platformAdmin: claims.platformAdmin ?? false,
    mfa: claims.mfa ?? false, purpose: 'access', sessionId, authVersion }, getJwtSecret(),
    { algorithm: 'HS256', audience: ACCESS_TOKEN_AUDIENCE, expiresIn: options.expiresIn ?? '1h' })
}
