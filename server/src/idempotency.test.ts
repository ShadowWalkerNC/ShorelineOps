import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { IdempotencyStore, idempotencyMiddleware } from './middleware/idempotency'

test('IdempotencyStore correctly stores, retrieves, and expires entries', () => {
  const store = new IdempotencyStore(100) // 100ms TTL

  assert.equal(store.get('test-key'), null)

  store.set('test-key', {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: { status: 'ok', orderId: 'PO-1001' },
  })

  const cached = store.get('test-key')
  assert.ok(cached)
  assert.equal(cached.statusCode, 200)
  assert.equal(cached.body.orderId, 'PO-1001')

  // Concurrency tracking
  assert.equal(store.isProcessing('req-2'), false)
  store.start('req-2')
  assert.equal(store.isProcessing('req-2'), true)
  store.finish('req-2')
  assert.equal(store.isProcessing('req-2'), false)
})

test('idempotencyMiddleware replays cached responses on duplicate POST requests', async () => {
  const store = new IdempotencyStore(60000)
  const app = express()
  app.use(express.json())
  app.use(idempotencyMiddleware(store))

  let executionCount = 0

  app.post('/test-order', (req, res) => {
    executionCount++
    res.status(201).json({
      orderId: 'PO-' + executionCount,
      total: req.body.total,
    })
  })

  const server = http.createServer(app)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const port = (server.address() as any).port

  try {
    // 1. First execution
    const res1 = await fetch(`http://127.0.0.1:${port}/test-order`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'key-abc-123',
      },
      body: JSON.stringify({ total: 450.50 }),
    })

    assert.equal(res1.status, 201)
    const data1 = await res1.json() as any
    assert.equal(data1.orderId, 'PO-1')
    assert.equal(data1.total, 450.50)
    assert.equal(executionCount, 1)

    // 2. Duplicate retry with same idempotency-key
    const res2 = await fetch(`http://127.0.0.1:${port}/test-order`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'key-abc-123',
      },
      body: JSON.stringify({ total: 450.50 }),
    })

    assert.equal(res2.status, 201)
    assert.equal(res2.headers.get('x-idempotency-replay'), 'true')
    const data2 = await res2.json() as any
    assert.equal(data2.orderId, 'PO-1') // Replayed, not PO-2!
    assert.equal(executionCount, 1) // Handler was NOT executed again

    // 3. Different idempotency-key
    const res3 = await fetch(`http://127.0.0.1:${port}/test-order`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'key-xyz-789',
      },
      body: JSON.stringify({ total: 100.00 }),
    })

    assert.equal(res3.status, 201)
    const data3 = await res3.json() as any
    assert.equal(data3.orderId, 'PO-2')
    assert.equal(executionCount, 2)
  } finally {
    server.close()
  }
})
