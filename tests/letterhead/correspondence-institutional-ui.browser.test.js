'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const script = fs.readFileSync(path.join(root, 'components/correspondence-workspace-ui.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'components/correspondence-workspace-ui.css'), 'utf8');
const fixture = `<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<button class="preview-exit" type="button">Preview</button>
<div class="toolbar" id="letterhead-toolbar"><div class="toolbar-header">Original tools</div><div class="toolbar-row"><button type="button">Format</button></div></div>
<div id="pages-container"><article class="sheet" style="width:210mm;min-height:297mm;background:#fff" data-page="1"><div id="official-document">OFFICIAL A4 DOCUMENT</div></article></div>
</body></html>`;

describe('Correspondence UI real browser layout', () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30000);
  afterAll(async () => { if (browser) await browser.close(); }, 30000);

  async function open(width, height) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.route('**/letterhead.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: fixture }));
    await page.goto('https://bonds-ui-preview.invalid/letterhead.html?workspace=correspondence');
    await page.addStyleTag({ content: styles });
    await page.addScriptTag({ content: script });
    await page.locator('#bx-workspace-shell').waitFor();
    return page;
  }

  test('desktop: RTL navigation, editor, and live register preserve original A4 content', async () => {
    const page = await open(1440, 900);
    try {
      const [nav, editor, panel] = await Promise.all(['.bx-nav','.bx-editor','.bx-panel'].map(s => page.locator(s).boundingBox()));
      expect(nav.x).toBeGreaterThan(editor.x);
      expect(editor.x).toBeGreaterThan(panel.x);
      expect(await page.locator('#official-document').textContent()).toBe('OFFICIAL A4 DOCUMENT');
      expect(await page.locator('#pages-container .sheet').count()).toBe(1);
      expect(await page.locator('.bx-metric').count()).toBe(6);
      expect(await page.locator('.bx-metric strong').first().textContent()).toBe('—');

      const toggle = page.locator('.bx-advanced-toggle');
      expect(await toggle.getAttribute('aria-expanded')).toBe('false');
      await toggle.click();
      expect(await toggle.getAttribute('aria-expanded')).toBe('true');
      expect(await page.locator('.toolbar-row').isVisible()).toBe(true);

      // Simulate governance bar rendered later by the existing engine.
      await page.evaluate(() => {
        const bar = document.createElement('section');
        bar.id = 'correspondence-governance';
        bar.textContent = 'Governed workflow';
        document.getElementById('pages-container').before(bar);
      });
      await page.waitForFunction(() => document.querySelector('.bx-editor > #correspondence-governance'));
    } finally { await page.close(); }
  }, 30000);

  test('mobile: navigation remains usable and document does not expand the viewport', async () => {
    const page = await open(390, 844);
    try {
      const nav = await page.locator('.bx-nav').boundingBox();
      const editor = await page.locator('.bx-editor').boundingBox();
      const panel = await page.locator('.bx-panel').boundingBox();
      expect(nav.y).toBeLessThan(editor.y);
      expect(editor.y).toBeLessThan(panel.y);
      const horizontal = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        paneOverflow: getComputedStyle(document.querySelector('.bx-document-area')).overflowX
      }));
      expect(horizontal.pageWidth).toBeLessThanOrEqual(horizontal.viewportWidth + 4);
      expect(horizontal.paneOverflow).toBe('auto');
    } finally { await page.close(); }
  }, 30000);

  test('non-workspace letterhead is unchanged', async () => {
    const page = await browser.newPage();
    try {
      await page.route('**/letterhead.html*', route => route.fulfill({ status: 200, contentType: 'text/html', body: fixture }));
      await page.goto('https://bonds-ui-preview.invalid/letterhead.html');
      await page.addStyleTag({ content: styles });
      await page.addScriptTag({ content: script });
      expect(await page.locator('#bx-workspace-shell').count()).toBe(0);
      expect(await page.locator('#official-document').count()).toBe(1);
    } finally { await page.close(); }
  }, 30000);
});
