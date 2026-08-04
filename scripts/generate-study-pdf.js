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

  // Keep the stylesheet's @media print rules (headers, footers, page numbers).
  // Only add minimal overrides that the CSS cannot express.
  await page.addStyleTag({
    content: `
      .print-btn, button { display: none !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    `
  });

  // Generate PDF using the CSS @page rules (A4, margins, headers/footers).
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true
  });

  const content = fs.readFileSync(outputPath);
  const match = content.toString().match(/\/Count\s+(\d+)/);
  const pages = match ? match[1] : 'unknown';

  const stats = fs.statSync(outputPath);
  console.log(" PDF created:", outputPath);
  console.log(" Pages:", pages);
  console.log(" Size:", (stats.size / 1024 / 1024).toFixed(2), 'MB');

  await browser.close();
})();
