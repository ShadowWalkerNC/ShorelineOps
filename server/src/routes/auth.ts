import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { z } from 'zod'
import * as OTPAuth from 'otpauth'
import { pool } from '../db/pool'
import { requireAuth, API_ROLES } from '../middleware/requireAuth'
import type { AuthRequest, ApiRole } from '../middleware/requireAuth'

export const authRouter = Router()

const JWT_EXPIRES = (process.env.JWT_EXPIRES_IN ?? '15m') as jwt.SignOptions['expiresIn']
const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7)
const MFA_PENDING_EXPIRES = '5m' as jwt.SignOptions['expiresIn']
const ISSUER = process.env.MFA_ISSUER || 'ShorelineOps'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a value at least 32 characters long')
  }
  return secret
}

function makeTokens(userId: string, role: ApiRole, mfaVerified: boolean) {
  const accessToken = jwt.sign(
    { sub: userId, role, mfa: mfaVerified },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES }
  )

  const refreshToken = jwt.sign(
    { sub: userId, role, mfa: mfaVerified, type: 'refresh' },
    getJwtSecret(),
    { expiresIn: `${REFRESH_EXPIRES_DAYS}d` as jwt.SignOptions['expiresIn'] }
  )

  return { accessToken, refreshToken }
}
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES }
  )
  const refreshToken = crypto.randomBytes(48).toString('hex')
  return { accessToken, refreshToken }
}

function makeMfaPendingToken(userId: string, purpose: 'mfa_verify' | 'mfa_enroll') {
  return jwt.sign(
    { sub: userId, purpose },
    getJwtSecret(),
    { expiresIn: MFA_PENDING_EXPIRES }
  )
}

function verifyMfaPendingToken(token: string, purpose: 'mfa_verify' | 'mfa_enroll'): string {
  const payload = jwt.verify(token, getJwtSecret()) as { sub?: string; purpose?: string }
  if (!payload.sub || payload.purpose !== purpose) {
    throw Object.assign(new Error('Invalid MFA session'), { status: 401 })
  }
  return payload.sub
}
function asApiRole(role: string): ApiRole {
  return (API_ROLES as readonly string[]).includes(role) ? (role as ApiRole) : 'readonly'
}

function totpFromSecret(secretBase32: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
}

function verifyTotp(secretBase32: string, code: string): boolean {
  const delta = totpFromSecret(secretBase32).validate({ token: code, window: 1 })
  return delta !== null
}

async function isMfaRequiredGlobally(): Promise<boolean> {
  try {
    const { rows } = await pool.query('SELECT mfa_required FROM system_settings WHERE id = 1')
    return !!rows[0]?.mfa_required
  } catch {
    return false
  }
}

async function issueSession(user: { id: string; name: string; email: string; role: string }, mfaVerified: boolean) {
  const role = asApiRole(user.role)
  const { accessToken, refreshToken } = makeTokens(user.id, role, mfaVerified)
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400_000)

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  )
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])
  await pool.query(
    `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
     VALUES ('LOGIN', $1, 'auth', 'success', $2)`,
    [user.id, JSON.stringify({ mfaVerified })]
  )

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      mfaVerified,
    },
  }
}
// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body)

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND active = true', [email.toLowerCase()]
    )
    const user = rows[0]

    const passwordMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, '$2a$12$invalidhashfortimingprotection000000')

    if (!user || !passwordMatch) {
      await pool.query(
        `INSERT INTO audit_log (action, resource_type, outcome, details)
         VALUES ('LOGIN', 'auth', 'failure', $1)`,
        [JSON.stringify({ email })]
      )
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const globalMfa = await isMfaRequiredGlobally()
    const userMfaEnabled = !!user.mfa_enabled && !!user.mfa_secret
    const role = asApiRole(user.role)

    if (userMfaEnabled) {
      const mfaToken = makeMfaPendingToken(user.id, 'mfa_verify')
      return res.json({
        mfaRequired: true,
        mfaToken,
        user: { id: user.id, name: user.name, email: user.email, role },
      })
    }

    if (globalMfa && !userMfaEnabled) {
      const mfaToken = makeMfaPendingToken(user.id, 'mfa_enroll')
      return res.json({
        mfaEnrollmentRequired: true,
        mfaToken,
        user: { id: user.id, name: user.name, email: user.email, role },
      })
    }

    const { accessToken, refreshToken } = makeTokens(user.id, role, false)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400_000)

    if (userMfaEnabled) {
      const mfaToken = makeMfaPendingToken(user.id, 'mfa_verify')
      return res.json({
        mfaRequired: true,
        mfaToken,
        user: { id: user.id, email: user.email, name: user.name },
      })
    }

    if (globalMfa && !userMfaEnabled) {
      const mfaToken = makeMfaPendingToken(user.id, 'mfa_enroll')
      return res.json({
        mfaEnrollmentRequired: true,
        mfaToken,
        user: { id: user.id, email: user.email, name: user.name },
      })
    }

    res.json(await issueSession(user, false))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/verify — complete login with TOTP
