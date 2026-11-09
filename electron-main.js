const { app, BrowserWindow, dialog, shell } = require('electron')
const { launchBackend } = require('./desktop/backend.cjs')
let backend, mainWindow
let quitting = false
async function createWindow(keyNoticeFile) {
  mainWindow = new BrowserWindow({ width:1280, height:800, show:false, title:'Shoreline Care OS',
    webPreferences:{nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true} })
  mainWindow.webContents.setWindowOpenHandler(() => ({action:'deny'}))
  const enforceOrigin = (event,url) => {
    try { if (new URL(url).origin !== backend.origin) event.preventDefault() }
    catch { event.preventDefault() }
  }
  mainWindow.webContents.on('will-navigate', enforceOrigin)
  mainWindow.webContents.on('will-redirect', enforceOrigin)
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault())
  mainWindow.webContents.session.setPermissionRequestHandler((_contents,_permission,callback) => callback(false))
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
  await mainWindow.loadURL(`${backend.origin}/app/login`)
  if (keyNoticeFile) {
    const status = await fetch(`${backend.origin}/api/setup/status`).then(response => response.json())
    if (status.isInitialized === false) {
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'info', title: 'First-time facility setup',
        message: 'Your setup passphrase is ready.',
        detail: `Copy the passphrase from this local file into the setup wizard.\n\n${keyNoticeFile}`,
        buttons: ['Open passphrase file', 'Continue'], cancelId: 1,
      })
      if (choice.response === 0) await shell.openPath(keyNoticeFile)
    }
  }
}
function fail() {
  if (quitting) return
  dialog.showErrorBox('Shoreline startup failed', 'The local application could not start securely. Verify the production build, JWT_SECRET (at least 32 characters), and local database access. No demo account was created.')
  app.quit()
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.whenReady().then(async () => {
    const { ensureWorkstationSecrets } = require('./desktop/workstation-provision.cjs')
    const userData = app.getPath('userData')
    const provisioned = ensureWorkstationSecrets(process.env, userData)
    const root = app.isPackaged ? `${process.resourcesPath}/workstation` : __dirname
    backend = await launchBackend({root,userData,executable:process.execPath,env:provisioned.env})
    backend.child.once('exit', fail)
    await createWindow(process.env.SETUP_BOOTSTRAP_SECRET?.length >= 16 ? undefined : provisioned.keyNoticeFile)
  }).catch(fail)
  app.on('second-instance', () => { if(mainWindow) { mainWindow.restore(); mainWindow.focus() } })
  app.on('activate', () => { if(!mainWindow && backend) createWindow().catch(fail) })
  app.on('window-all-closed', () => { if(process.platform !== 'darwin') app.quit() })
  app.on('before-quit', () => { quitting = true; backend?.stop() })
}
