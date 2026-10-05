/** Browser workstation entry point; shares the compiled Electron backend. */
const path = require('node:path')
const os = require('node:os')
const { spawn } = require('node:child_process')
const { launchBackend } = require('./desktop/backend.cjs')
function openBrowser(url) {
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url]
  const child = spawn(command, args, { shell:false, windowsHide:true, stdio:'ignore' })
  child.once('error', () => console.error('[Launcher] Browser could not open. Use the displayed local URL.'))
}
async function launchWorkstation({env=process.env,root=__dirname,open=openBrowser}={}) {
  const port = Number(env.PORT || 4000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid local port')
  const userData = path.join(env.APPDATA || path.join(os.homedir(), '.local','share'), 'ShorelineOps','data')
  const backend = await launchBackend({root,userData,env,port})
  const url = `${backend.origin}/app/login`
  try { open(url) } catch(error) { backend.stop(); throw error }
  return {...backend,url}
}
if (require.main === module) {
  launchWorkstation().then(backend => {
    console.log(`[Launcher] Workstation ready: ${backend.url}. Press Ctrl+C to stop.`)
    const stop = () => { backend.stop(); process.exit(0) }
    process.once('SIGINT',stop)
    process.once('SIGTERM',stop)
    process.once('exit',()=>backend.stop())
    backend.child.once('exit',()=>process.exit(1))
  }).catch(() => {
    console.error('[Launcher] Startup failed. Verify compiled builds, provisioned JWT_SECRET, local port and per-user storage. No browser was opened.')
    process.exitCode=1
  })
}
module.exports = {launchWorkstation}
