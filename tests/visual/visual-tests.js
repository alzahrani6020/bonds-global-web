/**
 * Bonds Global — Visual Regression Smoke Test
 *
 * Captures full-page screenshots of key pages for manual diff review.
 * Run with: npm run test:visual
 *
 * The local dev server is expected to be running on http://localhost:3005
 * (start it first with: npm run dev:local)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
const OUT_DIR = path.join(__dirname, 'snapshots');

const PAGES = [
  { name: 'index-ar', url: '/' },
  { name: 'about-ar', url: '/about.html' },
  { name: 'contact-ar', url: '/contact.html' },
  { name: 'services-ar', url: '/services.html' },
  { name: 'calculator-ar', url: '/calculator.html' },
  { name: 'cash-flow-ar', url: '/calculators/cash-flow.html' },
  { name: 'index-en', url: '/en/index.html' },
];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });

  let failed = 0;

  for (const p of PAGES) {
    const fullUrl = new URL(p.url, BASE_URL).toString();
    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const screenshotPath = path.join(OUT_DIR, `${p.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`✅ ${p.name}: ${screenshotPath}`);
    } catch (err) {
      console.error(`❌ ${p.name}: ${err.message}`);
      failed++;
    }
  }

  await browser.close();

  if (failed) {
    console.error(`\n${failed} page(s) failed to capture.`);
    process.exit(1);
  }
  console.log(`\n✅ All ${PAGES.length} screenshots saved to ${OUT_DIR}`);
})();
