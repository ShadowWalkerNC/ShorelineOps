import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db, rejectBearer, asyncRoute } from '../security/middleware'
import { transaction } from '../db/pool'
import { config, decodeOutboxKey } from '../config'
import { newPassword } from '../security/password'
import { audit } from '../security/audit'
import { newToken, sha256hex } from '../security/tokens'
import { enqueueEmail } from '../email/outbox'
import { gmailStatus } from '../email/gmail'
import { signupLimiter, emailLimiter, verifyLimiter } from '../security/rateLimit'

export const signupRouter = Router()

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const signupSchema = z.object({ email: emailSchema, password: newPassword }).strict()

const GENERIC = 'If this account needs verification, its email is queued when delivery is configured.'

function clientInfo(req: { ip?: string; headers: { [k: string]: unknown } }) {
  return { ip: req.ip ?? null, userAgent: typeof req.headers['user-agent'] === 'string' ? (req.headers['user-agent'] as string) : null }
}

// Global sender state only — identical for new and duplicate signups so the
// reply shape never leaks whether an address already has an account.
function emailState(): 'queued' | 'unavailable' {
  return gmailStatus().configured && decodeOutboxKey() ? 'queued' : 'unavailable'
}

function verifyLink(token: string): string {
  return `${config.publicOrigin}/verify.html#token=${token}`
}

// CP-01: public signup creates an UNVERIFIED account; no paid entitlement here.
signupRouter.post('/signup', signupLimiter, rejectBearer, asyncRoute(async (req, res) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' })
  const pool = db(req)
  const { email, password } = parsed.data
  const { ip, userAgent } = clientInfo(req)

  const passwordHash = await bcrypt.hash(password, 12)
  await transaction(pool, async client => {
  const { rows } = await client.query('INSERT INTO accounts (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id', [
    email,
    passwordHash,
  ])
  if (!rows.length) {
    await audit(client, 'ACCOUNT_SIGNUP_DUPLICATE', { ip, userAgent })
    return
  }
  const accountId = rows[0].id as string
  const token = newToken()
  await client.query(`INSERT INTO account_emails (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')`, [
    accountId,
    sha256hex(token),
  ])
  const queued = await enqueueEmail(client, {
    accountId,
    to: email,
    kind: 'verify',
    subject: 'Verify your ShorelineOps account',
    text: `Welcome to ShorelineOps.\n\nVerify your account (link expires in 24 hours):\n${verifyLink(token)}\n\nIf you did not request this, ignore this message.`,
  })
  await audit(client, 'ACCOUNT_SIGNUP', { accountId, ip, userAgent, meta: { emailQueued: queued.queued } })
  })
  return res.status(201).json({ message: GENERIC, emailStatus: emailState() })
}))

// Single-use verification, 24h expiry. Plaintext token exists only in the email.
signupRouter.post('/verify', verifyLimiter, rejectBearer, asyncRoute(async (req, res) => {
  const token = typeof req.body?.token === 'string' && req.body.token.length <= 500 ? req.body.token : ''
  if (!token) return res.status(400).json({ error: 'INVALID_OR_EXPIRED' })
  const pool = db(req)
  const { rows } = await pool.query('SELECT id, account_id, expires_at, used_at FROM account_emails WHERE token_hash = $1', [
    sha256hex(token),
  ])
  const row = rows[0] as { id: string; account_id: string; expires_at: Date; used_at: Date | null } | undefined
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'INVALID_OR_EXPIRED' })
  }
  const verified = await transaction(pool, async client => {
    await client.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [row.account_id])
    const used = await client.query('UPDATE account_emails SET used_at = now() WHERE id = $1 AND used_at IS NULL AND expires_at > now()', [row.id])
    if (used.rowCount !== 1) {
      return false
    }
    await client.query('UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now() WHERE id = $1', [
      row.account_id,
    ])
    const { ip, userAgent } = clientInfo(req)
    await audit(client, 'ACCOUNT_VERIFIED', { accountId: row.account_id, ip, userAgent })
    return true
  })
  if (!verified) return res.status(400).json({ error: 'INVALID_OR_EXPIRED' })
  return res.json({ message: 'Email verified. You can now log in.' })
}))

// Generic resend; honestly 503 when the account needs mail but no sender exists.
signupRouter.post('/resend', emailLimiter, rejectBearer, asyncRoute(async (req, res) => {
  const parsed = z.object({ email: emailSchema }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'INVALID_INPUT' })
  if (emailState() === 'unavailable') return res.status(503).json({ error: 'EMAIL_UNAVAILABLE', message: 'Email delivery is not configured.' })
  const pool = db(req)
  const { email } = parsed.data
  const { ip, userAgent } = clientInfo(req)
  const { rows } = await pool.query('SELECT id, email_verified_at FROM accounts WHERE email = $1', [email])
  const account = rows[0] as { id: string; email_verified_at: Date | null } | undefined
  if (!account || account.email_verified_at) return res.json({ message: GENERIC })
  const token = newToken()
  await transaction(pool, async client => {
  await client.query(`INSERT INTO account_emails (account_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '24 hours')`, [
    account.id,
    sha256hex(token),
  ])
  await enqueueEmail(client, {
    accountId: account.id,
    to: email,
    kind: 'verify',
    subject: 'Verify your ShorelineOps account',
    text: `Verify your account (link expires in 24 hours):\n${verifyLink(token)}`,
  })
  await audit(client, 'ACCOUNT_RESEND', { accountId: account.id, ip, userAgent })
  })
  return res.json({ message: GENERIC })
}))
