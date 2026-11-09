const assert = require('node:assert/strict')
const { once } = require('node:events')
const fs = require('node:fs')
const net = require('node:net')
const os = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { spawnSync } = require('node:child_process')
const { launchBackend } = require('../desktop/backend.cjs')

async function verify() {
  const directory = process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked'
  const executable = process.platform === 'win32' ? 'ShorelineOps.exe' : 'shorelineops'
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-isolated-package-'))
  const unpacked = path.join(isolated, directory)
  const output = process.argv[2] || path.resolve(__dirname, '../release/desktop')
  fs.cpSync(path.join(output, directory), unpacked, { recursive: true })
  const root = path.join(unpacked, 'resources/workstation')
  assert.equal(fs.existsSync(path.join(root, 'dist/demo')), false)
  for (const name of ['typescript', 'tsx']) {
    assert.equal(fs.existsSync(path.join(root, 'server/node_modules', name)), false, `Build-only ${name} must be omitted`)
  }
  const listener = net.createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-package-test-'))
  let backend
  try {
    const entry = path.join(root, 'server/dist/index.js')
    const probe = spawnSync(path.join(unpacked, executable), ['-e',
      `const load = require('node:module').createRequire(${JSON.stringify(entry)}); for (const name of ['sqlite3', 'express', 'zod', 'pg']) load(name)`,
    ], { cwd: isolated, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 30000, windowsHide: true })
    assert.equal(probe.status, 0, probe.stderr || probe.error?.message || 'Bundled runtime dependency probe failed')
    backend = await launchBackend({
      root, userData, port, executable: path.join(unpacked, executable),
      env: { ...process.env, JWT_SECRET: randomBytes(32).toString('hex') },
    })
    const status = await fetch(`${backend.origin}/api/setup/status`)
    assert.equal(status.status, 200)
    assert.deepEqual(await status.json(), { isInitialized: false, sampleSeedAllowed: false })
    const app = await fetch(`${backend.origin}/app/login`)
    assert.equal(app.status, 200)
    const html = await app.text()
    const modulePath = html.match(/src="([^"]+\.js)"/)?.[1]
    assert.ok(modulePath, 'Production HTML must reference a JavaScript module')
    const moduleResponse = await fetch(new URL(modulePath, backend.origin), {
      headers: { Origin: backend.origin },
    })
    assert.equal(moduleResponse.status, 200)
    assert.match(moduleResponse.headers.get('content-type'), /javascript/)
    console.log('PASS packaged runtime, blank database, production app and module loading')
  } finally {
    if (backend && backend.child.exitCode === null && backend.child.signalCode === null) {
      const stopped = once(backend.child, 'exit')
      backend.stop()
      await stopped
    }
    fs.rmSync(userData, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    fs.rmSync(isolated, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

verify().catch(error => {
  console.error(error)
  process.exitCode = 1
})
