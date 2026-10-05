const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const http = require('node:http')
const {spawn} = require('node:child_process')
function reserveCheck(port) {
  return new Promise((resolve,reject) => {
    const server = net.createServer()
    server.once('error',reject)
    server.listen(port,'127.0.0.1', () => server.close(resolve))
  })
}
function checkReady(origin) {
  return new Promise(resolve => {
    const request = http.get(`${origin}/ready`, response => {
      let body = ''
      response.on('data', chunk => { body += chunk; if(body.length > 4096) request.destroy() })
      response.on('end', () => {
        try { resolve(response.statusCode === 200 && JSON.parse(body).status === 'ready') }
        catch { resolve(false) }
      })
    })
    request.setTimeout(1000, () => request.destroy())
    request.on('error', () => resolve(false))
  })
}
async function launchBackend({root,userData,executable=process.execPath,env=process.env,port=4000,timeout=30000}) {
  if(!env.JWT_SECRET || env.JWT_SECRET.length < 32) throw new Error('A provisioned JWT_SECRET is required')
  const entry = path.join(root,'server','dist','index.js')
  for(const artifact of [entry,path.join(root,'dist','app','index.html')]) {
    if(!fs.existsSync(artifact)) throw new Error('Production build missing')
  }
  await reserveCheck(port)
  fs.mkdirSync(userData,{recursive:true,mode:0o700})
  const child = spawn(executable,[entry],{cwd:userData,windowsHide:true,shell:false,stdio:'ignore',
    env:{...env,ELECTRON_RUN_AS_NODE:'1',NODE_ENV:'production',HOST:'127.0.0.1',PORT:String(port),
      FRONTEND_URL:`http://127.0.0.1:${port}`,DATABASE_URL:'',SQLITE_PATH:path.join(userData,'shoreline.db'),SHORELINE_DEMO_SEED:'false',VITE_DEMO_MODE:'false'}})
  let failed = false
  child.once('error', () => {failed=true})
  child.once('exit', () => {failed=true})
  const origin = `http://127.0.0.1:${port}`
  const deadline = Date.now()+timeout
  while(Date.now()<deadline && !failed) {
    if(await checkReady(origin) && !failed) return {origin,child,stop:() => child.kill()}
    await new Promise(resolve => setTimeout(resolve,150))
  }
  child.kill()
  throw new Error('Local backend unavailable')
}
module.exports = {launchBackend,checkReady}
