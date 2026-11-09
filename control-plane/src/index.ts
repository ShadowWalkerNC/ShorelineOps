import express from 'express'
import helmet from 'helmet'
import { once } from 'node:events'
import path from 'path'
import type { Pool } from 'pg'
import { getPool, closePool } from './db/pool'
import { migrate } from './db/migrate'
import { dispatchDue } from './email/outbox'
import { config, decodeOutboxKey } from './config'
import { csrfGuard } from './security/middleware'
import { signupRouter } from './routes/signup'
import { accountAuthRouter } from './routes/accountAuth'
import { portalRouter } from './routes/portal'

export function createApp(pool: Pool): express.Express {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(express.json({ limit: '32kb' }))
  app.use(csrfGuard)
  app.locals.pool = pool

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'shoreline-control-plane' }))
  app.get('/ready', async (_req, res) => {
    try {
      await pool.query('SELECT 1 FROM accounts LIMIT 1')
      await pool.query('SELECT claim_token FROM email_outbox LIMIT 1')
      await pool.query('SELECT app_origin FROM facility_deployments LIMIT 1')
      res.json({ ready: true })
    } catch {
      res.status(503).json({ ready: false })
    }
  })

  app.use('/api/accounts', signupRouter)
  app.use('/api/accounts', accountAuthRouter)
  app.use('/api/portal', portalRouter)
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }))
  app.use('/api', (_req, res) => res.status(404).json({ error: 'NOT_FOUND' }))
  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (error as Error & { status?: number }).status
    res.status(status && status >= 400 && status < 500 ? status : 503).json({ error: 'REQUEST_UNAVAILABLE' })
  })
  return app
}

export async function startServer() {
  config.publicOrigin
  if (config.isProd && !decodeOutboxKey()) throw new Error('CONTROL_OUTBOX_ENC_KEY is required')
  const pool = getPool()
  await migrate(pool)
  const app = createApp(pool)
  const server = app.listen(config.port)
  await once(server, 'listening')
  console.log(`control-plane listening on ${config.port}`)
  let dispatching: Promise<unknown> | undefined
  const tick = () => {
    if (!dispatching) dispatching = dispatchDue(pool).catch(() => console.error('Account email dispatch failed')).finally(() => { dispatching = undefined })
  }
  const timer = setInterval(tick, 15000)
  timer.unref()
  tick()
  let stopping: Promise<void> | undefined
  const stop = () => stopping ??= (async () => {
    clearInterval(timer)
    await new Promise<void>(resolve => server.close(() => resolve()))
    await dispatching
    await closePool()
  })()
  process.once('SIGTERM', () => { void stop().catch(() => { process.exitCode = 1 }) })
  process.once('SIGINT', () => { void stop().catch(() => { process.exitCode = 1 }) })
  return server
}

if (require.main === module) {
  startServer().catch(() => {
    console.error('Control-plane startup failed. Verify database, public origin and encryption configuration.')
    process.exitCode = 1
    void closePool()
  })
}