// ─────────────────────────────────────────────
authRouter.post('/mfa/verify', async (req, res, next) => {
  try {
    const { mfaToken, code } = z.object({
      mfaToken: z.string().min(1),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body)

    const userId = verifyMfaPendingToken(mfaToken, 'mfa_verify')
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND active = true', [userId]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'User not found.' })

    if (!user?.mfa_secret || !user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled for this account.' })
    }

    if (!verifyTotp(user.mfa_secret, code)) {
      await pool.query(
        `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
         VALUES ('LOGIN', $1, 'auth', 'failure', $2)`,
        [user.id, JSON.stringify({ reason: 'mfa_invalid' })]
      )
      return res.status(401).json({ error: 'Invalid authentication code.' })
    }

    // Successful MFA: update last login and record success
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
       VALUES ('LOGIN', $1, 'auth', 'success', $2)`,
      [user.id, JSON.stringify({ mfaVerified: true })]
    )

    res.json(await issueSession(user, true))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/setup/begin — start enrollment (pending or authenticated)
// ─────────────────────────────────────────────
authRouter.post('/mfa/setup/begin', async (req, res, next) => {
  try {
    const body = z.object({
      mfaToken: z.string().optional(),
    }).parse(req.body)

    let userId: string | undefined

    if (body.mfaToken) {
      userId = verifyMfaPendingToken(body.mfaToken, 'mfa_enroll')
    } else {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const payload = jwt.verify(header.slice(7), getJwtSecret()) as { sub?: string }
      userId = payload.sub
    }

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { rows } = await pool.query(
      'SELECT id, email, name, mfa_enabled FROM users WHERE id = $1 AND active = true',
      [userId]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'User not found.' })
    if (user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled. Disable it before re-enrolling.' })
    }

    const secret = new OTPAuth.Secret({ size: 20 })
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    // Store pending secret (not enabled until confirmed)
    await pool.query(
      `UPDATE users SET mfa_secret = $1, mfa_enabled = false, updated_at = NOW() WHERE id = $2`,
      [secret.base32, userId]
    )
    )

    res.json({
      secret: secret.base32,
      otpauthUrl: totp.toString(),
      issuer: ISSUER,
      account: user.email,
    })

    if (userMfaEnabled) {
      const mfaToken = makeMfaPendingToken(user.id, 'mfa_verify')
      return res.json({
        mfaRequired: true,
        mfaToken,
        user: { id: user.id, email: user.email, name: user.name },
      })
    }

    if (globalMfa && !userMfaEnabled) {
      const mfaToken = makeMfaPendingToken(user.id, 'mfa_enroll')
      return res.json({
        mfaEnrollmentRequired: true,
        mfaToken,
        user: { id: user.id, email: user.email, name: user.name },
      })
    }

    res.json(await issueSession(user, false))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/verify — complete login with TOTP
// ─────────────────────────────────────────────
authRouter.post('/mfa/verify', async (req, res, next) => {
  try {
    const { mfaToken, code } = z.object({
      mfaToken: z.string().min(1),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body)

    const userId = verifyMfaPendingToken(mfaToken, 'mfa_verify')
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND active = true', [userId]
    )
    const user = rows[0]
    if (!user?.mfa_secret || !user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is not enabled for this account.' })
    }

    if (!verifyTotp(user.mfa_secret, code)) {
      await pool.query(
        `INSERT INTO audit_log (action, user_id, resource_type, outcome, details)
         VALUES ('LOGIN', $1, 'auth', 'failure', $2)`,
        [user.id, JSON.stringify({ reason: 'mfa_invalid' })]
      )
      return res.status(401).json({ error: 'Invalid authentication code.' })
    }

    res.json(await issueSession(user, true))
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/setup/begin — start enrollment (pending or authenticated)
// ─────────────────────────────────────────────
authRouter.post('/mfa/setup/begin', async (req, res, next) => {
  try {
    const body = z.object({
      mfaToken: z.string().optional(),
    }).parse(req.body)

    let userId: string | undefined

    if (body.mfaToken) {
      userId = verifyMfaPendingToken(body.mfaToken, 'mfa_enroll')
    } else {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const payload = jwt.verify(header.slice(7), getJwtSecret()) as { sub?: string }
      userId = payload.sub
    }

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { rows } = await pool.query(
      'SELECT id, email, name, mfa_enabled FROM users WHERE id = $1 AND active = true',
      [userId]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'User not found.' })
    if (user.mfa_enabled) {
      return res.status(400).json({ error: 'MFA is already enabled. Disable it before re-enrolling.' })
    }

    const secret = new OTPAuth.Secret({ size: 20 })
    const totp = new OTPAuth.TOTP({
      issuer: ISSUER,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    // Store pending secret (not enabled until confirmed)
    await pool.query(
    // Store pending secret (not enabled until confirmed)
    await pool.query(
      `UPDATE users SET mfa_secret = $1, mfa_enabled = false, updated_at = NOW() WHERE id = $2`,
      [secret.base32, userId]
    )

    res.json({
      secret: secret.base32,
      otpauthUrl: totp.toString(),
      issuer: ISSUER,
      account: user.email,
      mfaEnrollmentRequired: true,
      mfaToken: pendingToken,
    })
    })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/setup/confirm — enable MFA after verifying first code
// ─────────────────────────────────────────────
authRouter.post('/mfa/setup/confirm', async (req, res, next) => {
  try {
    const { mfaToken, code } = z.object({
      mfaToken: z.string().optional(),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body)

    let userId: string | undefined
    let fromEnrollment = false

    if (mfaToken) {
      userId = verifyMfaPendingToken(mfaToken, 'mfa_enroll')
      fromEnrollment = true
    } else {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const payload = jwt.verify(header.slice(7), getJwtSecret()) as { sub?: string }
      userId = payload.sub
    }

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND active = true', [userId]
    )
    const user = rows[0]
    if (!user?.mfa_secret) {
      return res.status(400).json({ error: 'Call /mfa/setup/begin first.' })
    }
    if (!verifyTotp(user.mfa_secret, code)) {
      return res.status(401).json({ error: 'Invalid authentication code.' })
    }

    await pool.query(
      `UPDATE users SET mfa_enabled = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('MFA_ENABLE', $1, 'auth', 'success')`,
      [userId]
    )

    if (fromEnrollment) {
      // Complete login after forced enrollment
      return res.json(await issueSession(user, true))
    }

    res.json({ success: true, mfaEnabled: true })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/disable — admin/self with current TOTP
// ─────────────────────────────────────────────
authRouter.post('/mfa/disable', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND active = true', [req.userId]
    )
    const user = rows[0]
    if (!user?.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA is not enabled.' })
    }
    if (!verifyTotp(user.mfa_secret, code)) {
      return res.status(401).json({ error: 'Invalid authentication code.' })
    }

    await pool.query(
      `UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1`,
      [req.userId]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('MFA_DISABLE', $1, 'auth', 'success')`,
      [req.userId]
    )
    res.json({ success: true, mfaEnabled: false })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/setup/confirm — enable MFA after verifying first code
// ─────────────────────────────────────────────
authRouter.post('/mfa/setup/confirm', async (req, res, next) => {
  try {
    const { mfaToken, code } = z.object({
      mfaToken: z.string().optional(),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body)

    let userId: string | undefined
    let fromEnrollment = false

    if (mfaToken) {
      userId = verifyMfaPendingToken(mfaToken, 'mfa_enroll')
      fromEnrollment = true
    } else {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const payload = jwt.verify(header.slice(7), getJwtSecret()) as { sub?: string }
      userId = payload.sub
    }

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND active = true', [userId]
    )
    const user = rows[0]
    if (!user?.mfa_secret) {
      return res.status(400).json({ error: 'Call /mfa/setup/begin first.' })
    }
    if (!verifyTotp(user.mfa_secret, code)) {
      return res.status(401).json({ error: 'Invalid authentication code.' })
    }

    await pool.query(
      `UPDATE users SET mfa_enabled = true, updated_at = NOW() WHERE id = $1`,
      [userId]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('MFA_ENABLE', $1, 'auth', 'success')`,
      [userId]
    )

    if (fromEnrollment) {
      // Complete login after forced enrollment
      return res.json(await issueSession(user, true))
    }

    res.json({ success: true, mfaEnabled: true })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/mfa/disable — admin/self with current TOTP
// ─────────────────────────────────────────────
authRouter.post('/mfa/disable', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1 AND active = true', [req.userId]
    )
    const user = rows[0]
    if (!user?.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA is not enabled.' })
    }
    if (!verifyTotp(user.mfa_secret, code)) {
      return res.status(401).json({ error: 'Invalid authentication code.' })
    }

    await pool.query(
      `UPDATE users SET mfa_enabled = false, mfa_secret = NULL, updated_at = NOW() WHERE id = $1`,
      [req.userId]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('MFA_DISABLE', $1, 'auth', 'success')`,
      [req.userId]
    )
    res.json({ success: true, mfaEnabled: false })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')

    const { rows } = await pool.query(
      `SELECT rt.*, u.id AS uid, u.name, u.email, u.role, u.active, u.mfa_enabled
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND u.active = true`,
      [tokenHash]
    )
    if (!rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token.' })

    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id])
    const role = asApiRole(rows[0].role)
    // Refresh preserves prior MFA satisfaction for enrolled users (session continuity)
    const mfaVerified = !!rows[0].mfa_enabled
    const { accessToken, refreshToken: newRefreshToken } = makeTokens(rows[0].uid, role, mfaVerified)
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400_000)

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [rows[0].uid, newHash, expiresAt]
    )

    res.json({ accessToken, refreshToken: newRefreshToken })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, mfa_enabled FROM users WHERE id = $1 AND active = true',
      [req.userId]
    )
    if (!rows[0]) return res.status(401).json({ error: 'User not found.' })

    const header = req.headers.authorization!
    const payload = jwt.verify(header.slice(7), getJwtSecret()) as { mfa?: boolean }

    res.json({
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: asApiRole(rows[0].role),
      mfaEnabled: !!rows[0].mfa_enabled,
      mfaVerified: !!payload.mfa,
    })
  } catch (err) { next(err) }
})

// ─────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────
authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
    res.status(204).send()
  } catch (err) { next(err) }
})
