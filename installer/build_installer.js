/**
 * Shoreline Care OS — One-Time Installer Package Builder
 *
 * Packages the production web frontend, API backend, SQLite database migrations,
 * and Windows desktop launcher into a self-contained distribution package.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const DIST_INSTALLER_DIR = path.join(ROOT_DIR, 'dist-installer')
const PACKAGE_NAME = 'ShorelineOps-v5.0.0-Windows-Setup'
const TARGET_DIR = path.join(DIST_INSTALLER_DIR, PACKAGE_NAME)

console.log('======================================================================')
console.log('📦 SHORELINE CARE OS — BUILDING ONE-TIME INSTALLER PACKAGE')
console.log('======================================================================\n')

// Step 1: Ensure builds are fresh
console.log('1. Compiling Frontend & API Backend...')
try {
  execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' })
  execSync('npm --prefix server run build', { cwd: ROOT_DIR, stdio: 'inherit' })
  console.log('   ✅ Builds compiled successfully.\n')
} catch (err) {
  console.error('   ❌ Build failed:', err.message)
  process.exit(1)
}

// Step 2: Prepare Target Directory
console.log(`2. Preparing distribution directory: ${TARGET_DIR}`)
if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true })
}
fs.mkdirSync(TARGET_DIR, { recursive: true })

// Helper: copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  const entries = fs.readdirSync(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        copyDir(srcPath, destPath)
      }
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// Step 3: Copy Distribution Assets
console.log('3. Copying bundled frontend, server, database schemas, and scripts...')

// Copy compiled frontend dist/
copyDir(path.join(ROOT_DIR, 'dist'), path.join(TARGET_DIR, 'dist'))

// Copy compiled server dist/ & migrations
copyDir(path.join(ROOT_DIR, 'server', 'dist'), path.join(TARGET_DIR, 'server', 'dist'))
copyDir(path.join(ROOT_DIR, 'server', 'src', 'db'), path.join(TARGET_DIR, 'server', 'src', 'db'))
copyDir(path.join(ROOT_DIR, 'desktop'), path.join(TARGET_DIR, 'desktop'))

// Copy root launcher scripts and config
const filesToCopy = [
  'Setup.bat',
  'Setup.ps1',
  'ShorelineOps-Launcher.bat',
  'ShorelineOps-Launcher.vbs',
  'launcher.js',
  'package.json',
  'package-lock.json',
  'electron-main.js',
]

for (const file of filesToCopy) {
  const src = path.join(ROOT_DIR, file)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(TARGET_DIR, file))
  }
}

// Copy server package.json
if (fs.existsSync(path.join(ROOT_DIR, 'server', 'package.json'))) {
  fs.mkdirSync(path.join(TARGET_DIR, 'server'), { recursive: true })
  fs.copyFileSync(path.join(ROOT_DIR, 'server', 'package.json'), path.join(TARGET_DIR, 'server', 'package.json'))
}

// npm resolves the root workspace declarations even for a runtime-only install.
fs.mkdirSync(path.join(TARGET_DIR, 'marketing'), { recursive: true })
fs.copyFileSync(path.join(ROOT_DIR, 'marketing', 'package.json'), path.join(TARGET_DIR, 'marketing', 'package.json'))

// Create dedicated INSTALL_GUIDE.md inside the bundle
const installGuide = `# Shoreline Care OS — One-Time Standalone Installation Guide

This is a Node/web distribution candidate for a single-facility workstation. It is not a signed Electron installer. Installation downloads runtime dependencies and requires a supported Node.js runtime and administrator acceptance before clinical use.

---

## ⚡ Quick 1-Click Setup

1. **Double-click \`Setup.bat\`**
   - The setup wizard will verify your local environment.
   - Complete the authorized facility/account setup before entering real records. Production demo account seeding is disabled.
   - It will place a **"Shoreline Care OS"** desktop shortcut directly onto your Windows desktop and Start Menu.

2. **Launch Shoreline Care OS**
   - Double-click the new **Shoreline Care OS** desktop icon.
   - With compiled builds and provisioned signing/setup secrets, the app starts its loopback backend and opens /app/login only after readiness. Existing server/shoreline.db files are not automatically migrated; verify backup and approved migration before using an upgraded installation.

---

## 🛡️ Key Features

- **Local operations**: SQLite stores local records; provider integrations require their configured networks and services. Offline workflow and recovery acceptance remain required.
- **Network access**: Use the loopback workstation by default. LAN deployments require an explicitly reviewed TLS, authentication, firewall, and backup configuration before tablets access sensitive records.
- **Zero Ongoing Cloud Lock-in**: Full open-core ownership for single-facility nursing and assisted living homes.

---

## 📞 Support & Inquiries
- Email: support@shorelineops.com
- Website: https://shorelineops.com
`
fs.writeFileSync(path.join(TARGET_DIR, 'README.txt'), installGuide)
fs.writeFileSync(path.join(TARGET_DIR, 'INSTALL_GUIDE.md'), installGuide)

console.log('   ✅ Assets copied successfully.\n')

// Step 4: Zip the distribution if PowerShell is available
console.log('4. Creating compressed archive (.zip)...')
const zipPath = path.join(DIST_INSTALLER_DIR, `${PACKAGE_NAME}.zip`)
try {
  if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath)
  execSync(`powershell -Command "Compress-Archive -Path '${TARGET_DIR}\\*' -DestinationPath '${zipPath}' -Force"`, {
    stdio: 'inherit'
  })
  console.log(`   ✅ Distribution archive created: ${zipPath}`)
} catch (err) {
  console.warn('   ⚠️ Could not create zip archive automatically (folder is ready at ' + TARGET_DIR + ')')
}

console.log('\n======================================================================')
console.log('🎉 ONE-TIME INSTALLER PACKAGE READY!')
console.log(`   Location: ${TARGET_DIR}`)
console.log(`   Zip File: ${zipPath}`)
console.log('======================================================================\n')
