/**
 * Bonds Global — Visual Regression Tests (pixel-diff)
 *
 * Usage:
 *   npm run test:visual                # compare against baselines
 *   npm run test:visual:update         # update baseline screenshots
 *   BASE_URL=http://localhost:3005 npm run test:visual
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
const UPDATE_BASELINE = process.argv.includes('--update') || process.env.UPDATE_BASELINE === '1';
const TOLERANCE = Number(process.env.VISUAL_TOLERANCE) || 0.2;
const FULL_PAGE = process.env.VISUAL_FULLPAGE === '1';
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD) || 0;

const BASELINES_DIR = path.join(__dirname, 'baselines');
const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots');
const DIFFS_DIR = path.join(__dirname, 'diffs');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const PAGES = [
  { name: 'index-ar', url: '/' },
  { name: 'about-ar', url: '/about.html' },
  { name: 'contact-ar', url: '/contact.html' },
  { name: 'services-ar', url: '/services.html' },
  { name: 'pricing-root-ar', url: '/pricing.html' },
  { name: 'calculator-ar', url: '/calculator.html' },
  { name: 'distressed-recovery-study-ar', url: '/distressed-recovery-study.html' },
  { name: 'cash-flow-ar', url: '/calculators/cash-flow.html' },
  { name: 'index-en', url: '/en/index.html' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(png, filePath) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

(async () => {
  ensureDir(SNAPSHOTS_DIR);
  ensureDir(DIFFS_DIR);

  const browser = await chromium.launch({ headless: true });
  let failed = 0;
  let created = 0;

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.context().addInitScript(() => {
      localStorage.setItem('cookies', 'accepted');
    });

    for (const p of PAGES) {
      const fullUrl = new URL(p.url, BASE_URL).toString();
      const baselinePath = path.join(BASELINES_DIR, viewport.name, `${p.name}.png`);
      const snapshotPath = path.join(SNAPSHOTS_DIR, viewport.name, `${p.name}.png`);
      const diffPath = path.join(DIFFS_DIR, viewport.name, `${p.name}.png`);

      try {
        await page.goto(fullUrl, { waitUntil: 'networkidle' });
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
            body::before, .glow-orb, .hero__orb, .hero__bg,
            .cursor-trail, .spotlight, #particlesCanvas, #particles-canvas, .cookie-banner {
              display: none !important;
            }
          `
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const banner = document.getElementById('cookieBanner');
          if (banner) banner.classList.remove('is-visible');
        });

        ensureDir(path.dirname(snapshotPath));
        await page.screenshot({ path: snapshotPath, fullPage: FULL_PAGE });

        if (UPDATE_BASELINE) {
          ensureDir(path.dirname(baselinePath));
          fs.copyFileSync(snapshotPath, baselinePath);
          console.log(`📸 baseline updated: ${viewport.name}/${p.name}`);
          continue;
        }

        if (!fs.existsSync(baselinePath)) {
          ensureDir(path.dirname(baselinePath));
          fs.copyFileSync(snapshotPath, baselinePath);
          created++;
          console.log(`⚠️  baseline created: ${viewport.name}/${p.name}`);
          continue;
        }

        const img1 = readPng(baselinePath);
        const img2 = readPng(snapshotPath);

        if (img1.width !== img2.width || img1.height !== img2.height) {
          console.log(`❌ ${viewport.name}/${p.name}: size mismatch (${img1.width}x${img1.height} vs ${img2.width}x${img2.height})`);
          failed++;
          continue;
        }

        const diff = new PNG({ width: img1.width, height: img1.height });
        const diffPixels = pixelmatch(
          img1.data,
          img2.data,
          diff.data,
          img1.width,
          img1.height,
          { threshold: THRESHOLD, includeAA: false }
        );

        const totalPixels = img1.width * img1.height;
        const diffRatio = diffPixels / totalPixels;

        if (diffRatio > TOLERANCE) {
          writePng(diff, diffPath);
          console.log(`❌ ${viewport.name}/${p.name}: ${diffPixels} pixels differ (${(diffRatio * 100).toFixed(2)}%)`);
          failed++;
        } else {
          console.log(`✅ ${viewport.name}/${p.name}: no diff`);
        }
      } catch (err) {
        console.error(`❌ ${viewport.name}/${p.name}: ${err.message}`);
        failed++;
      }
    }

    await page.close();
  }

  await browser.close();

  if (UPDATE_BASELINE) {
    console.log(`\n📸 Baselines updated for ${PAGES.length * VIEWPORTS.length} screenshots.`);
    return;
  }

  if (created) {
    console.log(`\n⚠️ Created ${created} missing baseline(s). Review them, then run 'npm run test:visual:update' to commit.`);
  }

  if (failed) {
    console.error(`\n❌ ${failed} screenshot(s) failed or differed. See ${DIFFS_DIR}`);
    process.exit(1);
  }

  console.log(`\n✅ All ${PAGES.length * VIEWPORTS.length} screenshots match baselines.`);
})();
