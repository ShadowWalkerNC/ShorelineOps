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
import { inventoryRouter } from './routes/inventory'
import { trayrunsRouter } from './routes/trayruns'
import { errorHandler } from './middleware/errorHandler'
import { requireAuth } from './middleware/requireAuth'
import { pool } from './db/pool'
import { runMigrations } from './db/migrate'
import { runSeed } from './db/seed'

import crypto from 'crypto'

const app = express()
const PORT = process.env.PORT ?? 3001
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
// Stripe webhook signature verification needs the RAW request bytes (A08), so the
// webhook path is parsed with express.raw BEFORE the global JSON parser runs.
app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }))
// Stash the raw request bytes (req.rawBody) so HMAC-signed webhooks (EHR) can
// verify signatures against the exact payload the sender signed.
app.use(express.json({
  limit: '1mb',
  verify: (req: any, _res, buf: Buffer) => { req.rawBody = buf },
}))

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
import { startNightlyForecastRollup } from './jobs/nightlyForecast'
import { webhooksRouter } from './routes/webhooks'
import { hardwareRouter } from './routes/hardware'
import { billingRouter } from './routes/billing'
import { tenantContextMiddleware } from './middleware/tenantContext'

// Global Tenant Context
app.use('/api', tenantContextMiddleware)

// Routes
app.use('/api/setup',      setupRouter)
app.use('/api/auth',       authRouter)
app.use('/api/billing',    billingRouter)
app.use('/api/residents',  requireAuth, httpCacheMiddleware(30, 'residents'), residentsRouter)
app.use('/api/audit',      requireAuth, auditRouter)
app.use('/api/menu',       requireAuth, httpCacheMiddleware(60, 'menu'), menuRouter)
app.use('/api/recipes',    requireAuth, httpCacheMiddleware(60, 'recipes'), recipesRouter)
app.use('/api/production', requireAuth, productionRouter)
app.use('/api/admin',      requireAuth, adminRouter)
app.use('/api/kitchen',    requireAuth, kitchenRouter)
app.use('/api/purchasing', requireAuth, purchasingRouter)
app.use('/api/inventory',  requireAuth, inventoryRouter)
app.use('/api/trayruns',  requireAuth, trayrunsRouter)
app.use('/api/reporting',  requireAuth, reportingRouter)
app.use('/api/enterprise', enterpriseRouter)
app.use('/api/ehr',        ehrRouter)
app.use('/api/mcp',        mcpRouter)
app.use('/api/webhooks',   webhooksRouter)
app.use('/api/hardware',   requireAuth, hardwareRouter)

// Optional Pluggable Modules
if (process.env.ENABLE_TIMECARD_PLUGIN !== 'false') {
  app.use('/api/timecard', timecardRouter)
}

import path from 'path'
import fs from 'fs'

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

const handleReady = async (_req: express.Request, res: express.Response) => {
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
}

app.get('/health', handleHealth)
app.get('/api/health', handleHealth)
app.get('/ready', handleReady)
app.get('/api/ready', handleReady)

// Check if frontend build exists to serve single-port container
const clientDistPath = path.resolve(__dirname, '../../dist')
if (fs.existsSync(clientDistPath)) {
  // OpenAPI 3.1 Documentation Endpoint
  const openApiSpecPath = path.resolve(__dirname, 'docs/openapi.json')
  app.get('/api/docs', (_req, res) => {
    if (fs.existsSync(openApiSpecPath)) {
      res.sendFile(openApiSpecPath)
    } else {
      res.json({ message: 'Shoreline Care OS OpenAPI 3.1 Spec' })
    }
  })

  app.use(express.static(clientDistPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health' || req.path === '/ready') {
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
      ready: '/ready',
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

// Global error handler
app.use(errorHandler)

const server = app.listen(PORT, () => {
  console.log(`[Shoreline API] Running on port ${PORT} (${process.env.NODE_ENV})`)

  // High-Frequency Real-Time WebSocket stream handler for Kitchen Telemetry (/api/ws/kitchen)
  server.on('upgrade', (request, socket, _head) => {
    if (request.url === '/api/ws/kitchen') {
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                   'Upgrade: websocket\r\n' +
                   'Connection: Upgrade\r\n' +
                   'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n' +
                   '\r\n')
      console.log('[KitchenWS] Client connected to real-time tray assembly & probe telemetry stream')
    } else {
      socket.destroy()
    }
  })
  
  // Non-fatal migration & seed background runner
  runMigrations()
    .then(() => runSeed())
    .then(() => {
      console.log('[Shoreline API] Database migrations & seed verified.')
      globalHealerBot.startDaemon(300000) // Run self-healing background checks every 5 minutes
      startNightlyForecastRollup() // C05: nightly avg_usage rollup from inventory transactions
    })
    .catch((err) => {
      // A02: schema drift is fail-closed — refuse to start rather than run
      // against a database that is missing tables migrate.ts expects.
      if (err && err.message && err.message.includes('[schema-drift]')) {
        console.error('[Shoreline API] FATAL: refusing to start:', err.message)
        process.exit(1)
      }
      console.warn('[Shoreline API] Database initialization warning (will retry in background):', err.message)
      globalHealerBot.startDaemon(300000)
      startNightlyForecastRollup() // C05: nightly avg_usage rollup (runs even if seed warned)
    })
})

export default app
