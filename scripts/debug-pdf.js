const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const inputPath = path.resolve(__dirname, '..', 'دراسة-جدوى-إحياء-الأصول-الملقحة.html');
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
  
  // Test 1: format A4 with margins
  await page.pdf({
    path: path.resolve(__dirname, '..', 'test-a4.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
  });
  
  let content = fs.readFileSync(path.resolve(__dirname, '..', 'test-a4.pdf'));
  let match = content.toString().match(/\/Count\s+(\d+)/);
  console.log('Test 1 - format A4 + margins:', match ? match[1] : 'unknown');
  
  // Test 2: format A4 without margins
  await page.pdf({
    path: path.resolve(__dirname, '..', 'test-a4-nomargin.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  
  content = fs.readFileSync(path.resolve(__dirname, '..', 'test-a4-nomargin.pdf'));
  match = content.toString().match(/\/Count\s+(\d+)/);
  console.log('Test 2 - format A4 no margins:', match ? match[1] : 'unknown');
  
  // Test 3: preferCSSPageSize true
  await page.pdf({
    path: path.resolve(__dirname, '..', 'test-csspage.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true
  });
  
  content = fs.readFileSync(path.resolve(__dirname, '..', 'test-csspage.pdf'));
  match = content.toString().match(/\/Count\s+(\d+)/);
  console.log('Test 3 - preferCSSPageSize true:', match ? match[1] : 'unknown');
  
  // Cleanup test files
  fs.unlinkSync(path.resolve(__dirname, '..', 'test-a4.pdf'));
  fs.unlinkSync(path.resolve(__dirname, '..', 'test-a4-nomargin.pdf'));
  fs.unlinkSync(path.resolve(__dirname, '..', 'test-csspage.pdf'));
  
  await browser.close();
})();
