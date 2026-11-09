import { z } from 'zod'

export const loginPassword = z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password exceeds the bcrypt byte limit')
export const newPassword = loginPassword.refine(value => value.length >= 12, 'Use at least 12 characters')
