import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'
import { pool } from '../db/pool'

export const authRouter = Router()

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function signAccessToken(userId: string, role: string) {
  return jwt.sign(
    { sub: userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' }
  )
}

function signRefreshToken(userId: string) {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d' }
  )
}

// POST /api/auth/login
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body)

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email.toLowerCase()]
    )
    const user = rows[0]

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log failed attempt
      await pool.query(
        `INSERT INTO audit_log (action, outcome, ip_address, user_agent, details)
         VALUES ('LOGIN_FAILED', 'failure', $1, $2, $3)`,
        [req.ip, req.headers['user-agent'], JSON.stringify({ email })]
      )
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const accessToken = signAccessToken(user.id, user.role)
    const refreshToken = signRefreshToken(user.id)

    // Store hashed refresh token
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    )

    // Audit log success
    await pool.query(
      `INSERT INTO audit_log (action, user_id, outcome, ip_address, user_agent)
       VALUES ('LOGIN', $1, 'success', $2, $3)`,
      [user.id, req.ip, req.headers['user-agent']]
    )

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaVerified: false, // TODO: wire up MFA
      },
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)

    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!) as {
      sub: string
      type: string
    }
    if (payload.type !== 'refresh') return res.status(401).json({ error: 'Invalid token' })

    const tokenHash = createHash('sha256').update(refreshToken).digest('hex')
    const { rows } = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW()',
      [tokenHash]
    )
    if (!rows[0]) return res.status(401).json({ error: 'Token expired or revoked' })

    // Rotate: delete old, issue new
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])

    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [payload.sub])
    const user = userRes.rows[0]
    if (!user) return res.status(401).json({ error: 'User not found' })

    const newAccessToken = signAccessToken(user.id, user.role)
    const newRefreshToken = signRefreshToken(user.id)
    const newHash = createHash('sha256').update(newRefreshToken).digest('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, newHash, expiresAt]
    )

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout
authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body)
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex')
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash])
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
