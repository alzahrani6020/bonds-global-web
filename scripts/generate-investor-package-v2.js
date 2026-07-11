const { chromium } = require('playwright');

const files = [
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\investor-deck-v2-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\investor-deck-v2-real-estate-asset-revitalization-v2.pdf',
    landscape: true
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\current-opportunities-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\current-opportunities-real-estate-asset-revitalization-v2.pdf',
    landscape: false
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\top-5-investor-questions-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\top-5-investor-questions-real-estate-asset-revitalization-v2.pdf',
    landscape: false
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\30-day-action-plan-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\30-day-action-plan-real-estate-asset-revitalization-v2.pdf',
    landscape: false
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\investor-meeting-kit-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\investor-meeting-kit-real-estate-asset-revitalization-v2.pdf',
    mixed: true
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

    const pdfOptions = {
      path: item.pdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true
    };

    if (item.landscape) {
      pdfOptions.width = '297mm';
      pdfOptions.height = '210mm';
      pdfOptions.landscape = true;
    } else if (item.mixed) {
      // Let CSS @page rules handle orientation
      pdfOptions.preferCSSPageSize = true;
    }

    await page.pdf(pdfOptions);
    await page.close();
    console.log('Generated: ' + item.pdf);
  }

  await browser.close();
})();
