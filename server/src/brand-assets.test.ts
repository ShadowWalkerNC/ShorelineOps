import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Original-logo regression: the app shell, login, offline page, and
// marketing layout must display the original S-wave artwork (the
// /icon-192.png icon mark and /logo.png banner), never the generated
// /brand/shorelineops-icon.svg set. No database, network, or secret access.

const repoRoot = path.resolve(__dirname, '..', '..')

const DISPLAY_SURFACES: Array<{ file: string; expect: string[] }> = [
  { file: 'src/components/Layout.tsx', expect: ['/icon-192.png'] },
  { file: 'src/features/auth/LoginPage.tsx', expect: ['/icon-192.png'] },
  { file: 'src/features/offline/OfflinePage.tsx', expect: ['icon-192.png'] },
  { file: 'marketing/src/layouts/BaseLayout.astro', expect: ['/icon-192.png', '/logo.png'] },
]

test('displayed logos use the original artwork, not the generated brand set', () => {
  for (const { file, expect } of DISPLAY_SURFACES) {
    const body = fs.readFileSync(path.join(repoRoot, file), 'utf8')
    assert.ok(
      !body.includes('brand/shorelineops-icon.svg'),
      `${file} still references the generated logo`,
    )
    for (const asset of expect) {
      assert.ok(body.includes(asset), `${file} should reference ${asset}`)
    }
  }
})

test('referenced original logo files ship in both public dirs', () => {
  for (const dir of ['public', path.join('marketing', 'public')]) {
    for (const asset of ['icon-192.png', 'logo.png']) {
      const file = path.join(repoRoot, dir, asset)
      assert.ok(fs.existsSync(file), `missing ${path.join(dir, asset)}`)
      assert.ok(fs.statSync(file).size > 0, `empty ${path.join(dir, asset)}`)
    }
  }
})
