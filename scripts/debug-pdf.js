const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const inputPath = path.resolve(__dirname, '..', 'distressed-recovery-study.html');
  const fileUrl = 'file://' + inputPath.replace(/\\/g, '/');

  await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 });
  await new Promise(r => setTimeout(r, 5000));

  const dims = await page.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      h2Count: document.querySelectorAll('h2').length,
      bodyChildren: document.body.children.length
    };
  });

  console.log('Document dimensions:', dims);
  console.log('Expected pages (~1123px each):', Math.ceil(dims.scrollHeight / 1123));

  // Test A4 using CSS @page rules.
  await page.pdf({
    path: path.resolve(__dirname, '..', 'test-a4.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true
  });

  let content = fs.readFileSync(path.resolve(__dirname, '..', 'test-a4.pdf'));
  let match = content.toString().match(/\/Count\s+(\d+)/);
  console.log('Test A4 with CSS @page rules:', match ? match[1] : 'unknown');

  // Cleanup test file
  fs.unlinkSync(path.resolve(__dirname, '..', 'test-a4.pdf'));

  await browser.close();
})();
