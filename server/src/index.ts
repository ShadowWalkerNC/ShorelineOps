import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import { authRouter } from './routes/auth'
import { residentsRouter } from './routes/residents'
import { auditRouter } from './routes/audit'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/requireAuth'

const app = express()
const PORT = process.env.PORT ?? 3001

// Security middleware
app.use(helmet())
app.use(compression())
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

// Rate limiting — HIPAA / SOC 2 require brute-force protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // Strict limit on auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', limiter)
app.use('/api/auth', authLimiter)

// Routes
app.use('/api/auth', authRouter)
app.use('/api/residents', requireAuth, residentsRouter)
app.use('/api/audit', requireAuth, auditRouter)

// Health check (unauthenticated — used by Render)
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// Global error handler
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`[Shoreline API] Running on port ${PORT} (${process.env.NODE_ENV})`)
})

export default app
