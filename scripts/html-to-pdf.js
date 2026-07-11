const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node html-to-pdf.js <input.html> <output.pdf>');
  console.error('Optionally set CHROME_EXECUTABLE_PATH to use a specific Chromium/Edge binary.');
  process.exit(1);
}

function fileUrl(p) {
  const resolved = path.resolve(p);
  const withForwardSlashes = resolved.split(path.sep).join('/');
  return 'file://' + (withForwardSlashes.startsWith('/') ? withForwardSlashes : '/' + withForwardSlashes);
}

function findChrome() {
  const candidates = [];
  if (process.env.CHROME_EXECUTABLE_PATH) {
    candidates.push(process.env.CHROME_EXECUTABLE_PATH);
  }

  const platform = os.platform();
  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/microsoft-edge'
    );
  }

  return candidates.find(c => fs.existsSync(c));
}

(async () => {
  const executablePath = findChrome();
  if (!executablePath) {
    console.error('Chrome/Edge executable not found.');
    console.error('Set CHROME_EXECUTABLE_PATH env var or install a Chromium-based browser.');
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto(fileUrl(inputPath), { waitUntil: 'networkidle' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '1.5cm', right: '1.5cm', bottom: '1.5cm', left: '1.5cm' },
      preferCSSPageSize: true
    });
    console.log('PDF created:', outputPath);
  } finally {
    await browser.close();
  }
})();
