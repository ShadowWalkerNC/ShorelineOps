/**
 * Shoreline Care OS — Unified Desktop & Service Launcher
 *
 * Spawns the offline Express API + SQLite database backend and opens
 * the workstation app window in the local browser or Electron wrapper.
 */

const path = require('path')
const http = require('http')
const { spawn, exec } = require('child_process')
const fs = require('fs')

const PORT = process.env.PORT || '3001'
const ROOT_DIR = path.resolve(__dirname)
const SERVER_SCRIPT = path.join(ROOT_DIR, 'server', 'dist', 'index.js')
const APP_URL = `http://localhost:${PORT}`

console.log('======================================================================')
console.log('🌟 SHORELINE CARE OS — LAUNCHER')
console.log('======================================================================\n')

// 1. Ensure Data Directory
const appDataRoot = process.env.APPDATA || path.join(process.env.HOME || '.', '.shoreline')
const appDataDir = path.join(appDataRoot, 'ShorelineOps', 'data')
if (!fs.existsSync(appDataDir)) {
  fs.mkdirSync(appDataDir, { recursive: true })
}

// 2. Check if Server Build Exists
if (!fs.existsSync(SERVER_SCRIPT)) {
  console.log('[Launcher] Server build not found. Running build...')
  try {
    const { execSync } = require('child_process')
    execSync('npm run build:all', { cwd: ROOT_DIR, stdio: 'inherit' })
  } catch (err) {
    console.error('[Launcher] Build failed:', err.message)
    process.exit(1)
  }
}

// 3. Start Backend Process
console.log(`[Launcher] Starting Shoreline Care OS Server on port ${PORT}...`)

const serverProcess = spawn('node', [SERVER_SCRIPT], {
  cwd: ROOT_DIR,
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    DATABASE_URL: `file:${path.join(appDataDir, 'shoreline.db')}`,
    FRONTEND_URL: APP_URL,
  },
  stdio: 'inherit',
})

serverProcess.on('error', (err) => {
  console.error('[Launcher] Failed to start backend process:', err)
  process.exit(1)
})

serverProcess.on('exit', (code) => {
  console.log(`[Launcher] Server process exited with code ${code}`)
  process.exit(code || 0)
})

// 4. Poll Server Health and Open Window
function waitForServer(url, maxAttempts = 40, delay = 300) {
  let attempts = 0
  const check = () => {
    attempts++
    http.get(`${url}/health`, (res) => {
      if (res.statusCode === 200) {
        console.log(`[Launcher] Server is ready at ${url}`)
        openAppWindow(url)
      } else {
        retry()
      }
    }).on('error', () => {
      retry()
    })
  }

  const retry = () => {
    if (attempts >= maxAttempts) {
      console.warn('[Launcher] Server health check timed out. Attempting to open browser anyway...')
      openAppWindow(url)
    } else {
      setTimeout(check, delay)
    }
  }

  check()
}

function openAppWindow(url) {
  console.log(`[Launcher] Opening Shoreline Care OS Workstation: ${url}`)
  const isWindows = process.platform === 'win32'
  const isMac = process.platform === 'darwin'

  if (isWindows) {
    // Try opening in app window mode with Edge or Chrome, fallback to default browser
    exec(`start msedge --app=${url}`, (err) => {
      if (err) {
        exec(`start chrome --app=${url}`, (err2) => {
          if (err2) {
            exec(`start ${url}`)
          }
        })
      }
    })
  } else if (isMac) {
    exec(`open "${url}"`)
  } else {
    exec(`xdg-open "${url}"`)
  }

  console.log('\n[Launcher] Shoreline Care OS is running. Press Ctrl+C in this window to stop.')
}

waitForServer(APP_URL)

// 5. Clean Exit Handlers
process.on('SIGINT', () => {
  console.log('\n[Launcher] Shutting down Shoreline Care OS server...')
  if (serverProcess) serverProcess.kill()
  process.exit(0)
})

process.on('SIGTERM', () => {
  if (serverProcess) serverProcess.kill()
  process.exit(0)
})
