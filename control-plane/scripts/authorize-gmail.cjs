// Operator-run Windows helper. Tokens never reach stdout or the repository.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const { spawn, spawnSync } = require('node:child_process')

async function authorize() {
  if (process.argv.includes('--help') || !process.argv[2]) {
    console.log('Usage: node control-plane/scripts/authorize-gmail.cjs <outside-repository-client.json> <sender-email>')
    console.log('Requires a Google Desktop OAuth client. Saves a Windows-user-encrypted credential bundle outside the repository. Does not send email.')
    return
  }
  if (process.platform !== 'win32') throw new Error('This helper uses Windows user encryption. Run it on Windows.')
  const clientPath = fs.realpathSync(path.resolve(process.argv[2]))
  const root = fs.realpathSync(path.resolve(__dirname, '../..'))
  const relative = path.relative(root, clientPath)
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw new Error('Keep the downloaded OAuth client outside the repository.')
  const sender = process.argv[3] || ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) throw new Error('Supply the selected sender mailbox address.')
  const client = JSON.parse(fs.readFileSync(clientPath, 'utf8')).installed
  if (!client?.client_id || !client?.client_secret) throw new Error('Download a Desktop app OAuth client JSON.')
  const output = path.join(process.env.LOCALAPPDATA, 'ShorelineOps-control', 'gmail-oauth.xml')
  if (fs.existsSync(output)) throw new Error('An encrypted Gmail bundle already exists. Preserve or rotate it explicitly before authorizing again.')
  const state = crypto.randomBytes(32).toString('base64url')
  const verifier = crypto.randomBytes(48).toString('base64url')
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
  let settle
  const callback = new Promise((resolve, reject) => { settle = { resolve, reject } })
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const url = new URL(req.url, 'http://127.0.0.1')
    if (url.pathname !== '/callback' || url.searchParams.get('state') !== state) {
      res.writeHead(400).end('Invalid authorization callback.')
      return
    }
    const code = url.searchParams.get('code')
    if (!code || url.searchParams.has('error')) {
      res.writeHead(400).end('Authorization was not granted. Close this tab.')
      settle.reject(new Error('Google authorization was not granted.'))
      return
    }
    res.end('Authorization received. Return to your terminal. You can close this tab.')
    settle.resolve(code)
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const redirect = `http://127.0.0.1:${server.address().port}/callback`
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: redirect,
    response_type: 'code', scope: 'https://www.googleapis.com/auth/gmail.send',
    access_type: 'offline', prompt: 'consent', state, code_challenge: challenge,
    code_challenge_method: 'S256', login_hint: sender }).toString()
  const timeout = setTimeout(() => settle.reject(new Error('Authorization timed out. Run the helper again.')), 10 * 60 * 1000)
  try {
    console.log('Approve Gmail send access in the system browser. This helper does not send a message.')
    if (process.argv.includes('--no-browser')) {
      console.log(`Open in your signed-in browser: ${url.href}`)
    } else {
    const browser = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process $env:SHORELINE_OAUTH_URL'],
      { env: { ...process.env, SHORELINE_OAUTH_URL: url.href }, windowsHide: true, stdio: 'ignore' })
    browser.on('error', () => settle.reject(new Error('Could not open the system browser.')))
    }
    const code = await callback
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({ client_id: client.client_id, client_secret: client.client_secret,
        code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }) })
    if (!response.ok) throw new Error('Google token exchange failed. No credential bundle was saved.')
    const tokens = await response.json()
    if (!tokens.refresh_token || !String(tokens.scope || '').split(' ').includes('https://www.googleapis.com/auth/gmail.send')) {
      throw new Error('Google did not grant offline Gmail send access. No credential bundle was saved.')
    }
    fs.mkdirSync(path.dirname(output), { recursive: true })
    const saved = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference="Stop"; $bundle=[Console]::In.ReadToEnd(); ConvertTo-SecureString -String $bundle -AsPlainText -Force | Export-Clixml -LiteralPath $env:SHORELINE_OAUTH_OUTPUT -NoClobber'],
      { env: { ...process.env, SHORELINE_OAUTH_OUTPUT: output,
          PSModulePath: path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/Modules') }, windowsHide: true, encoding: 'utf8',
        input: JSON.stringify({ GMAIL_CLIENT_ID: client.client_id, GMAIL_CLIENT_SECRET: client.client_secret,
          GMAIL_REFRESH_TOKEN: tokens.refresh_token, GMAIL_SENDER: sender }), stdio: ['pipe', 'pipe', 'pipe'] })
    if (saved.error || saved.status !== 0) throw new Error('Could not encrypt the credential bundle for this Windows user.')
    console.log(`Saved Windows-user-encrypted Gmail configuration to ${output}`)
    console.log('OAuth authorization is complete. Live mail delivery and hosting configuration still need verification.')
  } finally {
    clearTimeout(timeout)
    server.closeAllConnections()
    server.close()
  }
}

authorize().catch(error => {
  console.error('Gmail authorization failed. No secrets are printed.')
  // Only these helper-owned diagnostics are safe to show. Never echo provider bodies.
  const message = error instanceof Error ? error.message : ''
  if (/^(Google |Could not |Authorization |An encrypted |Keep the |Download a |Supply the |This helper )/.test(message)) console.error(message)
  process.exitCode = 1
})
