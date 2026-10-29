import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { sameOriginCors } from './middleware/sameOriginCors'

void test('same-origin CORS bypass keeps strict allowlist for the rest', async t => {
  const app = express()
  app.use(
    '/api',
    sameOriginCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (origin === 'https://app.example.com') return callback(null, true)
        callback(new Error(`CORS: origin ${origin} not allowed`))
      },
      credentials: true,
    })
  )
  app.get('/api/ping', (_req, res) => res.json({ ok: true }))
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message })
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    await t.test('same-origin Origin header passes without allowlisting', async () => {
      const res = await fetch(`${base}/api/ping`, { headers: { Origin: base } })
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('access-control-allow-origin'), base)
      assert.equal(res.headers.get('access-control-allow-credentials'), 'true')
    })

    await t.test('missing Origin still passes', async () => {
      const res = await fetch(`${base}/api/ping`)
      assert.equal(res.status, 200)
    })

    await t.test('foreign Origin is still rejected', async () => {
      const res = await fetch(`${base}/api/ping`, { headers: { Origin: 'https://evil.example.com' } })
      assert.equal(res.status, 500)
    })

    await t.test('listed Origin still passes', async () => {
      const res = await fetch(`${base}/api/ping`, { headers: { Origin: 'https://app.example.com' } })
      assert.equal(res.status, 200)
    })
  } finally {
    server.close()
  }
})
