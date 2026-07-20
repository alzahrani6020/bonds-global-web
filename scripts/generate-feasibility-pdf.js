const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const file = path.resolve(__dirname, '../reports/food-manufacturing-jeddah-feasibility.html');
  const out = path.resolve(__dirname, '../reports/food-manufacturing-jeddah-feasibility.pdf');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('file://' + file, { waitUntil: 'networkidle' });

  // Trigger and wait for the financial recalculation to finish
  const profitText = await page.evaluate(async () => {
    if (window.recalc) window.recalc();
    // Give charts/fonts a moment
    await new Promise(r => setTimeout(r, 800));
    return document.getElementById('kpi-profit')?.textContent || '';
  });
  if (!profitText) {
    console.warn('Warning: KPI profit not populated');
  }

  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
    preferCSSPageSize: true,
  });
  await browser.close();
  console.log('PDF generated:', out);
})();
