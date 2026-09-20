const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\white\\.gemini\\antigravity\\brain\\d3d1428c-8c2c-4b09-87a6-379d54fe846e';

async function runReview() {
  const browser = await chromium.launch();
  const report = [];

  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.name === 'mobile' 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : vp.name === 'tablet'
        ? 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : undefined,
    });

    const page = await context.newPage();

    // 1. Visit /setup with clean storage
    console.log(`[${vp.name}] Testing /setup...`);
    await page.goto('http://localhost:3001/setup', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const setupTitle = await page.title();
    const setupHeading = await page.$eval('h1', el => el.textContent).catch(() => 'No h1');
    const setupImg = path.join(ARTIFACT_DIR, `setup_${vp.name}.png`);
    await page.screenshot({ path: setupImg, fullPage: false });

    report.push({
      page: '/setup',
      viewport: vp.name,
      title: setupTitle,
      heading: setupHeading,
      screenshot: setupImg,
    });

    // 2. Visit /login
    console.log(`[${vp.name}] Testing /login...`);
    await page.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const loginTitle = await page.title();
    const loginImg = path.join(ARTIFACT_DIR, `login_${vp.name}.png`);
    await page.screenshot({ path: loginImg, fullPage: false });

    // Fill demo credentials if present
    const demoButtons = await page.$$('button:has-text("admin@")');
    if (demoButtons.length > 0) {
      await demoButtons[0].click();
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);
    } else {
      await page.fill('input[type="email"]', 'admin@shorelineops.local').catch(() => {});
      await page.fill('input[type="password"]', 'ComplexAdminPass2026!').catch(() => {});
      await page.click('button[type="submit"]').catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 3. Visit / (Dashboard)
    console.log(`[${vp.name}] Testing / (Dashboard)...`);
    await page.goto('http://localhost:3001/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const dashImg = path.join(ARTIFACT_DIR, `dashboard_${vp.name}.png`);
    await page.screenshot({ path: dashImg, fullPage: false });

    // 4. Visit /residents
    console.log(`[${vp.name}] Testing /residents...`);
    await page.goto('http://localhost:3001/residents', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const residentsImg = path.join(ARTIFACT_DIR, `residents_${vp.name}.png`);
    await page.screenshot({ path: residentsImg, fullPage: false });

    // 5. Visit /menu
    console.log(`[${vp.name}] Testing /menu...`);
    await page.goto('http://localhost:3001/menu', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const menuImg = path.join(ARTIFACT_DIR, `menu_${vp.name}.png`);
    await page.screenshot({ path: menuImg, fullPage: false });

    // 6. Visit /kitchen/sheet
    console.log(`[${vp.name}] Testing /kitchen/sheet...`);
    await page.goto('http://localhost:3001/kitchen/sheet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const kitchenImg = path.join(ARTIFACT_DIR, `kitchen_${vp.name}.png`);
    await page.screenshot({ path: kitchenImg, fullPage: false });

    // 7. Visit /tasks (Mobile tasks)
    console.log(`[${vp.name}] Testing /tasks...`);
    await page.goto('http://localhost:3001/tasks', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const tasksImg = path.join(ARTIFACT_DIR, `tasks_${vp.name}.png`);
    await page.screenshot({ path: tasksImg, fullPage: false });

    // 8. Visit /settings
    console.log(`[${vp.name}] Testing /settings...`);
    await page.goto('http://localhost:3001/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const settingsImg = path.join(ARTIFACT_DIR, `settings_${vp.name}.png`);
    await page.screenshot({ path: settingsImg, fullPage: false });

    // 9. Visit /admin
    console.log(`[${vp.name}] Testing /admin...`);
    await page.goto('http://localhost:3001/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const adminImg = path.join(ARTIFACT_DIR, `admin_${vp.name}.png`);
    await page.screenshot({ path: adminImg, fullPage: false });

    await context.close();
  }

  await browser.close();
  console.log('REVIEW_COMPLETE');
  console.log(JSON.stringify(report, null, 2));
}

runReview().catch(err => {
  console.error('REVIEW_ERROR:', err);
  process.exit(1);
});
