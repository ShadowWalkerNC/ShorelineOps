const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

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
      PORT: '4000', // Port matches the frontend proxy target
      NODE_ENV: process.env.NODE_ENV || 'development',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/shoreline'
    }
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend API] ${data.toString().trim()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend ERR] ${data.toString().trim()}`)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Shoreline Care Center',
    icon: path.join(__dirname, 'public', 'icon-192.png')
  })

  // In dev mode, point to Vite dev server port. Default to development unless production explicitly specified.
  const startUrl = process.env.NODE_ENV === 'production'
    ? `file://${path.join(__dirname, 'dist', 'index.html')}`
    : 'http://localhost:3000'

  mainWindow.loadURL(startUrl)

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
    // Gracefully terminate the backend process
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
