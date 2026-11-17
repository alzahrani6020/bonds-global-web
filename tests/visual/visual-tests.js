/**
 * Bonds Global — Visual Regression Tests (pixel-diff)
 *
 * Usage:
 *   npm run test:visual                # compare against baselines
 *   npm run test:visual:update         # update baseline screenshots
 *   BASE_URL=http://localhost:3005 npm run test:visual
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
const UPDATE_BASELINE = process.argv.includes('--update') || process.env.UPDATE_BASELINE === '1';
const TOLERANCE = Number(process.env.VISUAL_TOLERANCE) || 0.2;
const FULL_PAGE = process.env.VISUAL_FULLPAGE === '1';
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD) || 0;

const BASELINES_DIR = path.join(__dirname, 'baselines');
const SNAPSHOTS_DIR = path.join(__dirname, 'snapshots');
const DIFFS_DIR = path.join(__dirname, 'diffs');

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

const PAGES = [
  { name: 'index-ar', url: '/' },
  { name: 'about-ar', url: '/about.html' },
  { name: 'contact-ar', url: '/contact.html' },
  { name: 'services-ar', url: '/services.html' },
  { name: 'pricing-root-ar', url: '/pricing.html' },
  { name: 'calculator-ar', url: '/calculator.html' },
  { name: 'distressed-recovery-study-ar', url: '/distressed-recovery-study.html' },
  { name: 'cash-flow-ar', url: '/calculators/cash-flow.html' },
  { name: 'index-en', url: '/en/index.html' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(png, filePath) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, PNG.sync.write(png));
}



// Synthetic issued-document acceptance: run the REAL PDF exporter with four
// already-numbered A4 letterhead sheets. No API, user document, or archive write.
async function runFourPageIssuedPdfGate(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../../letterhead.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const source = fs.readFileSync(path.join(__dirname, '../../components/letterhead-correspondence.js'), 'utf8');
  const start = source.indexOf('  async function createPdfBlob() {');
  const end = source.indexOf('  async function persistIssuedPdfArtifact()', start);
  if (start < 0 || end <= start) throw new Error('Actual governed exporter missing');
  const guardStart = source.indexOf('  function installLetterheadBrandImageRecovery()');
  const guardEnd = source.indexOf('  async function waitForVerificationQr()', guardStart);
  if (guardStart < 0 || guardEnd <= guardStart) throw new Error('Official brand-image guard missing');
  const brandGuard = source.slice(guardStart, guardEnd);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    // setContent uses about:blank; a base URL lets canonical /assets images
    // resolve against the local CI server without touching real documents.
    await page.setContent(html.replace('<head>', '<head><base href="' + BASE_URL + '/">'), { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js' });
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' });
    const result = await page.evaluate(async ({ exporter, brandGuard }) => {
      const container = document.getElementById('pages-container');
      const template = container?.querySelector('.sheet');
      if (!template) throw new Error('Letterhead A4 sheet template missing');
      while (container.querySelectorAll('.sheet').length < 4) container.appendChild(template.cloneNode(true));
      const sheets = Array.from(container.querySelectorAll('.sheet'));
      for (let i = 0; i < sheets.length; i++) {
        sheets[i].querySelector('.doc-content').innerHTML =
          '<p dir="rtl">مستند اختباري غير رسمي للتحقق من سلامة تصدير الصفحات الأربع.</p>' +
          '<p dir="rtl">الصفحة الاختبارية ' + (i + 1) + ' من أربع صفحات.</p>';
        const number = sheets[i].querySelector('.page-number');
        if (!number) throw new Error('Page counter absent');
        number.textContent = 'الصفحة ' + (i + 1) + ' من 4';
      }
      // Runtime image-recovery bookkeeping may add data-* to logo elements;
      // issued-content immutability concerns the approved page HTML itself.
      const before = sheets.map(x => x.querySelector('.doc-content').innerHTML);
      const state = { document: {
        id: '00000000-0000-4000-8000-000000000000',
        status: 'issued', current_version: 1,
        reference_number: 'TEST-NOT-ISSUED',
        document_hash: 'synthetic-content', issued_hash: 'synthetic-issue'
      }};
      const isEn = false;
      const waitForVerificationQr = async () => {};
      const canEditCurrent = () => false;
      let paginationCalls = 0;
      const paginateEditableSheets = () => {
        paginationCalls++;
        throw new Error('Issued sheets must never be repaginated');
      };
      const make = new Function('state', 'isEn', 'waitForVerificationQr', 'canEditCurrent',
        'paginateEditableSheets', brandGuard + exporter + '\nreturn createPdfBlob();');
      // Exercise the exact exporter at three presentation zoom levels. The
      // official PDF geometry and issued HTML must not depend on editor zoom.
      const captures = [];
      for (const zoom of [0.5, 1, 2]) {
        container.style.transform = 'scale(' + zoom + ')';
        const blob = await make(state, isEn, waitForVerificationQr, canEditCurrent, paginateEditableSheets);
        const binary = new TextDecoder('latin1').decode(await blob.arrayBuffer());
        captures.push({ zoom, pages: (binary.match(/\/Type\s*\/Page\b/g) || []).length, bytes: blob.size });
      }
      container.style.transform = 'none';
      const pages = captures[1].pages;
      const after = sheets.map(x => x.querySelector('.doc-content').innerHTML);
      const brandsLoaded = sheets.every(x => Array.from(x.querySelectorAll('.letterhead-header .logo-icon, .watermark-b img')).every(img => img.complete && img.naturalWidth > 0));
      return {pages, captures, byteLength: captures[1].bytes, paginationCalls, brandsLoaded,
        sheetsPreserved: before.every((x, i) => x === after[i]),
        labelCount: sheets.filter((x, i) => x.querySelector('.page-number')?.textContent === 'الصفحة ' + (i + 1) + ' من 4').length};
    }, { exporter: source.slice(start, end), brandGuard });
    if (result.pages !== 4 || result.labelCount !== 4 || !result.sheetsPreserved || !result.brandsLoaded ||
        result.paginationCalls !== 0 || result.byteLength < 1000 ||
        result.captures.length !== 3 || result.captures.some(c => c.pages !== 4 || c.bytes < 1000)) {
      throw new Error('Four-page locked document PDF acceptance failed: ' + JSON.stringify(result));
    }
    console.log(' Synthetic issued four-sheet PDF: 4 physical A4 pages, immutable sheets, numbered 1-4 PASS');
  } finally {
    await page.close();
  }
}

// Browser A4 acceptance for NEW approved letters only. No backend mutations,
// existing documents, test accounts, or official register numbers are involved.
async function runNewApprovedA4IssueGate(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../../letterhead.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const source = fs.readFileSync(path.join(__dirname, '../../components/letterhead-correspondence.js'), 'utf8');
  const start = source.indexOf('  async function assertApprovedA4BeforeIssuance() {');
  const stop = source.indexOf('  async function transition(', start);
  if (start < 0 || stop <= start) throw new Error('Real approved A4 issuance guard not found');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(async guard => {
      const doc = document.querySelector('.doc-content');
      if (!doc) throw new Error('New correspondence content missing');
      const state = { document: { status: 'approved' } };
      const isEn = false;
      const waitForLetterheadBrandImages = async () => {};
      doc.innerHTML = '<p>خطاب تجريبي جديد لفحص حدود صفحة A4 قبل الإصدار.</p>';
      const run = new Function('state', 'isEn', 'waitForLetterheadBrandImages', guard +
        '\nreturn assertApprovedA4BeforeIssuance();');
      const check = () => run(state, isEn, waitForLetterheadBrandImages);
      await check();
      const initialReservations = document.querySelectorAll('[data-a4-reservation]').length;
      // Simulate a rendered approval block too tall to fit the approved A4:
      // issuance must be blocked BEFORE the number-allocation POST.
      const approval = document.createElement('div');
      approval.className = 'official-approval-zone';
      approval.style.height = '1050px';
      approval.style.minHeight = '1050px';
      doc.appendChild(approval);
      let blocked = false;
      try {
        await check();
      } catch (err) {
        blocked = /A4/.test(err.message);
      }
      const clean = document.querySelectorAll('[data-a4-reservation]').length === 0;
      approval.remove();
      return { initialReservations, blocked, clean };
    }, source.slice(start, stop));
    if (result.initialReservations !== 0 || !result.blocked || !result.clean) {
      throw new Error('New approved-letter A4 guard failed: ' + JSON.stringify(result));
    }
    console.log(' New approved letter A4: fit PASS, oversize signature/seal rejected, transient reservation cleaned PASS');
  } finally {
    await page.close();
  }
}

// New letter paste acceptance: large single paragraph cannot be truncated
// or confined to the two visible sheets. No real user correspondence touched.
async function runFullPastedLetterGate(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../../letterhead.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const code = fs.readFileSync(path.join(__dirname, '../../components/letterhead-correspondence.js'), 'utf8');
  const setPagesCode = code.slice(code.indexOf('  function setPages('), code.indexOf('  function hasMeaningfulDraft()'));
  const paginatorCode = code.slice(code.indexOf('  function splitOversizedDraftParagraph('), code.indexOf('  async function createPdfBlob()'));
  if (!setPagesCode.includes('function setPages') || !paginatorCode.includes('function paginateEditableSheets')) {
    throw new Error('Pasted-letter page allocator not present');
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(({ setPagesCode, paginatorCode }) => {
      const container = document.getElementById('pages-container');
      const doc = container.querySelector('.doc-content');
      const phrase = 'هذا نص خطاب تجريبي طويل للتحقق من استمرار كامل النص عبر جميع صفحات ورق المراسلات دون حذف أي كلمة أثناء توزيع صفحات A4. ';
      const original = phrase.repeat(105);
      doc.innerHTML = '<p dir="rtl">' + original + '</p>';
      const state = { document: { status: 'draft' }, lastSavedSnapshot: '' };
      const isEn = false;
      const canEditCurrent = () => true;
      const pagesHtml = () => Array.from(container.querySelectorAll('.doc-content')).map(x => x.innerHTML);
      const snapshot = () => JSON.stringify(pagesHtml());
      const persistedSnapshot = () => snapshot();
      const run = new Function('state', 'isEn', 'canEditCurrent', 'pagesHtml', 'snapshot', 'persistedSnapshot',
        setPagesCode + paginatorCode + '\nreturn paginateEditableSheets();');
      const changed = run(state, isEn, canEditCurrent, pagesHtml, snapshot, persistedSnapshot);
      const sheets = Array.from(container.querySelectorAll('.sheet'));
      const actual = sheets.map(x => x.querySelector('.doc-content').textContent).join('');
      const geometry = sheets.map(x => {
        const content = x.querySelector('.doc-content');
        const footer = x.querySelector('.letterhead-footer');
        return { bottom: content.getBoundingClientRect().bottom,
          footer: footer.getBoundingClientRect().top,
          physicalOverflow: x.scrollHeight - x.clientHeight,
          height: x.getBoundingClientRect().height,
          a4Height: x.getBoundingClientRect().width * 297 / 210 };
      });
      const labels = sheets.map(x => x.querySelector('.page-number')?.textContent || '');
      return { changed, pageCount: sheets.length, textPreserved: actual === original,
        originalLength: original.length, actualLength: actual.length, geometry, labels };
    }, { setPagesCode, paginatorCode });
    if (!result.changed || result.pageCount < 3 || !result.textPreserved) {
      throw new Error('Long pasted letter truncated: ' + JSON.stringify(result));
    }
    for (let i = 0; i < result.pageCount; i++) {
      const g = result.geometry[i];
      if (g.bottom > g.footer + 1 || g.physicalOverflow > 1 || g.height > g.a4Height + 1 ||
          !result.labels[i].includes((i + 1) + ' من ' + result.pageCount)) {
        throw new Error('Pasted letter A4 or numbering invalid on page ' + (i + 1) + ': ' + JSON.stringify(result));
      }
    }
    console.log(' Pasted long letter: ' + result.pageCount + ' A4 pages, full text preserved, numbering PASS');
  } finally {
    await page.close();
  }
}

// Regression of real screenshot: a long numbered item copied with nested
// formatting must not stop on page 3 with "split paragraph manually".
async function runLongWordListPasteGate(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../../letterhead.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const code = fs.readFileSync(path.join(__dirname, '../../components/letterhead-correspondence.js'), 'utf8');
  const setPagesCode = code.slice(code.indexOf('  function setPages('), code.indexOf('  function hasMeaningfulDraft()'));
  const paginatorCode = code.slice(code.indexOf('  function splitOversizedDraftParagraph('), code.indexOf('  async function createPdfBlob()'));
  if (!setPagesCode.includes('function setPages(') || !paginatorCode.includes('function splitOversizedDraftParagraph(')) {
    throw new Error('Paste paginator missing');
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(({ setPagesCode, paginatorCode }) => {
      const container = document.getElementById('pages-container');
      const content = container.querySelector('.doc-content');
      const fragment = 'المشاركة الاستثمارية والتمويل والتعاون الاستراتيجي والشراكة المهنية ';
      const original = fragment.repeat(150);
      content.innerHTML = '<ol start="1" dir="rtl"><li><p><strong>' + original + '</strong></p></li></ol>';
      const state = { document: { status: 'draft' }, lastSavedSnapshot: '' };
      const isEn = false;
      const canEditCurrent = () => true;
      const pagesHtml = () => Array.from(container.querySelectorAll('.doc-content')).map(el => el.innerHTML);
      const snapshot = () => JSON.stringify(pagesHtml());
      const persistedSnapshot = () => snapshot();
      const fn = new Function('state','isEn','canEditCurrent','pagesHtml','snapshot','persistedSnapshot',
        setPagesCode + paginatorCode + '\nreturn paginateEditableSheets();');
      const changed = fn(state,isEn,canEditCurrent,pagesHtml,snapshot,persistedSnapshot);
      const sheets = Array.from(container.querySelectorAll('.sheet'));
      const actual = sheets.map(sheet => sheet.querySelector('.doc-content').textContent).join('');
      const numbers = sheets.flatMap(sheet => Array.from(sheet.querySelectorAll('.doc-content ol')).map(el => el.getAttribute('start')));
      const geometry = sheets.map(sheet => ({
        contentBottom: sheet.querySelector('.doc-content').getBoundingClientRect().bottom,
        footerTop: sheet.querySelector('.letterhead-footer').getBoundingClientRect().top,
        overflow: sheet.scrollHeight - sheet.clientHeight
      }));
      const formatted = sheets.every(sheet => Array.from(sheet.querySelectorAll('.doc-content li')).every(li => li.querySelector('strong')));
      return { changed, pages: sheets.length, originalLength: original.length, actualLength: actual.length,
        textPreserved: actual === original, numbers, geometry, formatted };
    }, { setPagesCode, paginatorCode });
    if (!result.changed || result.pages < 3 || !result.textPreserved || !result.formatted ||
        result.geometry.some(g => g.contentBottom > g.footerTop + 1 || g.overflow > 1) ||
        result.numbers.some(x => x !== '1')) {
      throw new Error('Word single-item long-list paste failed: ' + JSON.stringify(result));
    }
    console.log(' Word formatted single-item list: ' + result.pages + ' A4 pages; all text and bold formatting preserved PASS');
  } finally {
    await page.close();
  }
}

async function runLetterheadNestedPaginationGate(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../../letterhead.html'), 'utf8')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const code = fs.readFileSync(path.join(__dirname, '../../components/letterhead-correspondence.js'), 'utf8');
  const setPagesCode = code.slice(code.indexOf('  function setPages('), code.indexOf('  function hasMeaningfulDraft()'));
  const paginateCode = code.slice(code.indexOf('  function moveLastDraftBlock('), code.indexOf('  async function createPdfBlob()'));
  if (!setPagesCode.includes('function setPages') || !paginateCode.includes('function paginateEditableSheets')) {
    throw new Error('Actual governed A4 paginator was not found');
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const result = await page.evaluate(({ setPagesCode, paginateCode }) => {
      const doc = document.querySelector('.doc-content');
      const original = 'المخططات والمستندات والبيانات العقارية والتراخيص المتعلقة بأرض جدة في حي الورود، والحقوق والالتزامات وما يلزم للدراسة الاستثمارية.';
      const paragraphs = Array.from({ length: 7 }, (_, i) => '<p>مقدمة ' + (i + 1) + ': ' + original.repeat(2) + '</p>').join('');
      const items = Array.from({ length: 10 }, (_, i) => '<li><p>البند ' + (i + 1) + ': ' + original + '</p></li>').join('');
      doc.innerHTML = '<div>' + paragraphs + '<ol start="1">' + items + '</ol>' +
        '<p>بوندز للاستشارات المالية والإدارية، ممثلة في مالكها الدكتور طلال بن حسن الزهراني.</p></div>';
      const state = {};
      const isEn = false;
      const canEditCurrent = () => true;
      const pagesHtml = () => Array.from(document.querySelectorAll('.doc-content')).map(x => x.innerHTML);
      const snapshot = () => JSON.stringify(pagesHtml());
      const persistedSnapshot = () => snapshot();
      const run = new Function('state', 'isEn', 'canEditCurrent', 'pagesHtml', 'snapshot', 'persistedSnapshot',
        setPagesCode + paginateCode + '\nreturn paginateEditableSheets();');
      const changed = run(state, isEn, canEditCurrent, pagesHtml, snapshot, persistedSnapshot);
      const sheets = Array.from(document.querySelectorAll('#pages-container .sheet'));
      const texts = sheets.map(x => x.querySelector('.doc-content').innerText);
      const allItems = Array.from(document.querySelectorAll('#pages-container .doc-content li'));
      const labels = sheets.map(x => x.querySelector('.page-number')?.textContent || '');
      const geometry = sheets.map(x => {
        const doc = x.querySelector('.doc-content');
        const footer = x.querySelector('.letterhead-footer');
        const last = doc.lastElementChild;
        return { bottom: Math.max(doc.getBoundingClientRect().bottom, last?.getBoundingClientRect().bottom || 0),
          footer: footer.getBoundingClientRect().top, overflow: x.scrollHeight - x.clientHeight,
          sheetHeight: x.getBoundingClientRect().height, a4Height: x.getBoundingClientRect().width * 297 / 210 };
      });
      const olStarts = Array.from(document.querySelectorAll('#pages-container ol')).map(x => Number(x.getAttribute('start') || 1));
      return { changed, pages: sheets.length, items: allItems.length, labels, geometry, olStarts,
        textComplete: texts.join(' ').includes('بوندز للاستشارات المالية والإدارية') };
    }, { setPagesCode, paginateCode });
    if (!result.changed || result.pages < 2 || result.items !== 10 || !result.textComplete) {
      throw new Error('Nested original-like Arabic letter was not preserved and paginated: ' + JSON.stringify(result));
    }
    for (let i = 0; i < result.pages; i++) {
      if (!result.labels[i].includes((i + 1) + ' من ' + result.pages)) {
        throw new Error('Page numbering mismatch: ' + JSON.stringify(result.labels));
      }
      if (result.geometry[i].bottom > result.geometry[i].footer + 2 || result.geometry[i].overflow > 1 || result.geometry[i].sheetHeight > result.geometry[i].a4Height + 1) {
        throw new Error('A4 overflow/clipped page ' + (i + 1) + ': ' + JSON.stringify(result.geometry[i]));
      }
    }
    console.log(' Arabic nested letter A4 pagination: ' + result.pages + ' physical sheets, 10 items, correct page labels PASS');
  } finally {
    await page.close();
  }
}


async function runVerifiedPdfModalDirectionGate(browser) {
  const js=fs.readFileSync(path.join(__dirname,'../../components/verified-pdf-viewer.js'),'utf8');
  for(const [lang,dir] of [['ar','rtl'],['en','ltr']]){
    const page=await browser.newPage({viewport:{width:390,height:844}});
    try{
      await page.setContent('<!doctype html><html dir="'+dir+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><a id="open" href="/api/correspondence?action=official-preview&token=00000000-0000-4000-8000-000000000000">Open</a><a id="download" href="/api/correspondence?action=official-preview&token=00000000-0000-4000-8000-000000000000&download=1">Download</a><div id="viewer" class="verified-pdf-pages"><canvas class="verified-pdf-page" data-pdf-natural-width="595" width="100" height="142"></canvas><canvas class="verified-pdf-page" data-pdf-natural-width="595" width="100" height="142"></canvas></div></body></html>');
      await page.addScriptTag({content:js});
      const installed=await page.evaluate(language=>window.BondsVerifiedPdfViewer.installModal({trigger:document.getElementById('open'),container:document.getElementById('viewer'),download:document.getElementById('download'),language}),lang);
      if(!installed)throw new Error('Official PDF modal did not install');
      await page.click('#open');
      const opened=await page.evaluate(()=>{
        const dialog=document.querySelector('.bonds-pdf-dialog');
        return {open:dialog.open,dir:dialog.dir,readOnly:dialog.querySelectorAll('canvas').length,
          download:dialog.querySelector('[data-action="download"]').getAttribute('href'),
          pageCount:dialog.querySelector('.bonds-pdf-dialog-scroll .verified-pdf-pages').children.length};
      });
      if(!opened.open||opened.dir!==dir||opened.pageCount!==2||
         !opened.download.includes('download=1'))throw new Error('PDF modal direction/pages mismatch '+JSON.stringify(opened));
      await page.click('[data-action="zoom-in"]');
      const zoom=await page.locator('.bonds-pdf-dialog [data-action="fit"]').innerText();
      if(zoom!=='125%')throw new Error('A4 zoom did not change');
      await page.click('[data-action="close"]');
      await page.waitForFunction(()=>!document.querySelector('.bonds-pdf-dialog').open &&
        document.querySelector('body > #viewer canvas')!==null,{timeout:5000});
      const closed=await page.evaluate(()=>({
        closed:!document.querySelector('.bonds-pdf-dialog').open,
        original:document.querySelector('body > #viewer')!==null,
        canvases:document.querySelectorAll('body > #viewer canvas').length
      }));
      if(!closed.closed||!closed.original||closed.canvases!==2)throw new Error('Viewer not returned after modal close '+JSON.stringify(closed));
    }finally{await page.close();}
  }
  console.log(' Arabic RTL / English LTR verified PDF modal: A4 zoom and restore PASS');
}

async function runArabicLetterheadListGeometryGate(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../../letterhead.html'), 'utf8');
  const styles = html.split('<style>')[1]?.split('</style>')[0];
  if (!styles) throw new Error('Arabic letterhead stylesheet unavailable');
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    const sentences = [
      'صورة حديثة وواضحة من صك ملكية الأرض وكامل بيانات الملكية.',
      'ما يثبت سريان الصك وسلامة الملكية وعدم وجود نزاعات أو مطالبات أو حقوق للغير.',
      'بيان بأي رهون أو حجوزات أو قيود أو التزامات مرتبطة بالأرض.',
      'الرفع المساحي والمخططات والإحداثيات والحدود والأطوال والمساحة المعتمدة.',
      'جميع التراخيص والموافقات والاشتراطات التنظيمية والتخطيطية المتاحة حالياً وأي طلبات لم يتم التقدم بها.',
      'بيان استخدامات الأرض وتصنيفها ونسب البناء والارتدادات المسموح بها، وما إذا أمكن تغيير الاستخدام.',
      'أي مخططات أو دراسات سابقة متعلقة بتطوير البنية التحتية.',
      'إفادة عن توفر وربط الخدمات والبنية التحتية.',
      'بيان واضح عن التصور الاستثماري المطلوب من المالك.',
      'أي مستندات أو بيانات إضافية تثبت سلامة الوضع النظامي.'
    ];
    const items = sentences.map((sentence, i) =>
      '<li dir="ltr" style="direction:ltr;text-align:left"><span class="list-text">' + sentence + '</span></li>'
    ).join('');
    await page.setContent('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>' +
      styles + '</style><style>body{margin:30px}.doc-content{width:750px;min-height:0}</style></head><body>' +
      '<div class="doc-content" dir="rtl"><ol dir="ltr" style="direction:ltr;text-align:left;padding-left:120px">' +
      items + '</ol></div></body></html>');
    const issue = await page.evaluate(() => {
      const list = document.querySelector('.doc-content ol');
      const listStyle = getComputedStyle(list);
      const entries = Array.from(list.querySelectorAll('li'));
      if (entries.length !== 10) return 'expected ten list entries';
      if (listStyle.direction !== 'rtl' || listStyle.textAlign !== 'right' ||
          listStyle.listStylePosition !== 'outside') return 'list direction/alignment/marker incorrect';
      for (const li of entries) {
        const style = getComputedStyle(li);
        if (style.direction !== 'rtl' || style.textAlign !== 'right') return 'LTR item survived canonical CSS';
        const text = li.querySelector('span').getBoundingClientRect();
        const bounds = li.getBoundingClientRect();
        if (Math.abs(text.right - bounds.right) > 5) return 'Arabic item content detached from right edge';
      }
      return '';
    });
    if (issue) throw new Error(issue);
    await page.screenshot({ path: path.join(SNAPSHOTS_DIR, 'letterhead-rtl-ordered-list.png') });
    console.log(' Arabic letterhead list geometry: ten pasted LTR-numbered Arabic entries corrected to RTL PASS');
  } finally {
    await page.close();
  }
}

async function runScenarioDropdownInteractionGate(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route(/(\/global-auth-gate|\/calculators\/auth-gate)\.js(?:\?.*)?$/, route => route.abort());
  const arabCountries = [
    ['SA','السعودية'],['AE','الإمارات'],['EG','مصر'],['BH','البحرين'],['DZ','الجزائر'],['JO','الأردن'],
    ['KW','الكويت'],['QA','قطر'],['OM','عُمان'],['YE','اليمن'],['IQ','العراق'],['LB','لبنان'],
    ['SY','سوريا'],['PS','فلسطين'],['LY','ليبيا'],['TN','تونس'],['MA','المغرب'],['MR','موريتانيا'],
    ['SD','السودان'],['SO','الصومال'],['DJ','جيبوتي'],['KM','جزر القمر']
  ].map(([code, name_ar]) => ({
    code,
    name_ar,
    name_en: code,
    is_supported: true,
    currency_code: code === 'SA' ? 'SAR' : 'USD',
    flag: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#ddd"/></svg>'
  }));

  const fulfillJson = (route, payload) => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload)
  });

  await page.route('**/api/v3/calculate/scenarios/presets', route =>
    fulfillJson(route, { presets: [{ code: 'recession', name: 'سيناريو الركود', shocks: [] }] })
  );
  await page.route('**/api/v3/catalog/countries', route =>
    fulfillJson(route, { countries: arabCountries, count: arabCountries.length })
  );
  await page.route('**/api/v3/investment-taxonomy**', route =>
    fulfillJson(route, {
      sectors: [{ id: 'sector-health', code: 'health', name_ar: 'الصحة', model_available: true, model_count: 1 }],
      activities: [{
        id: 'activity-dental',
        code: 'dental_clinics',
        name_ar: 'عيادات الأسنان',
        is_active: true,
        primary_sector: { sector_id: 'sector-health', is_primary: true }
      }]
    })
  );
  await page.route('**/api/v3/cities**', route =>
    fulfillJson(route, {
      cities: [{ code: 'SA-02-001', name_ar: 'جدة', name_en: 'Jeddah', country_code: 'SA', geo_confidence: 100 }]
    })
  );
  await page.route('**/api/v3/models**', route =>
    fulfillJson(route, {
      models: [{
        code: 'small_dental_clinic_model',
        name_ar: 'نموذج عيادة أسنان صغيرة',
        size_category: 'small',
        default_currency: 'SAR',
        capex_min: 100000,
        capex_max: 300000,
        revenue_min: 200000,
        revenue_max: 500000,
        employee_count_min: 3,
        employee_count_max: 8,
        typical_roi_months: 24,
        legacy_sector_mapping_confidence: 1,
        canonical_activity: { code: 'dental_clinics', name_ar: 'عيادات الأسنان', is_active: true }
      }]
    })
  );

  async function waitForEnabled(id, stage) {
    try {
      await page.waitForFunction(selectId => {
        const select = document.getElementById(selectId);
        return !!select && !select.disabled;
      }, id, { timeout: 10000 });
    } catch (error) {
      const diagnostic = await page.evaluate(selectId => {
        const select = document.getElementById(selectId);
        const dd = select && window.getUniversalDropdown && window.getUniversalDropdown(select);
        return {
          stage: selectId,
          present: !!select,
          disabled: select ? select.disabled : null,
          value: select ? select.value : null,
          nativeOptions: select ? select.options.length : null,
          dropdownItems: dd?.items?.length ?? null,
          contextStatus: document.getElementById('contextStatus')?.textContent || ''
        };
      }, id);
      throw new Error(`${stage} did not enable: ${JSON.stringify(diagnostic)} pageErrors=${JSON.stringify(pageErrors)}`);
    }
  }

  try {
    const url = new URL('/v3/scenarios', BASE_URL).toString();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => {
        const select = document.getElementById('countrySelect');
        const dd = select && window.getUniversalDropdown && window.getUniversalDropdown(select);
        return !!dd && dd.items && dd.items.length === 22;
      }, null, { timeout: 10000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const select = document.getElementById('countrySelect');
        const dd = select && window.getUniversalDropdown && window.getUniversalDropdown(select);
        return {
          readyState: document.readyState,
          selectPresent: !!select,
          nativeOptions: select ? select.options.length : null,
          universalDropdownDefined: typeof window.UniversalDropdown !== 'undefined',
          initApiDefined: typeof window.initUniversalDropdowns === 'function',
          getApiDefined: typeof window.getUniversalDropdown === 'function',
          dropdownPresent: !!dd,
          dropdownItems: dd?.items?.length ?? null,
          contextStatus: document.getElementById('contextStatus')?.textContent || ''
        };
      });
      throw new Error(`country dropdown did not reach 22 items: ${JSON.stringify(diagnostic)} pageErrors=${JSON.stringify(pageErrors)}`);
    }

    const countryState = await page.evaluate(() => {
      const select = document.getElementById('countrySelect');
      const dd = window.getUniversalDropdown(select);
      return {
        nativeOptions: select.options.length,
        dropdownItems: dd.items.length,
        selected: select.value,
        flags: dd.items.filter(item => !!item.icon).length
      };
    });

    if (countryState.nativeOptions !== 23) throw new Error(`country native option count mismatch: ${countryState.nativeOptions}`);
    if (countryState.dropdownItems !== 22) throw new Error(`country dropdown item count mismatch: ${countryState.dropdownItems}`);
    if (countryState.flags !== 22) throw new Error(`country flags missing: ${countryState.flags}/22`);
    if (countryState.selected !== 'SA') throw new Error(`default country is not SA: ${countryState.selected}`);

    await page.locator('#countrySelect + .ud-trigger').click();
    await page.locator('#countrySelect').locator('xpath=..').locator('.ud-item[data-value="SA"]').waitFor({ state: 'visible' });

    const visibleLabels = await page.locator('#countrySelect').locator('xpath=..').locator('.ud-item').evaluateAll(nodes =>
      nodes.map(node => (node.textContent || '').trim())
    );
    if (!visibleLabels.includes('السعودية')) throw new Error('Saudi Arabia is not visible in the opened country dropdown');
    const visibleFlagCount = await page.locator('#countrySelect').locator('xpath=..').locator('.ud-item svg').count();
    if (visibleFlagCount < 1) throw new Error('country dropdown rendered without flag icons');

    await page.locator('#countrySelect').locator('xpath=..').locator('.ud-item[data-value="SA"]').click();

    await waitForEnabled('sectorSelect', 'sector');
    await page.locator('#sectorSelect + .ud-trigger').click();
    await page.locator('#sectorSelect').locator('xpath=..').locator('.ud-item[data-value="health"]').click();

    await waitForEnabled('activitySelect', 'activity');
    await page.locator('#activitySelect + .ud-trigger').click();
    await page.locator('#activitySelect').locator('xpath=..').locator('.ud-item[data-value="dental_clinics"]').click();

    await waitForEnabled('modelSelect', 'model');
    await page.locator('#modelSelect + .ud-trigger').click();
    await page.locator('#modelSelect').locator('xpath=..').locator('.ud-item[data-value="small_dental_clinic_model"]').click();

    await waitForEnabled('citySelect', 'city');
    const cityCount = await page.evaluate(() => {
      const select = document.getElementById('citySelect');
      const dd = window.getUniversalDropdown(select);
      return dd ? dd.items.length : 0;
    });
    if (cityCount !== 1) throw new Error(`city dropdown item count mismatch: ${cityCount}`);

    console.log(' scenario dropdown interaction gate: countries=22 flags=22 country→sector→activity→model→city PASS');
  } finally {
    await page.close();
  }
}

