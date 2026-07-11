const { chromium } = require('playwright');
const path = require('path');

const files = [
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\distressed-recovery-feasibility-study-full-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\دراسة-جدوى-إحياء-الأصول-العقارية-الملقحة-الكاملة-محدثة.pdf'
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\distressed-recovery-feasibility-study-full-en.html',
    pdf: 'C:\\Users\\vip\\Downloads\\feasibility-study-real-estate-asset-revitalization-vaccinated-full.pdf'
  }
];

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  });

  for (const item of files) {
    const page = await browser.newPage();
    await page.goto('file://' + item.html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.pdf({
      path: item.pdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      preferCSSPageSize: true
    });
    await page.close();
    console.log('Generated: ' + item.pdf);
  }

  await browser.close();
})();
