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
const tempAppDir = path.join(rootDir, 'dist-app-temp')

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
if (fs.existsSync(tempAppDir)) fs.rmSync(tempAppDir, { recursive: true, force: true })
if (fs.existsSync(outDistDir)) fs.rmSync(outDistDir, { recursive: true, force: true })

console.log('🚀 [Build 1/3] Compiling Astro Marketing Website...')
execSync('npm --prefix marketing run build', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PUBLIC_DEMO_URL: '/demo',
    PUBLIC_APP_URL: '/app',
  },
})

console.log('\n🚀 [Build 2/4] Compiling Vite Interactive Demo (base: /demo/, demoMode: true)...')
execSync('npx vite build --base=/demo/', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BASE_PATH: '/demo/',
    VITE_DEMO_MODE: 'true',
  },
})

// Move the demo build out of dist/ temporarily
if (fs.existsSync(tempDemoDir)) fs.rmSync(tempDemoDir, { recursive: true, force: true })
fs.renameSync(outDistDir, tempDemoDir)

console.log('\n🚀 [Build 3/4] Compiling Vite SaaS Production App (base: /app/, demoMode: false)...')
execSync('npx vite build --base=/app/', {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_BASE_PATH: '/app/',
    VITE_DEMO_MODE: 'false',
  },
})

// Move the SaaS app build out of dist/ temporarily
if (fs.existsSync(tempAppDir)) fs.rmSync(tempAppDir, { recursive: true, force: true })
fs.renameSync(outDistDir, tempAppDir)

console.log('\n🚀 [Build 4/4] Merging Marketing Site, SaaS App, and Demo App into final dist/...')
// Recreate dist/ and copy marketing site into root
fs.mkdirSync(outDistDir, { recursive: true })
copyRecursive(marketingDistDir, outDistDir)

// Move temp demo directory into dist/demo/
const finalDemoDir = path.join(outDistDir, 'demo')
fs.renameSync(tempDemoDir, finalDemoDir)

// Move temp SaaS app directory into dist/app/
const finalAppDir = path.join(outDistDir, 'app')
fs.renameSync(tempAppDir, finalAppDir)

// Clean up temp directories if any left
if (fs.existsSync(tempDemoDir)) fs.rmSync(tempDemoDir, { recursive: true, force: true })
if (fs.existsSync(tempAppDir)) fs.rmSync(tempAppDir, { recursive: true, force: true })

console.log('\n✅ [Success] Unified site ready in dist/:')
console.log('   - /                       -> dist/index.html (Marketing Homepage - Public)')
console.log('   - /pricing, /story, etc.  -> dist/*/index.html (Marketing Pages - Public)')
console.log('   - /demo/                  -> dist/demo/index.html (Interactive Demo Sandbox - Public)')
console.log('   - /app/                   -> dist/app/index.html (SaaS Production Platform - Gatekept)')
console.log('   - /api/                   -> Express REST API\n')
