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
      // The original 75-action toolbar must not disappear when the workspace mounts.
      expect(await toggle.getAttribute('aria-expanded')).toBe('true');
      expect(await page.locator('.toolbar-row').isVisible()).toBe(true);
      await toggle.click();
      expect(await toggle.getAttribute('aria-expanded')).toBe('false');
      expect(await page.locator('.toolbar-row').isVisible()).toBe(false);
      await toggle.click();
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

  test('workflow actions respect canonical inline visibility and choose saved draft submission', async () => {
    const page = await open(1440, 900);
    try {
      await page.evaluate(() => {
        window.__actions = [];
        for (const id of ['corr-save','corr-save-submit','corr-submit']) {
          const b = document.createElement('button');
          b.id = id;
          b.type = 'button';
          b.textContent = id;
          b.addEventListener('click', () => window.__actions.push(id));
          document.body.append(b);
        }
        // The canonical engine hides save-submit for an already-saved draft.
        document.getElementById('corr-save-submit').style.display = 'none';
      });
      await page.getByRole('button', { name: 'إرسال للمراجعة' }).click();
      expect(await page.evaluate(() => window.__actions)).toEqual(['corr-submit']);
      // A fresh draft must use save-submit instead.
      await page.evaluate(() => {
        document.getElementById('corr-save-submit').style.display = '';
        document.getElementById('corr-submit').style.display = 'none';
      });
      await page.getByRole('button', { name: 'إرسال للمراجعة' }).click();
      expect(await page.evaluate(() => window.__actions)).toEqual(['corr-submit', 'corr-save-submit']);
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

  test('correspondence navigation keeps Arabic company context without entering CRM', async () => {
    const companyId='11111111-1111-4111-8111-111111111111';
    for (const [label,destination] of [
      ['مركز الحملات','correspondence-campaigns.html'],
      ['دليل الجهات','institutional-directory.html']
    ]) {
      const page=await browser.newPage();
      try {
        await page.route('**/letterhead.html*',route=>route.fulfill({status:200,contentType:'text/html',body:fixture}));
        await page.route('**/'+destination+'*',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Destination</title>'}));
        await page.goto('https://bonds-ui-preview.invalid/letterhead.html?workspace=correspondence&workspace_id='+companyId);
        await page.addStyleTag({content:styles});
        await page.addScriptTag({content:script});
        await page.locator('.bx-nav button').filter({hasText:label}).click();
        await page.waitForURL(u=>u.pathname==='/'+destination);
        expect(new URL(page.url()).searchParams.get('workspace_id')).toBe(companyId);
      }finally{await page.close();}
    }
  },30000);

  test('register search does not invoke a disabled governed action', async () => {
    const page=await open(1440,900);
    try {
      await page.evaluate(()=>{
        window.__registerSearches=0;
        const open=document.createElement('button');open.id='corr-command-open';open.addEventListener('click',()=>{});
        const search=document.createElement('input');search.id='corr-command-search';
        const action=document.createElement('button');action.id='corr-command-search-btn';
        action.disabled=true;action.addEventListener('click',()=>{window.__registerSearches++});
        document.body.append(open,search,action);
        window.alert=()=>{};
      });
      await page.locator('.bx-search').fill('Test letter');
      await page.getByRole('button',{name:'البحث في السجل'}).click();
      expect(await page.evaluate(()=>window.__registerSearches)).toBe(0);
      await page.evaluate(()=>{document.getElementById('corr-command-search-btn').disabled=false});
      await page.getByRole('button',{name:'البحث في السجل'}).click();
      expect(await page.evaluate(()=>window.__registerSearches)).toBe(1);
      expect(await page.locator('#corr-command-search').inputValue()).toBe('Test letter');
    }finally{await page.close();}
  },30000);

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
