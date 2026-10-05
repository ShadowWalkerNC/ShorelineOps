const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const {launchBackend,checkReady} = require('./backend.cjs')
const root = path.resolve(__dirname,'..')

test('browser workstation opens staff login with isolated per-user storage', async () => {
  const {launchWorkstation} = require('../launcher.js')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'shoreline-browser-launcher-'))
  const listener = net.createServer()
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve))
  const port = listener.address().port
  await new Promise(resolve=>listener.close(resolve))
  let opened, runtime
  try {
    runtime = await launchWorkstation({root,env:{...process.env,APPDATA:directory,PORT:String(port),
      JWT_SECRET:'synthetic-browser-launcher-key-'.repeat(3),DATABASE_URL:'postgres://unusable.invalid/never'},open:url=>{opened=url}})
    assert.equal(opened,`${runtime.origin}/app/login`)
    assert.equal((await fetch(opened)).status,200)
    assert.ok(fs.existsSync(path.join(directory,'ShorelineOps','data','shoreline.db')))
  } finally {
    if(runtime) {const exited=new Promise(resolve=>runtime.child.once('exit',resolve));runtime.stop();await exited}
  }
  await assert.rejects(launchWorkstation({root,env:{PORT:'4000 & echo unsafe'},open:()=>{throw new Error('must not open')}}),/Invalid local port/)
  await assert.rejects(launchWorkstation({root,env:{APPDATA:directory},open:()=>{throw new Error('must not open')}}),/JWT_SECRET/)
})
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
    const html = await response.text()
    assert.match(html,/app\/assets/)
    const scripts = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(match=>match[1])
    assert.ok(scripts.length >= 2)
    for (const asset of scripts) {
      const loaded = await fetch(runtime.origin+asset,{headers:{Origin:runtime.origin}})
      assert.equal(loaded.status,200,`same-origin browser asset must load: ${asset}`)
      assert.equal(loaded.headers.get('access-control-allow-origin'),runtime.origin)
      assert.match(loaded.headers.get('content-type'),asset.endsWith('.css') ? /text\/css/ : /javascript/)
    }
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
