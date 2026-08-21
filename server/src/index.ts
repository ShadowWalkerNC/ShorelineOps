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
import { timecardRouter } from './routes/timecard'
import { kitchenRouter } from './routes/kitchen'
import { purchasingRouter } from './routes/purchasing'
import { reportingRouter } from './routes/reporting'
import { setupRouter } from './routes/setup'
import { ehrRouter } from './routes/ehr'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/requireAuth'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'

const app = express()
const PORT = process.env.PORT ?? 3001
const isProd = process.env.NODE_ENV === 'production'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  if (isProd) {
    console.error('[Shoreline API] JWT_SECRET must be set (≥32 chars) in production')
    process.exit(1)
  }
  console.warn('[Shoreline API] JWT_SECRET missing or short — set a strong secret before production use')
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-jwt-secret-change-me!!'
}

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: 'deny' },
    noSniff: true,
  })
)
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
app.use('/api/setup',      setupRouter)
app.use('/api/auth',       authRouter)
app.use('/api/residents',  requireAuth, residentsRouter)
app.use('/api/audit',      requireAuth, auditRouter)
app.use('/api/menu',       requireAuth, menuRouter)
app.use('/api/production', requireAuth, productionRouter)
app.use('/api/admin',      requireAuth, adminRouter)
app.use('/api/timecard',   timecardRouter)
app.use('/api/kitchen',    requireAuth, kitchenRouter)
app.use('/api/purchasing', requireAuth, purchasingRouter)
app.use('/api/reporting',  requireAuth, reportingRouter)
app.use('/api/ehr',        ehrRouter)

import path from 'path'
import fs from 'fs'

// Check if frontend build exists to serve single-port container
const clientDistPath = path.resolve(__dirname, '../../dist')
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next()
    }
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
} else {
  // Root API landing page
  app.get('/', (_req, res) => {
    res.json({
      service: 'Shoreline Operations Platform API',
      status: 'online',
      version: '5.0.0',
      documentation: '/api/docs',
      health: '/health',
      frontend: 'http://localhost:3000',
      endpoints: [
        '/api/setup',
        '/api/auth',
        '/api/residents',
        '/api/menu',
        '/api/production',
        '/api/purchasing',
        '/api/reporting',
        '/api/distributor',
        '/api/kitchen',
        '/api/timecard',
        '/api/ehr',
        '/api/admin',
      ],
    })
  })
}

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
