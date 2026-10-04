const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const {launchBackend,checkReady} = require('./backend.cjs')
const root = path.resolve(__dirname,'..')
test('desktop rejects missing signing secret before creating data', async () => {
  await assert.rejects(launchBackend({root,userData:'unused',env:{}}),/JWT_SECRET/)
})
test('compiled desktop backend serves app, isolated blank SQLite, and shuts down', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(),'shoreline-desktop-'))
  const listener = net.createServer()
  await new Promise(resolve => listener.listen(0,'127.0.0.1',resolve))
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  let runtime
  try {
    runtime = await launchBackend({root,userData,port,executable:process.env.DESKTOP_TEST_EXECUTABLE || process.execPath,env:{...process.env,JWT_SECRET:'synthetic-desktop-test-key-'.repeat(3)}})
    assert.equal(await checkReady(runtime.origin),true)
    const response = await fetch(`${runtime.origin}/app/login`)
    assert.equal(response.status,200)
    assert.match(await response.text(),/app\/assets/)
    assert.equal(fs.existsSync(path.join(userData,'shoreline.db')),true)
    const sqlite3 = require('sqlite3')
    const db = new sqlite3.Database(path.join(userData,'shoreline.db'))
    const row = await new Promise((resolve,reject) => db.get('SELECT COUNT(*) AS count FROM users',(error,row) => error ? reject(error) : resolve(row)))
    assert.equal(row.count,0,'must not seed demo accounts')
    await new Promise(resolve => db.close(resolve))
    const exited = new Promise(resolve => runtime.child.once('exit',resolve))
    runtime.stop()
    await exited
    assert.equal(await checkReady(runtime.origin),false)
  } finally {
    runtime?.stop()
    fs.rmSync(userData,{recursive:true,force:true,maxRetries:10,retryDelay:100})
  }
})
test('occupied local port fails instead of trusting another service', async () => {
  const listener = net.createServer()
  await new Promise(resolve => listener.listen(0,'127.0.0.1',resolve))
  try {
    await assert.rejects(launchBackend({root,userData:'unused',port:listener.address().port,env:{JWT_SECRET:'test'.repeat(10)}}),/EADDRINUSE/)
  } finally {await new Promise(resolve => listener.close(resolve))}
})
