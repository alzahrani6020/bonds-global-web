/**
 * Generate square PNG icons from assets/bonds-logo.svg for the PWA manifest.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'assets', 'bonds-logo.svg');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'icons');
const SIZES = [192, 512];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

  const browser = await chromium.launch({ headless: true });

  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.goto(dataUrl, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(OUT_DIR, `icon-${size}.png`), type: 'png' });
    await page.close();
    console.log(` Generated icon-${size}.png`);
  }

  await browser.close();
})();
