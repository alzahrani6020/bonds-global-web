const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const files = [
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\investor-deck-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\investor-deck-real-estate-asset-revitalization-v1.pdf',
    landscape: true
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\executive-summary-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\executive-summary-real-estate-asset-revitalization-v1.pdf',
    landscape: false
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\investor-brief-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\investor-brief-real-estate-asset-revitalization-v1.pdf',
    landscape: false
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\why-invest-now-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\why-invest-now-real-estate-asset-revitalization-v1.pdf',
    landscape: false
  },
  {
    html: 'C:\\Users\\vip\\bonds-global-web\\reports\\investor-due-diligence-ar.html',
    pdf: 'C:\\Users\\vip\\Downloads\\investor-due-diligence-real-estate-asset-revitalization-v1.pdf',
    landscape: false
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
    }

    await page.pdf(pdfOptions);
    await page.close();
    console.log('Generated: ' + item.pdf);
  }

  await browser.close();
})();
