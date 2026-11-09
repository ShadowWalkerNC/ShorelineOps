import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { config, decodeOutboxKey } from '../config'
import { db, rejectBearer, requireSession, asyncRoute, type SessionRequest } from '../security/middleware'
import { transaction } from '../db/pool'
import { newPassword, loginPassword } from '../security/password'
import { audit } from '../security/audit'
import { newToken, sha256hex } from '../security/tokens'
import {
  createSession,
  readSessionCookie,
  revokeSession,
  sessionCookie,
  clearSessionCookie,
} from '../security/sessions'
import { enqueueEmail } from '../email/outbox'
import { gmailStatus } from '../email/gmail'
import { loginLimiter, emailLimiter, verifyLimiter } from '../security/rateLimit'

export const accountAuthRouter = Router()

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const DUMMY_HASH = bcrypt.hashSync('comparison-only-no-account', 12)

function clientInfo(req: { ip?: string; headers: { [k: string]: unknown } }) {
  return { ip: req.ip ?? null, userAgent: typeof req.headers['user-agent'] === 'string' ? (req.headers['user-agent'] as string) : null }
}

// CP-02: opaque secure-cookie sessions. Bearer JWTs (clinical staff auth) are
// rejected by rejectBearer before any credential check runs.
accountAuthRouter.post('/login', loginLimiter, rejectBearer, asyncRoute(async (req, res) => {
  const parsed = z.object({ email: emailSchema, password: loginPassword }).strict().safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' })
  const pool = db(req)
  const { email, password } = parsed.data
  const { ip, userAgent } = clientInfo(req)
  const { rows } = await pool.query('SELECT id, password_hash, email_verified_at FROM accounts WHERE email = $1', [email])
  const account = rows[0] as { id: string; password_hash: string; email_verified_at: Date | null } | undefined
  const ok = await bcrypt.compare(password, account ? account.password_hash : DUMMY_HASH)
  if (!account || !ok) {
    await audit(pool, 'ACCOUNT_LOGIN_FAILED', { accountId: account?.id ?? null, ip, userAgent })
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
  }
  if (!account.email_verified_at) {
    await audit(pool, 'ACCOUNT_LOGIN_UNVERIFIED', { accountId: account.id, ip, userAgent })
    return res.status(403).json({ error: 'EMAIL_UNVERIFIED' })
  }
  const session = await transaction(pool, async client => {
    const current = await client.query('SELECT password_hash, email_verified_at FROM accounts WHERE id = $1 FOR UPDATE', [account.id])
    if (current.rows[0]?.password_hash !== account.password_hash || !current.rows[0]?.email_verified_at) return null
    const session = await createSession(client, account.id, ip, userAgent)
    await audit(client, 'ACCOUNT_LOGIN', { accountId: account.id, ip, userAgent })
    return session
  })
  if (!session) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
  const { token, expiresAt } = session
  res.setHeader('Set-Cookie', sessionCookie(token, expiresAt, config.cookieSecure))
  return res.json({ message: 'Logged in.', email })
}))

accountAuthRouter.post('/logout', rejectBearer, asyncRoute(async (req, res) => {
  const pool = db(req)
  const token = readSessionCookie(req)
  if (token) {
    await revokeSession(pool, token)
    const { ip, userAgent } = clientInfo(req)
    await audit(pool, 'ACCOUNT_LOGOUT', { ip, userAgent })
  }
  res.setHeader('Set-Cookie', clearSessionCookie(config.cookieSecure))
  return res.json({ message: 'Logged out.' })
}))

accountAuthRouter.get('/me', requireSession, (req: SessionRequest, res) => {
  return res.json({ email: req.session?.email, emailVerified: req.session?.verified })
})

// Generic reset request — always 200 so existence is never leaked.
accountAuthRouter.post('/password/request', emailLimiter, rejectBearer, asyncRoute(async (req, res) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' })
  const pool = db(req)
  const { email } = parsed.data
  const { ip, userAgent } = clientInfo(req)
  const { rows } = await pool.query('SELECT id FROM accounts WHERE email = $1', [email])
  const account = rows[0] as { id: string } | undefined
  if (account) {
    const token = newToken()
    await transaction(pool, async client => {
    await client.query(`INSERT INTO password_resets (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [
      account.id,
      sha256hex(token),
    ])
    const resetLink = `${config.publicOrigin}/reset.html#token=${token}`
    await enqueueEmail(client, {
      accountId: account.id,
      to: email,
      kind: 'reset',
      subject: 'Reset your ShorelineOps password',
      text: `Reset your password (link expires in 1 hour):\n${resetLink}\n\nIf you did not request this, ignore this message.`,
    })
    await audit(client, 'PASSWORD_RESET_REQUESTED', { accountId: account.id, ip, userAgent })
    })
  } else {
    await audit(pool, 'PASSWORD_RESET_REQUESTED_UNKNOWN', { ip, userAgent })
  }
  return res.json({ message: 'If this account exists, its recovery email is queued when delivery is configured.', emailStatus: gmailStatus().configured && decodeOutboxKey() ? 'queued' : 'unavailable' })
}))

// Single-use reset, 1h expiry; success revokes ALL sessions (CP-02).
accountAuthRouter.post('/password/confirm', verifyLimiter, rejectBearer, asyncRoute(async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(1).max(500), password: newPassword }).strict()
    .safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' })
  const pool = db(req)
  const { token, password } = parsed.data
  const { rows } = await pool.query('SELECT id, account_id, expires_at, used_at FROM password_resets WHERE token_hash = $1', [
    sha256hex(token),
  ])
  const row = rows[0] as { id: string; account_id: string; expires_at: Date; used_at: Date | null } | undefined
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'INVALID_OR_EXPIRED' })
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const changed = await transaction(pool, async client => {
    await client.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [row.account_id])
    const used = await client.query('UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL AND expires_at > now()', [row.id])
    if (used.rowCount !== 1) {
      return false
    }
    await client.query('UPDATE accounts SET password_hash = $1, updated_at = now() WHERE id = $2', [passwordHash, row.account_id])
    await client.query('UPDATE account_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL', [row.account_id])
    await client.query('UPDATE password_resets SET used_at = now() WHERE account_id = $1 AND used_at IS NULL', [row.account_id])
    const { ip, userAgent } = clientInfo(req)
    await audit(client, 'PASSWORD_RESET_COMPLETED', { accountId: row.account_id, ip, userAgent })
    return true
  })
  if (!changed) return res.status(400).json({ error: 'INVALID_OR_EXPIRED' })
  return res.json({ message: 'Password updated. Log in with your new password.' })
}))
