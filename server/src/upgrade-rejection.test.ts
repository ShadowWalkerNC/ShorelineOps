import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import crypto from 'node:crypto'

test('actual API rejects unsupported kitchen and unknown websocket upgrades', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'shoreline-upgrade-'))
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = ''
  process.env.SQLITE_PATH = path.join(directory, 'synthetic.sqlite')
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
  process.env.PORT = '0'
  process.env.SHORELINE_DEMO_SEED = 'false'
  const { startServer } = await import('./index')
  const { pool } = await import('./db/pool')
  const server = await startServer()
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  try {
    for (const route of ['/api/ws/kitchen', '/api/ws/unknown']) {
      const response = await new Promise<string>((resolve, reject) => {
        const socket = net.connect(address.port, '127.0.0.1')
        let data = ''
        socket.setTimeout(3000, () => socket.destroy(new Error('upgrade did not close')))
        socket.on('error', reject)
        socket.on('data', chunk => { data += chunk.toString() })
        socket.on('end', () => resolve(data))
        socket.on('connect', () => socket.write(
          `GET ${route} HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`
        ))
      })
      assert.match(response, /^HTTP\/1\.1 404 Not Found/)
      assert.doesNotMatch(response, /101 Switching|Sec-WebSocket-Accept/)
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await pool.end()
    rmSync(directory, { recursive: true, force: true })
  }
})
