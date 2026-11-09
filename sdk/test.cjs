const assert = require('node:assert/strict')
const http = require('node:http')
const { once } = require('node:events')
const { test } = require('node:test')
const { ShorelineClient } = require('./dist')

test('SDK CommonJS and ESM consumers use the same client', async () => {
  const imported = await import('./dist/index.js')
  assert.equal(imported.ShorelineClient, ShorelineClient)
})

test('SDK sends the access JWT, reads response envelopes and preserves API errors', async () => {
  let requestedPath
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json')
    if (request.headers.authorization !== 'Bearer isolated-test-token') {
      response.writeHead(401)
      return response.end(JSON.stringify({ error: 'Unauthorized' }))
    }
    if (request.url.includes('/events')) {
      response.writeHead(409)
      return response.end(JSON.stringify({ error: 'Fixture clinical hold', status: 'HOLD_TRAY_RD_SIGNOFF' }))
    }
    requestedPath = request.url
    response.end(JSON.stringify({ residents: [] }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/`
    const client = new ShorelineClient({ baseUrl, apiKey: 'isolated-test-token' })
    assert.deepEqual(await client.getResidents(), [])
    assert.equal(requestedPath, '/api/residents')
    await assert.rejects(new ShorelineClient({ baseUrl }).getResidents(), {
      message: 'Unauthorized', status: 401,
    })
    await assert.rejects(client.recordTrayEvent('fixture', { event: 'assembled', rawQrPayload: 'fixture' }),
      error => error.status === 409 && error.apiError.status === 'HOLD_TRAY_RD_SIGNOFF')
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('SDK census uses real resident fields and unsupported historical operations send no request', async () => {
  let requests = 0
  const server = http.createServer((_request, response) => {
    requests++
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify([
      { id: 'fixture-active', status: 'Active', isNpo: true },
      { id: 'fixture-away', status: 'Hospital', isNpo: true },
    ]))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const client = new ShorelineClient({ baseUrl: `http://127.0.0.1:${server.address().port}` })
    const census = await client.getCensus()
    assert.equal(census.source, 'resident-list')
    assert.equal(census.residentCount, 2)
    assert.equal(census.activeCount, 1)
    assert.equal(census.npoCount, 1)
    assert.equal(census.facilityId, undefined)
    for (const operation of [() => client.validateRecipe('fixture'), () => client.getMrpSplitPo('fixture', 1),
      () => client.getCmsSurveyBinder(), () => client.getCostPerResidentDay()]) {
      await assert.rejects(operation(), error => error.status === 501 && error.apiError.error === 'SDK_OPERATION_UNAVAILABLE')
    }
    assert.equal(requests, 1)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