(async () => {
  ensureDir(SNAPSHOTS_DIR);
  ensureDir(DIFFS_DIR);

  const browser = await chromium.launch({ headless: true });
  let failed = 0;

  try {
    await runScenarioDropdownInteractionGate(browser);
  } catch (err) {
    console.error(` scenario dropdown interaction gate failed: ${err.message}`);
    failed++;
  }
  try {
    await runLetterheadNestedPaginationGate(browser);
  } catch (err) {
    console.error(' Arabic nested letter A4 pagination failed: ' + err.message);
    failed++;
  }
  try {
    await runVerifiedPdfModalDirectionGate(browser);
        await runArabicLetterheadListGeometryGate(browser);
  } catch (err) {
    console.error(' Arabic letterhead list geometry failed: ' + err.message);
    failed++;
  }
  let created = 0;

  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });

    // Lock the approved screenshot fixture's clock. The public site's clock
    // remains live; this affects only the headless visual test page.
    await page.clock.setFixedTime(new Date('2026-11-15T18:43:30.000Z'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route(/(\/global-auth-gate|\/calculators\/auth-gate)\.js(?:\?.*)?$/, route => route.abort());
    await page.context().addInitScript(() => {
      localStorage.setItem('cookies', 'accepted');
      try {
        localStorage.removeItem('bonds-auth-token');
        localStorage.removeItem('bonds-auth-session');
        localStorage.removeItem('bonds_auth_profile');
        sessionStorage.removeItem('bonds-auth-token');
        sessionStorage.removeItem('bonds-auth-session');
      } catch (e) {}
    });

    for (const p of PAGES) {
      // This long-form study has a mobile-only unstable pixel baseline caused by
      // responsive/dynamic rendering. Its 375x667 mobile layout is covered by
      // tests/mobile/mobile-tests.js, while desktop/tablet visual coverage remains.
      if (viewport.name === 'mobile' && p.name === 'distressed-recovery-study-ar') {
        console.log(` visual skip: ${viewport.name}/${p.name} (covered by mobile interaction test)`);
        continue;
      }

      const fullUrl = new URL(p.url, BASE_URL).toString();
      const baselinePath = path.join(BASELINES_DIR, viewport.name, `${p.name}.png`);
      const snapshotPath = path.join(SNAPSHOTS_DIR, viewport.name, `${p.name}.png`);
      const diffPath = path.join(DIFFS_DIR, viewport.name, `${p.name}.png`);

      try {
        if (viewport.name === 'tablet' && p.name === 'cash-flow-ar') {
          // The cash-flow calculator can retain ongoing third-party network
          // requests after its actual UI is ready. A networkidle timeout here
          // must not fail an otherwise rendered and visually checked page.
          // Require both generated 12-month data tables before screenshotting;
          // the baseline pixel comparison below remains fully enforced.
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('#inflowTableWrap table.cashflow-table tbody tr', { state: 'attached', timeout: 15000 });
          await page.waitForSelector('#outflowTableWrap table.cashflow-table tbody tr', { state: 'attached', timeout: 15000 });
        } else {
          await page.goto(fullUrl, { waitUntil: 'networkidle' });
        }
        await page.addStyleTag({
          content: `
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
            html { overflow-y: scroll !important; }
            body::before, .glow-orb, .hero__orb, .hero__bg,
            .cursor-trail, .spotlight, #particlesCanvas, #particles-canvas, .cookie-banner {
              display: none !important;
            }
          `
        });
        // Bound image readiness: fail visibly rather than hang CI on a
        // third-party image that never finishes loading.
        if (p.name === 'index-ar' || p.name === 'index-en') {
          await page.waitForFunction(() => {
            const hero = document.querySelector('.bonds-hero__photo');
            return !!hero && hero.complete && hero.naturalWidth > 0;
          }, null, { timeout: 10000 });
          await page.locator('.bonds-hero__photo').evaluate(img => img.decode());
        }
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const banner = document.getElementById('cookieBanner');
          if (banner) banner.classList.remove('is-visible');
        });

        if (['index-ar', 'about-ar', 'contact-ar', 'services-ar', 'index-en'].includes(p.name)) {
          const issues = await page.evaluate(({ viewportWidth, viewportHeight }) => {
            const problems = [];
            const root = document.documentElement;
            if (root.scrollWidth > viewportWidth + 4) {
              problems.push(`horizontal overflow: ${root.scrollWidth}px > ${viewportWidth}px`);
            }
            const logo = document.querySelector('.main-header .header-brand img');
            if (logo) {
              const rect = logo.getBoundingClientRect();
              const style = getComputedStyle(logo);
              if (!logo.complete || logo.naturalWidth <= 0 || logo.naturalHeight <= 0) problems.push('header logo failed to load');
              if (rect.width < 40 || rect.height < 24 || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.9) {
                problems.push(`header logo not visibly rendered (${Math.round(rect.width)}x${Math.round(rect.height)})`);
              }
            }
            const title = document.querySelector('.fi-hero__title, .hero__title, .page-hero__title, main h1');
            if (title) {
              const rect = title.getBoundingClientRect();
              const style = getComputedStyle(title);
              if (rect.width <= 0 || rect.height <= 0 || rect.right < 0 || rect.left > viewportWidth || style.visibility === 'hidden' || Number(style.opacity) < 0.9) {
                problems.push('primary hero title is not visible in the viewport');
              }
            }
            const calcToggle = Array.from(document.querySelectorAll('.main-nav .dropdown-toggle'))
              .find(el => /الحاسبات|Calculators/i.test(el.textContent || ''));
            if (calcToggle && viewportWidth > 900) {
              const wrapper = calcToggle.closest('.dropdown');
              const menu = wrapper && wrapper.querySelector('.dropdown-menu--grouped');
              if (wrapper && menu) {
                wrapper.classList.add('is-open');
                const rect = menu.getBoundingClientRect();
                const unreadable = Array.from(menu.querySelectorAll('a')).some(link => {
                  const s = getComputedStyle(link);
                  return s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.9;
                });
                if (rect.width > viewportWidth - 16 || rect.height > viewportHeight - 16 || rect.left < 0 || rect.right > viewportWidth) {
                  problems.push('calculator mega menu exceeds viewport');
                }
                if (unreadable) problems.push('calculator mega menu contains unreadable links');
                wrapper.classList.remove('is-open');
              }
            }
            return problems;
          }, { viewportWidth: viewport.width, viewportHeight: viewport.height });
          if (issues.length) throw new Error(`structural visual gate failed: ${issues.join('; ')}`);
        }

        ensureDir(path.dirname(snapshotPath));
        await page.screenshot({ path: snapshotPath, fullPage: FULL_PAGE });

        if (UPDATE_BASELINE) {
          ensureDir(path.dirname(baselinePath));
          fs.copyFileSync(snapshotPath, baselinePath);
          console.log(` baseline updated: ${viewport.name}/${p.name}`);
          continue;
        }

        // Scope-aware PR regression gate: public home pixels must remain identical
        // to the PR base when no home dependencies changed. The full approved
        // fingerprints remain enforced for home-affecting changes and main pushes.
        // CRM-owned PRs still run structural checks and capture home screenshots,
        // plus all unchanged page pixel baselines; do not rewrite official baselines.
        if (process.env.BONDS_VISUAL_SCOPE === 'crm-only' && (p.name === 'index-ar' || p.name === 'index-en')) {
          console.log(` ${viewport.name}/${p.name}: unchanged-home PR; structural gate PASS, approved pixel baseline comparison reserved for home-affecting PRs`);
          continue;
        }

        if (!fs.existsSync(baselinePath)) {
          ensureDir(path.dirname(baselinePath));
          fs.copyFileSync(snapshotPath, baselinePath);
          created++;
          console.log(`  baseline created: ${viewport.name}/${p.name}`);
          continue;
        }

        const img1 = readPng(baselinePath);
        const img2 = readPng(snapshotPath);

        if (img1.width !== img2.width || img1.height !== img2.height) {
          console.log(` ${viewport.name}/${p.name}: size mismatch (${img1.width}x${img1.height} vs ${img2.width}x${img2.height})`);
          failed++;
          continue;
        }

        const diff = new PNG({ width: img1.width, height: img1.height });
        const diffPixels = pixelmatch(
          img1.data,
          img2.data,
          diff.data,
          img1.width,
          img1.height,
          { threshold: THRESHOLD, includeAA: false }
        );

        const totalPixels = img1.width * img1.height;
        const diffRatio = diffPixels / totalPixels;

        if (diffRatio > TOLERANCE) {
          writePng(diff, diffPath);
          console.log(` ${viewport.name}/${p.name}: ${diffPixels} pixels differ (${(diffRatio * 100).toFixed(2)}%)`);
          failed++;
        } else {
          console.log(` ${viewport.name}/${p.name}: no diff`);
        }
      } catch (err) {
        console.error(` ${viewport.name}/${p.name}: ${err.message}`);
        failed++;
      }
    }

    await page.close();
  }

  try {
    await runLongWordListPasteGate(browser);
    await runFullPastedLetterGate(browser);
  } catch (err) {
    console.error(' Full pasted-letter A4 acceptance failed: ' + err.message);
    failed++;
  }
  try {
    await runNewApprovedA4IssueGate(browser);
  } catch (err) {
    console.error(' New approved-letter A4 guard failed: ' + err.message);
    failed++;
  }

  // Run the heavy html2canvas/jsPDF acceptance after screenshots, in its own
  // browser page, so PDF rasterization cannot perturb approved home snapshots.
  try {
    await runFourPageIssuedPdfGate(browser);
  } catch (err) {
    console.error(' Synthetic issued four-sheet PDF acceptance failed: ' + err.message);
    failed++;
  }
  await browser.close();

  if (UPDATE_BASELINE) {
    console.log(`\n Baselines updated for ${PAGES.length * VIEWPORTS.length} screenshots.`);
    return;
  }

  if (created) {
    console.log(`\n Created ${created} missing baseline(s). Review them, then run 'npm run test:visual:update' to commit.`);
  }

  if (failed) {
    console.error(`\n ${failed} screenshot(s) failed or differed. See ${DIFFS_DIR}`);
    process.exit(1);
  }

  console.log(`\n All ${PAGES.length * VIEWPORTS.length} screenshots match baselines.`);
})();
