#!/usr/bin/env node

/**
 * ==============================================================================
 * UNIFIED STATIC SITE BUILDER (Marketing Website + Client-Side Interactive Demo)
 * ==============================================================================
 * 1. Builds Astro marketing site -> marketing/dist/
 * 2. Builds Vite app with base '/demo/' -> dist/
 * 3. Combines them into a single dist/ tree:
 *    - /                    -> Astro Marketing Homepage
 *    - /pricing, /story, .. -> Astro Marketing Subpages
 *    - /demo/               -> Interactive Client-Side Sandbox (100% serverless)
 * ==============================================================================
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const marketingDir = path.join(rootDir, 'marketing')
const marketingDistDir = path.join(marketingDir, 'dist')
const outDistDir = path.join(rootDir, 'dist')
const tempDemoDir = path.join(rootDir, 'dist-demo-temp')

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src)
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

// Clean up any stale build directories
if (fs.existsSync(tempDemoDir)) fs.rmSync(tempDemoDir, { recursive: true, force: true })
if (fs.existsSync(outDistDir)) fs.rmSync(outDistDir, { recursive: true, force: true })

console.log('🚀 [Build 1/3] Compiling Astro Marketing Website...')
execSync('npm --prefix marketing run build', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PUBLIC_DEMO_URL: '/demo',
    PUBLIC_APP_URL: '/demo',
  },
})

console.log('\n🚀 [Build 2/3] Compiling Vite Interactive Demo (base: /demo/, demoMode: true)...')
execSync('npx vite build --base=/demo/', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BASE_PATH: '/demo/',
    VITE_DEMO_MODE: 'true',
  },
})

console.log('\n🚀 [Build 3/3] Merging Marketing Site and Demo App into final dist/...')
// Move the Vite build out of dist/ temporarily
fs.renameSync(outDistDir, tempDemoDir)

// Recreate dist/ and copy marketing site into root
fs.mkdirSync(outDistDir, { recursive: true })
copyRecursive(marketingDistDir, outDistDir)

// Move temp demo directory into dist/demo/
const finalDemoDir = path.join(outDistDir, 'demo')
fs.renameSync(tempDemoDir, finalDemoDir)

console.log('\n✅ [Success] Unified site ready in dist/:')
console.log('   - /                       -> dist/index.html (Marketing Homepage)')
console.log('   - /pricing, /story, etc.  -> dist/*/index.html (Marketing Pages)')
console.log('   - /demo/                  -> dist/demo/index.html (Interactive Demo Sandbox)')
console.log('   - Requirements:           0 backend servers (100% static & serverless ready!)\n')
