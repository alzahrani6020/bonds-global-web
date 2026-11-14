/**
 * Live production-export stage regression, executed only in an isolated Chromium page.
 * Real html2canvas (1.4.1), real jsPDF (2.5.1), real production createPdfBlob
 * function; fake correspondence record, no credentials or uploads.
 *
 * Requires Poppler pdfinfo + pdftoppm, and the browser CDN dependencies that
 * letterhead.html currently requires. Network failures are FAIL, not a false PASS.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const cp = require('child_process');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', '..');
const OUTPUT = path.join(__dirname, 'snapshots', 'correspondence-export-stage-report.json');
const HTML2CANVAS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const MAX_DIFF = 0.12; // JPEG compression + PDF raster scaling at 96 dpi

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
function poppler(...args) {
  return cp.execFileSync(args[0], args.slice(1), {
    timeout: 30000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8'
  });
}
function pngRead(bytes) {
  return PNG.sync.read(bytes);
}
async function compareStage(canvasPng, renderedPng) {
  const reference = pngRead(renderedPng);
  const stage = await sharp(canvasPng).resize(reference.width, reference.height, {
    fit: 'fill', kernel: 'lanczos3'
  }).png().toBuffer();
  const original = pngRead(stage);
  const pixels = pixelmatch(original.data, reference.data, null,
    reference.width, reference.height, {
      threshold: 0.20, includeAA: false
    });
  return {
    pdfPixels: [reference.width, reference.height],
    diffRatio: Number((pixels / (reference.width * reference.height)).toFixed(6)),
    allowedDiffRatio: MAX_DIFF
  };
}
async function main() {
  const source = fs.readFileSync(path.join(ROOT, 'components', 'letterhead-correspondence.js'), 'utf8');
  const guardAt = source.indexOf('  function assertPdfSourceGeometry(sheets)');
  const exportAt = source.indexOf('  async function createPdfBlob()', guardAt);
  const finalAt = source.indexOf('  async function persistIssuedPdfArtifact()', exportAt);
  if (guardAt < 0 || exportAt < 0 || finalAt < 0) {
    throw new Error('Actual production correspondence PDF exporter and guard are missing');
  }
  const productionFunctions = source.slice(guardAt, finalAt);
  const html = fs.readFileSync(path.join(ROOT, 'letterhead.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const browser = await chromium.launch({ headless: true });
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bonds-export-stages-'));
  const report = { engine: 'real-html2canvas-jspdf-export', status: 'UNKNOWN',
    noOfficialRecordsTouched: true, pages: [] };
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1
    });
    // Use exactly the library URLs referenced by the issued-letter page.
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ url: HTML2CANVAS_URL });
    await page.addScriptTag({ url: JSPDF_URL });
    await page.evaluate(() => document.fonts.ready);
    const exported = await page.evaluate(async productionFunctions => {
      const container = document.getElementById('pages-container');
      const first = container.querySelector('.sheet');
      if (!first) throw new Error('No actual letterhead A4 sheet');
      const second = first.cloneNode(true);
      container.appendChild(second);
      const sheets = [first, second];
      const listText = 'صك الملكية والمخططات الهندسية والتراخيص المتعلقة بمشروع الأرض';
      sheets.forEach((sheet, index) => {
        const doc = sheet.querySelector('.doc-content');
        doc.setAttribute('dir', 'rtl');
        doc.innerHTML = '<ol start="' + (index * 5 + 1) + '">' +
          Array.from({ length: 5 }, (_, n) =>
            '<li><p>البند ' + (index * 5 + n + 1) + ': ' + listText + '</p></li>').join('') +
          '</ol>';
        sheet.querySelector('.page-number').textContent =
          'الصفحة ' + (index + 1) + ' من 2';
      });
      const state = {
        document: { id: '00000000-0000-4000-8000-000000000000', status: 'issued',
          issued_hash: null },
        latestVersion: { pages_html: sheets.map(s =>
          s.querySelector('.doc-content').innerHTML) }
      };
      const captures = [];
      const realCanvas = window.html2canvas;
      const html2canvas = async (...args) => {
        const canvas = await realCanvas(...args);
        captures.push(canvas.toDataURL('image/png').split(',')[1]);
        return canvas;
      };
      const waitForVerificationQr = async () => {};
      const paginateEditableSheets = () => {
        throw new Error('Issued official correspondence must not be repaginated');
      };
      // The real paginator returns false on issued documents. Replace only its
      // harmless no-op behavior, not the export code or geometry guard.
      const exportFunction = new Function('state', 'isEn', 'html2canvas',
        'waitForVerificationQr', 'paginateEditableSheets', productionFunctions +
        '\nreturn createPdfBlob();');
      const blob = await exportFunction(state, false, html2canvas,
        waitForVerificationQr, () => false);
      if (blob.type !== 'application/pdf') {
        throw new Error('Production exporter did not return PDF');
      }
      const pdfBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error);
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.readAsDataURL(blob);
      });
      const geometry = sheets.map((sheet, index) => ({
        page: index + 1,
        pageLabel: sheet.querySelector('.page-number').textContent,
        firstListStart: sheet.querySelector('ol').getAttribute('start'),
        direction: getComputedStyle(sheet.querySelector('ol')).direction
      }));
      // Negative controls exercise the actual production guard, not a test copy.
      // A green export is insufficient unless known broken layouts are rejected.
      const assertSourceGeometry = new Function('state', 'isEn',
        productionFunctions + '\nreturn assertPdfSourceGeometry;')(state, false);
      function expectRejection(label, change, restore) {
        change();
        let rejected = false;
        try { assertSourceGeometry(sheets); } catch (_) { rejected = true; }
        restore();
        if (!rejected) throw new Error('Production PDF guard accepted ' + label);
      }
      expectRejection('one saved logical page versus two physical sheets',
        () => { state.latestVersion.pages_html = [geometry[0].pageLabel]; },
        () => { state.latestVersion.pages_html = sheets.map(s =>
          s.querySelector('.doc-content').innerHTML); });
      expectRejection('incorrect printed page label',
        () => { sheets[1].querySelector('.page-number').textContent = 'الصفحة 1 من 2'; },
        () => { sheets[1].querySelector('.page-number').textContent = geometry[1].pageLabel; });
      const list = sheets[1].querySelector('ol');
      const priorDirection = list.style.direction;
      expectRejection('left-to-right Arabic numbered list',
        () => { list.style.direction = 'ltr'; },
        () => { list.style.direction = priorDirection; });
      assertSourceGeometry(sheets);
      return { captures, pdfBase64, geometry, negativeControls: 3 };
    }, productionFunctions);
    const pdf = Buffer.from(exported.pdfBase64, 'base64');
    const pdfPath = path.join(temp, 'candidate.pdf');
    fs.writeFileSync(pdfPath, pdf);
    const pdfinfo = poppler('pdfinfo', pdfPath);
    const pageCount = Number(pdfinfo.match(/^Pages:\s*(\d+)/m)?.[1]);
    report.pdfSha256 = sha256(pdf);
    report.pdfPageCount = pageCount;
    report.logicalSheets = exported.geometry.length;
    report.geometry = exported.geometry;
    if (pageCount !== 2 || exported.captures.length !== 2) {
      throw new Error('Actual jsPDF page count or html2canvas captures != 2');
    }
    for (let i = 0; i < pageCount; i++) {
      const prefix = path.join(temp, 'pdf-' + (i + 1));
      poppler('pdftoppm', '-f', String(i + 1), '-l', String(i + 1),
        '-singlefile', '-r', '96', '-png', pdfPath, prefix);
      const rendered = fs.readFileSync(prefix + '.png');
      const canvas = Buffer.from(exported.captures[i], 'base64');
      const compare = await compareStage(canvas, rendered);
      report.pages.push({ page: i + 1, canvasSha256: sha256(canvas),
        pdfRasterSha256: sha256(rendered), ...compare });
      if (compare.diffRatio > MAX_DIFF) {
        throw new Error('Real canvas and PDF raster differ on page ' + (i + 1) +
          ' by ' + compare.diffRatio);
      }
    }
    if (!report.geometry.every((g, i) => g.direction === 'rtl' &&
      g.firstListStart === String(i * 5 + 1) &&
      g.pageLabel === 'الصفحة ' + (i + 1) + ' من 2')) {
      throw new Error('Saved Arabic list direction or page number changed');
    }
    report.status = 'PASS';
    console.log('Actual html2canvas → jsPDF export: 2/2 pages and RTL numbering PASS');
  } catch (error) {
    report.status = 'FAIL';
    report.error = String(error.message || error);
    throw error;
  } finally {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n');
    await browser.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error('Actual official PDF export regression FAILED:', error.message);
  process.exitCode = 1;
});
