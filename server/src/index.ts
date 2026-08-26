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
import { recipesRouter } from './routes/recipes'
import { enterpriseRouter } from './routes/enterprise'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/requireAuth'
import { pool } from './db/pool'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'

import crypto from 'crypto'

const app = express()
const PORT = process.env.PORT ?? 3015
const isProd = process.env.NODE_ENV === 'production'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  const generated = crypto.randomBytes(32).toString('hex')
  console.warn('[Shoreline API] JWT_SECRET missing or <32 chars — generated fallback runtime secret')
  process.env.JWT_SECRET = process.env.JWT_SECRET || generated
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

import { httpCacheMiddleware } from './middleware/cache'

import { mcpRouter } from './routes/mcp'
import { globalHealerBot } from './agent/healer'

// Routes
app.use('/api/setup',      setupRouter)
app.use('/api/auth',       authRouter)
app.use('/api/residents',  requireAuth, httpCacheMiddleware(30, 'residents'), residentsRouter)
app.use('/api/audit',      requireAuth, auditRouter)
app.use('/api/menu',       requireAuth, httpCacheMiddleware(60, 'menu'), menuRouter)
app.use('/api/recipes',    requireAuth, httpCacheMiddleware(60, 'recipes'), recipesRouter)
app.use('/api/production', requireAuth, productionRouter)
app.use('/api/admin',      requireAuth, adminRouter)
app.use('/api/kitchen',    requireAuth, kitchenRouter)
app.use('/api/purchasing', requireAuth, purchasingRouter)
app.use('/api/reporting',  requireAuth, reportingRouter)
app.use('/api/enterprise', enterpriseRouter)
app.use('/api/ehr',        ehrRouter)
app.use('/api/mcp',        mcpRouter)

// Optional Pluggable Modules
if (process.env.ENABLE_TIMECARD_PLUGIN !== 'false') {
  app.use('/api/timecard', timecardRouter)
}

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

// Health and Readiness Probes for Kubernetes / Docker / Cloud Load Balancers / Render
const handleHealth = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'ShorelineOps API',
    version: '6.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  })
}

app.get('/health', handleHealth)
app.get('/api/health', handleHealth)

app.get('/ready', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT 1 as ready')
    if (rows && rows.length > 0) {
      return res.json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      })
    }
    return res.status(503).json({ status: 'unready', database: 'no_rows' })
  } catch (err: any) {
    return res.status(503).json({
      status: 'unready',
      database: 'disconnected',
      error: err.message,
    })
  }
})

// Global error handler
app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`[Shoreline API] Running on port ${PORT} (${process.env.NODE_ENV})`)
  
  // Non-fatal migration & seed background runner
  runMigrations()
    .then(() => runSeed())
    .then(() => {
      console.log('[Shoreline API] Database migrations & seed verified.')
      globalHealerBot.startDaemon(300000) // Run self-healing background checks every 5 minutes
    })
    .catch((err) => {
      console.warn('[Shoreline API] Database initialization warning (will retry in background):', err.message)
      globalHealerBot.startDaemon(300000)
    })
})

export default app
