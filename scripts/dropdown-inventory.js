/**
 * Dropdown inventory: scans all HTML pages for Universal Dropdown usage,
 * visits each one, and reports whether the country/sector selector is
 * closed-by-default, absolutely positioned, and does not expand the body.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.argv[2] || 'http://localhost:3005';
const PROJECT_ROOT = path.resolve(__dirname, '..');

function discoverUdPages() {
  const pages = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.vercel', 'tmp-crawler', 'tmp', 'tests'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const text = fs.readFileSync(full, 'utf-8');
        if (text.includes('universal-dropdown.js') && text.includes('data-universal-dropdown')) {
          const rel = '/' + path.relative(PROJECT_ROOT, full).replace(/\\/g, '/');
          pages.push(rel.replace(/\/index\.html$/, '/'));
        }
      }
    }
  }
  walk(PROJECT_ROOT);
  return [...new Set(pages)].sort();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'ar' });
  await context.route(/global-auth-gate\.js/, route => route.abort());
  const pages = discoverUdPages();
  const results = [];
  for (const p of pages) {
    const page = await context.newPage();
    try {
      await page.goto(new URL(p, BASE_URL).toString(), { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      const state = await page.evaluate(() => {
        const wrap = document.querySelector('.ud-dropdown');
        if (!wrap) return { found: false };
        const menu = wrap.querySelector('.ud-menu');
        const native = wrap.querySelector('select.ud-native-fallback');
        const csMenu = menu ? getComputedStyle(menu) : null;
        const csNative = native ? getComputedStyle(native) : null;
        return {
          found: true,
          menuExists: !!menu,
          menuOpen: menu ? menu.classList.contains('ud-open') : false,
          menuVisible: csMenu ? csMenu.visibility === 'visible' && csMenu.opacity !== '0' : false,
          menuPosition: csMenu ? csMenu.position : null,
          menuMaxHeight: csMenu ? csMenu.maxHeight : null,
          nativeDisplay: csNative ? csNative.display : null,
          bodyHeight: document.body.scrollHeight,
          viewportHeight: window.innerHeight,
          overflowX: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) > window.innerWidth,
        };
      });
      const pass = state.found && !state.menuVisible && ['absolute','fixed'].includes(state.menuPosition) && state.nativeDisplay === 'none' && !state.overflowX;
      results.push({ path: p, ...state, pass });
      console.log(`${pass ? 'PASS' : 'FAIL'} ${p}`);
    } catch (e) {
      results.push({ path: p, error: e.message, pass: false });
      console.log(`FAIL ${p} — ${e.message}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log(`\nTotal: ${results.length}, Passed: ${passed}, Failed: ${results.length - passed}`);
  fs.writeFileSync(path.join(PROJECT_ROOT, 'dropdown-inventory.json'), JSON.stringify(results, null, 2));
})();
