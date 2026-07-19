const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

let mainWindow = null
let backendProcess = null

function startBackend() {
  console.log('[Electron] Launching Express API Backend child process...')
  
  // Launch Express backend using node
  // Points to Shoreline-rebuild's Express server entry point.
  // In development it runs via server build or directly node.
  // In production it launches compiled js
  const backendPath = path.join(__dirname, 'server', 'src', 'index.ts')
  
  backendProcess = spawn('npx', ['ts-node', backendPath], {
    cwd: __dirname,
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

  // In dev mode, point to Vite dev server port
  const startUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'dist', 'index.html')}`

  mainWindow.loadURL(startUrl)

  // DevTools in dev mode
  if (process.env.NODE_ENV === 'development') {
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
