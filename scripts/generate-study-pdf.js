const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const inputFile = process.argv[2] || 'distressed-recovery-study.html';
  const outputFile = process.argv[3] || 'دراسة-جدوى-إحياء-الأصول-الملقحة.pdf';

  const inputPath = path.resolve(__dirname, '..', inputFile);
  const outputPath = path.resolve(__dirname, '..', outputFile);

  if (!fs.existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const fileUrl = 'file://' + inputPath.replace(/\\/g, '/');
  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 });
  await new Promise(r => setTimeout(r, 5000));

  // Remove ALL existing @media print rules from style tags
  await page.evaluate(() => {
    const styleSheets = document.styleSheets;
    for (let i = styleSheets.length - 1; i >= 0; i--) {
      try {
        const sheet = styleSheets[i];
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        for (let j = rules.length - 1; j >= 0; j--) {
          if (rules[j].type === CSSRule.MEDIA_RULE && rules[j].conditionText.includes('print')) {
            sheet.deleteRule(j);
          }
        }
      } catch (e) {
        // Cross-origin stylesheets can't be accessed
      }
    }
  });

  // Inject clean print styles
  await page.addStyleTag({
    content: `
      .print-btn, button { display: none !important; }
      body { padding-bottom: 0 !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      
      /* Page breaks */
      .cover { page-break-after: always !important; }
      h2 { page-break-before: always !important; page-break-after: avoid !important; }
      table, .kpi-grid, .scenario, .alert, .comparison, .before-after { page-break-inside: avoid !important; }
      img, canvas { page-break-inside: avoid !important; max-width: 100% !important; }
      
      /* Typography for print */
      body { font-size: 10.5pt !important; line-height: 1.7 !important; }
      .content { padding: 0 !important; }
      .page { box-shadow: none !important; max-width: 100% !important; }
      h2 { font-size: 18pt !important; }
      h3 { font-size: 14pt !important; }
      table { font-size: 9.5pt !important; box-shadow: none !important; border: 1px solid #ddd !important; }
    `
  });

  // Generate PDF
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '15mm', bottom: '18mm', left: '15mm' },
    preferCSSPageSize: false
  });

  const content = fs.readFileSync(outputPath);
  const match = content.toString().match(/\/Count\s+(\d+)/);
  const pages = match ? match[1] : 'unknown';

  const stats = fs.statSync(outputPath);
  console.log('✅ PDF created:', outputPath);
  console.log('📄 Pages:', pages);
  console.log('📦 Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

  await browser.close();
})();
