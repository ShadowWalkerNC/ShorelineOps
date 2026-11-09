const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { execSync } = require('node:child_process')

function resolveWorkstationDir(env = process.env, explicitUserData = null) {
  if (explicitUserData) return explicitUserData
  const base = env.APPDATA || path.join(os.homedir(), '.local', 'share')
  return path.join(base, 'ShorelineOps')
}

function ensureWorkstationSecrets(env = process.env, explicitUserData = null) {
  const dir = resolveWorkstationDir(env, explicitUserData)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const secretsFile = path.join(dir, 'workstation-secrets.json')
  const keyNoticeFile = path.join(dir, 'FIRST-RUN-SETUP-KEY.txt')

  let stored = {}
  if (fs.existsSync(secretsFile)) {
    try {
      stored = JSON.parse(fs.readFileSync(secretsFile, 'utf8'))
    } catch {
      stored = {}
    }
  }

  let updated = false
  if (typeof stored.jwtSecret !== 'string' || stored.jwtSecret.length < 32) {
    stored.jwtSecret = crypto.randomBytes(32).toString('hex')
    updated = true
  }
  if (typeof stored.setupBootstrapSecret !== 'string' || stored.setupBootstrapSecret.length < 16) {
    stored.setupBootstrapSecret = `shoreline-setup-${crypto.randomBytes(12).toString('hex')}`
    updated = true
  }

  if (updated || !fs.existsSync(secretsFile)) {
    fs.writeFileSync(secretsFile, JSON.stringify(stored, null, 2), { mode: 0o600 })
  }

  if (updated || !fs.existsSync(keyNoticeFile)) {
    const notice = [
      '======================================================================',
      '  SHORELINE CARE OS — LOCAL WORKSTATION BOOTSTRAP CREDENTIALS',
      '======================================================================',
      '',
      'Use the Setup Bootstrap Secret below when completing the first-time',
      'Facility Setup Wizard at /app/setup (Step 4: Security):',
      '',
      `  SETUP_BOOTSTRAP_SECRET: ${stored.setupBootstrapSecret}`,
      '',
      `  Workstation Directory: ${dir}`,
      '======================================================================',
      '',
    ].join(os.EOL)
    fs.writeFileSync(keyNoticeFile, notice, { mode: 0o600 })
  }

  const nextEnv = { ...env }
  if (!nextEnv.JWT_SECRET || nextEnv.JWT_SECRET.length < 32) {
    nextEnv.JWT_SECRET = stored.jwtSecret
  }
  if (!nextEnv.SETUP_BOOTSTRAP_SECRET || nextEnv.SETUP_BOOTSTRAP_SECRET.length < 16) {
    nextEnv.SETUP_BOOTSTRAP_SECRET = stored.setupBootstrapSecret
  }

  return {
    env: nextEnv,
    secretsFile,
    keyNoticeFile,
    setupBootstrapSecret: nextEnv.SETUP_BOOTSTRAP_SECRET,
  }
}

function ensureCompiledArtifacts(root) {
  const serverEntry = path.join(root, 'server', 'dist', 'index.js')
  const appEntry = path.join(root, 'dist', 'app', 'index.html')
  if (fs.existsSync(serverEntry) && fs.existsSync(appEntry)) {
    return
  }
  console.log('[Workstation] Compiling missing production build artifacts...')
  execSync('npm run build', { cwd: root, stdio: 'inherit' })
}

module.exports = {
  ensureWorkstationSecrets,
  ensureCompiledArtifacts,
  resolveWorkstationDir,
}
