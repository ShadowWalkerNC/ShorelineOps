import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import { authRouter } from './routes/auth'
import { residentsRouter } from './routes/residents'
import { auditRouter } from './routes/audit'
import { menuRouter } from './routes/menu'
import { productionRouter } from './routes/production'
import { adminRouter } from './routes/admin'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/requireAuth'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'

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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', limiter)
app.use('/api/auth', authLimiter)

// Routes
app.use('/api/auth',       authRouter)
app.use('/api/residents',  requireAuth, residentsRouter)
app.use('/api/audit',      requireAuth, auditRouter)
app.use('/api/menu',       requireAuth, menuRouter)
app.use('/api/production', requireAuth, productionRouter)
app.use('/api/admin',      requireAuth, adminRouter)

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))

// Global error handler
app.use(errorHandler)

// Migrate → seed → start
runMigrations()
  .then(() => runSeed())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Shoreline API] Running on port ${PORT} (${process.env.NODE_ENV})`)
    })
  })
  .catch((err) => {
    console.error('[Shoreline API] Startup failed:', err)
    process.exit(1)
  })

export default app
