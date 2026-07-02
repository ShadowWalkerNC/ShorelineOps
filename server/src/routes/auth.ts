import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { z } from 'zod'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/requireAuth'
import type { AuthRequest } from '../middleware/requireAuth'

export const authRouter = Router()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN ?? '15m'
const REFRESH_EXPIRES_DAYS = 7

function makeTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  const refreshToken = crypto.randomBytes(48).toString('hex')
  return { accessToken, refreshToken }
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

    // Constant-time comparison regardless of whether user exists
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

    const { accessToken, refreshToken } = makeTokens(user.id)
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 86400_000)

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    )
    await pool.query(
      `INSERT INTO audit_log (action, user_id, resource_type, outcome)
       VALUES ('LOGIN', $1, 'auth', 'success')`,
      [user.id]
    )

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaVerified: false,
      },
    })
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
      `SELECT rt.*, u.id AS uid, u.name, u.email, u.role, u.active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1 AND rt.expires_at > NOW() AND u.active = true`,
      [tokenHash]
    )
    if (!rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token.' })

    // Rotate: delete old, issue new
    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [rows[0].id])
    const { accessToken, refreshToken: newRefreshToken } = makeTokens(rows[0].uid)
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
// GET /api/auth/me  — restore session after page reload
// ─────────────────────────────────────────────
authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role FROM users WHERE id = $1 AND active = true',
      [req.userId]
    )
    if (!rows[0]) return res.status(401).json({ error: 'User not found.' })
    res.json({
      id: rows[0].id,
      name: rows[0].name,
      email: rows[0].email,
      role: rows[0].role,
      mfaVerified: false,
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
