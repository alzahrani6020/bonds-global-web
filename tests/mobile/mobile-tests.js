/**
 * Bonds Global — Mobile Interaction Tests
 *
 * Usage:
 *   npm run test:mobile
 *   BASE_URL=http://localhost:3005 npm run test:mobile
 */
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

const PAGES = [
  { name: 'index-ar', url: '/' },
  { name: 'services-ar', url: '/services.html' },
  { name: 'funding-extraction-ar', url: '/funding-extraction.html#funding-request' },
  { name: 'opportunity-bank-ar', url: '/v3/opportunity-bank.html' },
  { name: 'pricing-root-ar', url: '/pricing.html' },
  { name: 'calculator-ar', url: '/calculator.html' },
  { name: 'manufacturing-ar', url: '/sectors/manufacturing.html' },
  { name: 'distressed-recovery-study-ar', url: '/distressed-recovery-study.html' },
  { name: 'cash-flow-ar', url: '/calculators/cash-flow.html' },
  { name: 'restaurant-ar', url: '/calculators/restaurant.html' },
  { name: 'pricing-ar', url: '/calculators/pricing.html' },
  { name: 'loan-ar', url: '/calculators/loan.html' },
  { name: 'feasibility-ar', url: '/calculators/feasibility.html' },
  { name: 'v3-portfolio-ar', url: '/v3/portfolio' },
  { name: 'index-en', url: '/en/index.html' },
  { name: 'auth-ar', url: '/calculators/auth/index.html' },
  { name: 'auth-en', url: '/en/calculators/auth/index.html' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  let failed = 0;

  for (const p of PAGES) {
    const page = await context.newPage();
    const fullUrl = new URL(p.url, BASE_URL).toString();

    try {
      await page.goto(fullUrl, { waitUntil: 'networkidle' });

      // New homepage acceptance: check actual browser geometry, not CSS file contents.
      if (p.name === 'index-ar' || p.name === 'index-en') {
        const geometry = await page.evaluate(() => {
          const rect = selector => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, height: r.height };
          };
          return {
            header: rect('.main-header'),
            utility: rect('.bonds-topbar'),
            brand: rect('.main-header__inner'),
            title: rect('#bonds-hero-title'),
            clock: !!document.querySelector('.bonds-topbar__clock'),
            date: !!document.querySelector('.bonds-topbar__date'),
            menu: !!document.querySelector('#navToggle'),
            booking: !!document.querySelector('.main-header a[href$="book.html"]'),
          };
        });
        console.log(` ${p.name}: redesigned header geometry ${JSON.stringify(geometry)}`);
        const sufficientHeight = geometry.header && geometry.header.height > 95;
        const inside = geometry.utility && geometry.brand &&
          geometry.utility.top >= geometry.header.top - 2 &&
          geometry.utility.bottom <= geometry.header.bottom + 2 &&
          geometry.brand.bottom <= geometry.header.bottom + 2;
        const noOverlap = geometry.title && geometry.header &&
          geometry.title.top >= geometry.header.bottom - 2;
        if (!(sufficientHeight && inside && noOverlap && geometry.clock &&
          geometry.date && geometry.menu && geometry.booking)) {
          console.error(` ${p.name}: REDESIGN_HEADER_GEOMETRY_FAIL`);
          failed++;
        } else {
          console.log(` ${p.name}: redesign header dimensions, date, booking and hero clear PASS`);
        }
      }

      // Check the page does not overflow horizontally
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      if (bodyWidth > viewportWidth + 1) {
        console.log(` ${p.name}: horizontal overflow (${bodyWidth}px > ${viewportWidth}px)`);
        failed++;
      } else {
        console.log(` ${p.name}: no horizontal overflow`);
      }

      // Check tables do not overflow their containers
      const overflowingTables = await page.$$eval('table', (tables) =>
        tables.some((t) => t.scrollWidth > t.clientWidth + 1)
      );
      if (overflowingTables) {
        console.log(` ${p.name}: table overflows container`);
        failed++;
      } else {
        console.log(` ${p.name}: no table overflow`);
      }

      // Test dropdown toggle on touch (no hover)
      const toggle = await page.locator('.main-header .dropdown-toggle').first();
      if (await toggle.count() > 0) {
        await toggle.evaluate((el) => el.click());
        const dropdown = await page.locator('.main-header .dropdown').first();
        const isOpen = await dropdown.evaluate((el) => el.classList.contains('is-open'));
        if (isOpen) {
          console.log(` ${p.name}: dropdown toggles open on tap`);
        } else {
          console.log(` ${p.name}: dropdown did not open on tap`);
          failed++;
        }

        // Close by clicking outside
        await page.mouse.click(10, 10);
        const isClosed = !(await dropdown.evaluate((el) => el.classList.contains('is-open')));
        if (isClosed) {
          console.log(` ${p.name}: dropdown closes on outside tap`);
        } else {
          console.log(` ${p.name}: dropdown did not close on outside tap`);
          failed++;
        }
      }
    } catch (err) {
      console.error(` ${p.name}: ${err.message}`);
      failed++;
    } finally {
      await page.close();
    }
  }

  await browser.close();

  if (failed) {
    console.error(`\n ${failed} mobile test(s) failed.`);
    process.exit(1);
  }

  console.log("\n All mobile interaction tests passed.");
})();
