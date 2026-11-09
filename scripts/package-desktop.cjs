const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { build, Platform, Arch } = require('electron-builder')

const root = path.resolve(__dirname, '..')

async function packageDesktop() {
  const buildId = process.env.SHORELINE_DESKTOP_BUILD_ID || ''
  if (!/^[a-zA-Z0-9_-]*$/.test(buildId)) throw new Error('Invalid desktop build identifier')
  if (process.arch !== 'x64' || !['win32', 'linux'].includes(process.platform)) {
    throw new Error('Build the desktop installer on a native Windows or Linux x64 host')
  }
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-desktop-'))
  try {
    // Package a minimal shell, so Electron Builder never traverses the web app's
    // dependency graph or copies development metadata into the executable.
    const shell = path.join(stage, 'shell')
    fs.mkdirSync(path.join(shell, 'desktop'), { recursive: true })
    const metadata = require(path.join(root, 'package.json'))
    fs.writeFileSync(path.join(shell, 'package.json'), JSON.stringify({
      name: metadata.name, version: metadata.version, description: metadata.description,
      author: metadata.author, homepage: metadata.homepage, main: 'electron-main.js',
    }))
    for (const file of ['electron-main.js', 'desktop/backend.cjs', 'desktop/workstation-provision.cjs']) {
      fs.copyFileSync(path.join(root, file), path.join(shell, file))
    }
    for (const file of ['server/package.json', 'server/package-lock.json']) {
      const destination = path.join(stage, file)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.copyFileSync(path.join(root, file), destination)
    }
    execFileSync(process.execPath, [process.env.npm_execpath, 'ci', '--omit=dev', '--workspaces=false'], {
      cwd: path.join(stage, 'server'),
      stdio: 'inherit',
    })
    for (const directory of ['server/dist', 'server/vendor', 'dist/app']) {
      fs.cpSync(path.join(root, directory), path.join(stage, directory), { recursive: true })
    }
    const platform = process.platform === 'win32' ? Platform.WINDOWS : Platform.LINUX
    await build({
      projectDir: shell,
      targets: platform.createTarget(undefined, Arch.x64),
      config: {
        appId: 'com.shorelineops.desktop',
        productName: 'ShorelineOps',
        electronVersion: require(path.join(root, 'node_modules/electron/package.json')).version,
        icon: path.join(root, 'public/icon-512.png'),
        directories: { app: shell, output: path.join(root, 'release/desktop', buildId) },
        files: ['**/*'],
        extraResources: [
          { from: path.join(stage, 'server/dist'), to: 'workstation/server/dist', filter: ['**/*', '!**/*.test.js', '!**/*.map'] },
          { from: path.join(stage, 'server/vendor'), to: 'workstation/server/vendor' },
          { from: path.join(stage, 'dist/app'), to: 'workstation/dist/app' },
          { from: path.join(stage, 'server/node_modules'), to: 'workstation/server/node_modules' },
        ],
        npmRebuild: false,
        win: { target: 'nsis' },
        nsis: { runAfterFinish: false, deleteAppDataOnUninstall: false },
        linux: {
          target: ['AppImage', 'deb'], category: 'Office', executableName: 'shorelineops',
          maintainer: 'ShorelineOps <support@shorelineops.com>',
        },
      },
    })
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }
}

packageDesktop().catch(error => {
  console.error(error)
  process.exitCode = 1
})
