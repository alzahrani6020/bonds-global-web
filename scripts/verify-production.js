const { chromium } = require('playwright');

const BASE = 'https://bonds-global.com';

const tests = [
  { name: 'old-break-even', url: '/calculator.html', expect: ['#fixedCost', '#resUnits'] },
  { name: 'cash-flow', url: '/calculators/cash-flow.html', expect: ['#openingBalance'] },
  { name: 'pricing', url: '/calculators/pricing.html', expect: ['#directCost'] },
  { name: 'investment-center-real-estate', url: '/calculators/investment-center/real-estate.html', expect: ['#landValue'] },
  { name: 'investment-center-index', url: '/calculators/investment-center/index.html', expect: ['.sectors-grid'] },
  { name: 'valuation', url: '/valuation/', expect: ['[data-slug="realEstate"]'] },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  let failed = 0;

  for (const t of tests) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    try {
      await page.goto(BASE + t.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      for (const sel of t.expect) {
        const count = await page.locator(sel).count();
        if (count === 0) {
          console.log(` ${t.name}: missing ${sel}`);
          failed++;
        } else {
          console.log(` ${t.name}: ${sel} found`);
        }
      }

      if (errors.length) {
        console.log(` ${t.name} page errors:`, errors.slice(0, 3));
        failed++;
      }
    } catch (e) {
      console.log(` ${t.name}: exception ${e.message}`);
      failed++;
    }

    await page.close();
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
