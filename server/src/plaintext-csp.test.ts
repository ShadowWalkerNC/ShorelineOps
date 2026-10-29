import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { stripUpgradeInsecureRequests } from './middleware/plaintextCsp'

const CSP = `default-src 'self';script-src 'self';upgrade-insecure-requests;base-uri 'self'`

void test('plaintext CSP handling keeps HTTPS strict and HTTP loadable', async t => {
  const build = (trustProxy: boolean) => {
    const app = express()
    if (trustProxy) app.set('trust proxy', 1)
    app.use(stripUpgradeInsecureRequests)
    app.get('/csp', (_req, res) => {
      res.setHeader('content-security-policy', CSP)
      res.send('ok')
    })
    return app
  }
  const serve = async (app: express.Express) => {
    const server = app.listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', resolve))
    return { server, base: `http://127.0.0.1:${(server.address() as { port: number }).port}` }
  }

  await t.test('http strips upgrade-insecure-requests but keeps the rest', async () => {
    const { server, base } = await serve(build(false))
    try {
      const res = await fetch(`${base}/csp`)
      assert.equal(res.status, 200)
      const csp = res.headers.get('content-security-policy') ?? ''
      assert.ok(!csp.includes('upgrade-insecure-requests'))
      assert.ok(csp.includes(`script-src 'self'`))
      assert.ok(csp.includes(`base-uri 'self'`))
    } finally {
      server.close()
    }
  })

  await t.test('https (forwarded) keeps upgrade-insecure-requests', async () => {
    const { server, base } = await serve(build(true))
    try {
      const res = await fetch(`${base}/csp`, { headers: { 'X-Forwarded-Proto': 'https' } })
      assert.equal(res.status, 200)
      const csp = res.headers.get('content-security-policy') ?? ''
      assert.ok(csp.includes('upgrade-insecure-requests'))
    } finally {
      server.close()
    }
  })
})
