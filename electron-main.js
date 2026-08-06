const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow = null
let backendProcess = null

function startBackend() {
  console.log('[Electron] Launching Express API Backend using npm run dev in server directory...')
  
  // Spawn npm run dev (npm.cmd on Windows, npm on Unix)
  const isWindows = process.platform === 'win32'
  const npmCmd = isWindows ? 'npm.cmd' : 'npm'

  backendProcess = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(__dirname, 'server'),
    shell: true,
    env: {
      ...process.env,
      PORT: '4000',
      NODE_ENV: process.env.NODE_ENV || 'development',
      DATABASE_URL: process.env.DATABASE_URL || ''
    }
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend API] ${data.toString().trim()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend ERR] ${data.toString().trim()}`)
  })
}

// Poll until Vite dev server responds, then resolve
function waitForVite(url, retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      http.get(url, (res) => {
        console.log(`[Electron] Vite is ready (HTTP ${res.statusCode})`)
        resolve()
      }).on('error', () => {
        if (remaining <= 0) {
          reject(new Error('[Electron] Timed out waiting for Vite dev server'))
        } else {
          console.log(`[Electron] Waiting for Vite... (${retries - remaining + 1}/${retries})`)
          setTimeout(() => attempt(remaining - 1), delay)
        }
      })
    }
    attempt(retries)
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Shoreline Care Center',
    // Show window only once content is ready to prevent blank flash
    show: false,
  })

  // In dev mode, wait for Vite to be ready before loading
  const startUrl = process.env.NODE_ENV === 'production'
    ? `file://${path.join(__dirname, 'dist', 'index.html')}`
    : 'http://localhost:3000'

  if (process.env.NODE_ENV !== 'production') {
    try {
      await waitForVite(startUrl)
    } catch (err) {
      console.error(err.message)
    }
  }

  mainWindow.loadURL(startUrl)

  // Show window once page is loaded (no blank flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // DevTools in dev mode
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', () => {
  startBackend()
  createWindow()
})

app.on('window-all-closed', () => {
  console.log('[Electron] All windows closed, cleaning up child processes...')
  if (backendProcess) {
    backendProcess.kill()
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
