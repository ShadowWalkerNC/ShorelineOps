import rateLimit from 'express-rate-limit'

const base = { standardHeaders: 'draft-7' as const, legacyHeaders: false, message: { error: 'RATE_LIMITED' } }

export const signupLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 20 })
export const loginLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 30 })
export const emailLimiter = rateLimit({ ...base, windowMs: 60 * 60 * 1000, limit: 10 })
export const verifyLimiter = rateLimit({ ...base, windowMs: 15 * 60 * 1000, limit: 60 })
