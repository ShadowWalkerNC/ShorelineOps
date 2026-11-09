const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { _electron } = require('playwright')
const OTPAuth = require('otpauth')
const { DatabaseSync } = require('node:sqlite')

async function verify() {
  const executable = path.resolve(process.argv[2])
  const evidence = path.resolve(process.argv[3] || 'release/desktop/ui-evidence')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'shoreline-ui-test-'))
  fs.mkdirSync(evidence, { recursive: true })
  const env = {}
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'COMSPEC', 'PATHEXT', 'DISPLAY', 'WAYLAND_DISPLAY', 'XDG_RUNTIME_DIR']) {
    if (process.env[name]) env[name] = process.env[name]
  }
  env.SETUP_BOOTSTRAP_SECRET = 'isolated-acceptance-bootstrap-key'
  let app
  let mfaSecret
  const errors = []
  const launch = async () => {
    app = await _electron.launch({ executablePath: executable, args: [`--user-data-dir=${profile}`], env, timeout: 90000 })
    assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile)
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true)
    const page = await app.firstWindow()
    page.setDefaultTimeout(15000)
    page.on('pageerror', error => errors.push(error.message))
    return page
  }
  const login = async page => {
    await page.getByLabel('Email', { exact: true }).fill('acceptance@example.test')
    await page.getByLabel('Password', { exact: true }).fill('AcceptanceAdmin2026!')
    await page.locator('button[type=submit]').click()
    await page.waitForFunction(() => !location.pathname.includes('/login') || document.querySelector('input[placeholder="000000"]'))
    if (page.url().includes('/login')) {
      if (await page.locator('code').count()) mfaSecret = await page.locator('code').first().textContent()
      assert.ok(mfaSecret, 'The isolated account must have an enrollment secret before verifying MFA')
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(mfaSecret.trim()) })
      await page.getByPlaceholder('000000').fill(totp.generate())
      await page.locator('button[type=submit]').click()
    }
    await page.waitForURL(url => !url.pathname.includes('/login') && !url.pathname.includes('/setup'))
  }
  const chooseAppearance = async (page, label) => {
    const navigation = page.getByRole('button', { name: /^All navigation/ })
    const drawer = await navigation.isVisible()
    if (drawer) await navigation.click()
    await page.getByRole('button', { name: label, exact: true }).click()
    if (drawer) await page.keyboard.press('Escape')
  }
  try {
    let page = await launch()
    await page.waitForURL('**/app/setup')
    await page.getByPlaceholder('e.g. Shoreline Senior Living & Rehabilitation').fill('Isolated Acceptance Facility')
    await page.getByPlaceholder('admin@shorelinecare.com').fill('acceptance@example.test')
    await page.getByRole('button', { name: 'Continue →', exact: true }).click()
    await page.getByPlaceholder('e.g. Dr. Alex Morgan', { exact: true }).fill('Acceptance Administrator')
    await page.getByPlaceholder('alex.morgan@shorelinecare.com').fill('acceptance@example.test')
    await page.locator('input[type=password]').nth(0).fill('AcceptanceAdmin2026!')
    await page.locator('input[type=password]').nth(1).fill('AcceptanceAdmin2026!')
    await page.getByRole('button', { name: 'Continue →', exact: true }).click()
    await page.getByPlaceholder('e.g. Memory Care, East Wing').fill('Acceptance Wing')
    await page.getByRole('button', { name: 'Add Wing', exact: true }).click()
    await page.getByPlaceholder('e.g. Main Dining Room, Tray Service').fill('Acceptance Dining')
    await page.getByRole('button', { name: 'Add Dining Room', exact: true }).click()
    await page.getByRole('button', { name: 'Continue →', exact: true }).click()
    await page.getByPlaceholder('Enter provisioned setup secret').fill(env.SETUP_BOOTSTRAP_SECRET)
    await page.getByRole('button', { name: 'Continue →', exact: true }).click()
    await page.getByPlaceholder('e.g. Dr. Alex Morgan, Executive Director').fill('Acceptance Administrator')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Continue →', exact: true }).click()
    await page.getByRole('button', { name: 'Complete Setup & Launch Facility', exact: true }).click()
    await page.waitForURL('**/app/login')
    await login(page)
    const status = await page.evaluate(() => fetch('/api/setup/status').then(response => response.json()))
    assert.equal(status.isInitialized, true)
    assert.equal(status.facilityName, 'Isolated Acceptance Facility')
    const origin = new URL(page.url()).origin
    await page.route('**/api/purchasing/vendors', route => route.fulfill({ status: 503, json: { error: 'Acceptance outage' } }))
    await page.route('**/api/distributor/price-matrix', route => route.fulfill({ status: 503, json: { error: 'Acceptance outage' } }))
    await page.goto(`${origin}/app/purchasing`)
    await page.getByRole('alert').filter({ hasText: /Vendors unavailable/ }).waitFor()
    assert.equal(await page.getByRole('option', { name: 'No vendor data available', exact: true }).count(), 1)
    await page.getByRole('button', { name: /Multi-Distributor Price Matrix/ }).click()
    await page.getByRole('alert').filter({ hasText: /Price comparison/ }).waitFor()
    assert.equal(await page.getByText('Savings: $2.45 per resident day', { exact: true }).count(), 0)
    await page.screenshot({ path: path.join(evidence, 'purchasing-unavailable.png'), fullPage: true })
    await page.unroute('**/api/purchasing/vendors')
    await page.unroute('**/api/distributor/price-matrix')
    await page.goto(`${origin}/app/production`)
    await page.getByRole('tab', { name: 'Paperwork', exact: true }).click()
    await page.getByRole('combobox', { name: 'Resident area', exact: true }).selectOption('acceptance_wing')
    await page.getByRole('combobox', { name: 'Paperwork', exact: true }).selectOption('prep-list')
    const rendering = page.waitForResponse(response => response.url().endsWith('/api/paperwork/render') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Prepare printable pages', exact: true }).click()
    const rendered = await rendering
    assert.equal(rendered.status(), 200)
    const packet = await rendered.json()
    assert.equal(packet.pages, 1)
    assert.equal(packet.preview, false)
    assert.match(packet.html, /Acceptance Wing/)
    assert.doesNotMatch(packet.html, /Sylvia Ross|Ross Manor/)
    await page.goto(`${origin}/app/`)
    await page.locator('.stitch-clinical-summary').waitFor()
    await chooseAppearance(page, 'Dark')
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await page.screenshot({ path: path.join(evidence, 'dashboard-dark.png'), fullPage: true })
    await chooseAppearance(page, 'System')
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
    for (const width of [390, 430, 768, 1280]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 900), width)
      await page.waitForFunction(width => window.outerWidth === width, width)
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0))
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `Horizontal overflow at ${width}px`)
      assert.ok(await page.locator('.stitch-clinical-summary > div').evaluate(element => element.getBoundingClientRect().width >= 180), `Clinical summary is squeezed at ${width}px`)
      await page.screenshot({ path: path.join(evidence, `dashboard-${width}.png`), fullPage: true })
    }
    await chooseAppearance(page, 'Dark')
    await app.close()
    app = null
    page = await launch()
    await page.waitForURL(url => !url.pathname.includes('/setup') && url.pathname.includes('/app'))
    if (page.url().includes('/login')) await login(page)
    const restored = await page.evaluate(() => fetch('/api/setup/status').then(response => response.json()))
    assert.equal(restored.isInitialized, true)
    assert.equal(restored.facilityName, 'Isolated Acceptance Facility')
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
    const database = new DatabaseSync(path.join(profile, 'shoreline.db'), { readOnly: true })
    let counts
    try {
      counts = database.prepare('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM residents) AS residents').get()
      assert.equal(counts.users, 1)
      assert.equal(counts.residents, 0)
    } finally {
      database.close()
    }
    assert.deepEqual(errors, [])
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify({ setup: 'PASS', login: 'PASS', restart: 'PASS', paperwork: 'PASS', appearance: 'PASS', purchasingOutage: 'PASS', databaseCounts: counts, widths: [390, 430, 768, 1280], pageErrors: errors }, null, 2))
    console.log('PASS packaged GUI setup, account login, restart persistence and four viewport widths')
  } finally {
    if (app) await app.close()
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

verify().catch(error => {
  console.error(error)
  process.exitCode = 1
})
