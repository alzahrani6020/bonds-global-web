/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://header-regression.test';
const HEIGHT = 900;
const NAMES = {
  ar: 'المؤسسة الدولية للاستثمار والاستشارات المالية وإدارة المشروعات اسم مستخدم طويل للغاية',
  en: 'International Investment and Financial Advisory Institution Extremely Long User Name'
};
const RUNTIME_SCRIPTS = new Set([
  '/site-layout.js', '/bonds-auth-2026.js',
  '/components/emoji-icons.js', '/components/emoji-renderer.js'
]);
const MIME = {
  '.css': 'text/css', '.js': 'application/javascript', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png'
};
const assets = new Map();
let browser;

// Only identity/data are synthetic; the actual auth renderer and shared header run.
function installIdentity({ name }) {
  const user = {
    id: '00000000-0000-4000-8000-000000000197',
    email: 'header-layout-fixture@example.invalid',
    user_metadata: { restaurant_name: name }
  };
  const session = { user, access_token: 'synthetic-layout-fixture-not-a-real-token', expires_at: 4102444800 };
  const profile = { id: user.id, restaurant_name: name, tier: 'enterprise' };
  const client = {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      refreshSession: async () => ({ data: { session }, error: null }),
      onAuthStateChange(callback) {
        setTimeout(() => callback('INITIAL_SESSION', session), 0);
        return { data: { subscription: { unsubscribe() {} } } };
      }
    },
    from(table) {
      const result = {
        data: table === 'profiles' ? profile : table === 'subscriptions' ? { tier: 'enterprise', status: 'active' } : [],
        error: null
      };
      const query = {
        select() { return query; }, eq() { return query; }, order() { return query; }, limit() { return query; },
        single: async () => result, maybeSingle: async () => result,
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
      };
      return query;
    }
  };
  window.__ENV = { SUPABASE_URL: 'https://layout-fixture.invalid', SUPABASE_ANON_KEY: 'synthetic-layout-fixture' };
  window.__BONDS_SUPABASE_CLIENT__ = client;
  window.supabase = { createClient: () => client };
  localStorage.setItem('bonds-auth-token', JSON.stringify(session));
}

async function openFixture({ lang, width, homepage = true, toolbar = false }) {
  const context = await browser.newContext({
    viewport: { width, height: HEIGHT }, reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  await context.addInitScript(installIdentity, { name: NAMES[lang] });
  const sourcePath = (lang === 'en' ? 'en/' : '') + (homepage ? 'index.html' : 'calculators/feasibility-template.html');
  // Preserve the real pages' stylesheet order and language-specific fonts while
  // leaving calculator/business markup and scripts outside this layout fixture.
  const source = fs.readFileSync(path.join(ROOT, sourcePath), 'utf8');
  const styles = [...source.matchAll(/<link\b[^>]*>/gi)]
    .map(match => match[0]).filter(link => /\brel=["']stylesheet["']/i.test(link)).join('\n');
  const html = `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    ${styles}
    </head><body${homepage ? ' class="fi-page"' : ''}>
    <div id="site-header"></div>
    ${toolbar ? `<div class="template-toolbar"><button type="button">${lang === 'ar' ? 'طباعة النموذج' : 'Print template'}</button>
      <button type="button">${lang === 'ar' ? 'حفظ النموذج' : 'Save template'}</button>
      <button type="button">${lang === 'ar' ? 'معاينة النموذج' : 'Preview template'}</button></div>
      <div class="template-wrapper"><section id="following-page" class="template-page" style="min-height:1800px">Layout fixture</section></div>`
      : '<main style="min-height:1800px">Header layout fixture</main>'}
    <script src="/bonds-auth-2026.js"></script><script defer src="/site-layout.js"></script>
    </body></html>`;

  await context.route('**/*', route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) return route.abort();
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ contentType: 'application/json', body: '{"data":[],"success":true,"tier":"enterprise","used":0}' });
    }
    // Unrelated business/analytics scripts are outside this header-only fixture.
    if (request.resourceType() === 'script' && !RUNTIME_SCRIPTS.has(url.pathname)) {
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    }
    const filename = path.resolve(ROOT, '.' + url.pathname);
    if (!filename.startsWith(ROOT + path.sep) || !MIME[path.extname(filename)] || !fs.existsSync(filename)) {
      return route.abort();
    }
    if (!assets.has(filename)) assets.set(filename, fs.readFileSync(filename));
    return route.fulfill({ contentType: MIME[path.extname(filename)], body: assets.get(filename) });
  });

  const page = await context.newPage();
  page.setDefaultTimeout(2500);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(ORIGIN + '/' + sourcePath, { waitUntil: 'load', timeout: 10000 });
    await page.locator('#authContainer .bonds-user-menu').waitFor({ state: 'attached', timeout: 5000 });
    await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet));
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    expect(await page.evaluate(() => [...document.fonts].filter(font => font.status === 'error').map(font => font.family))).toEqual([]);
    await waitForHeaderMeasure(page);
    return { context, page, errors };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function waitForHeaderMeasure(page) {
  await page.waitForFunction(() => {
    const header = document.getElementById('header');
    return header && Math.abs(parseFloat(document.body.style.paddingTop) - header.offsetHeight) <= 1;
  });
  await page.waitForFunction(() => {
    // Viewport changes can animate top/visibility even under reduced motion.
    // Wait for the actual finite transitions instead of sampling mid-animation.
    const targets = [document.getElementById('header'), document.querySelector('.template-toolbar')].filter(Boolean);
    return document.fonts.status === 'loaded' && targets.every(element =>
      element.getAnimations({ subtree: true }).every(animation =>
        !Number.isFinite(animation.effect.getComputedTiming().endTime) || animation.playState === 'finished'));
  });
}

function measureHeader() {
  function pick(selector) {
    const element = document.querySelector(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
      visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      position: style.position, top: style.top, overflow: style.overflow,
      textOverflow: style.textOverflow, whiteSpace: style.whiteSpace,
      maxWidth: style.maxWidth, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth
    };
  }
  const parts = {
    header: pick('#header'), brand: pick('.header-brand'), nav: pick('#mainNav'),
    actions: pick('.header-actions'), auth: pick('#authContainer'), toggle: pick('#navToggle'),
    lang: pick('.lang-switch'), cta: pick('#headerCtaBtn'),
    name: pick('#authContainer .bonds-user-menu > span:first-of-type'),
    toolbar: pick('.template-toolbar'), following: pick('#following-page')
  };
  const overlap = (a, b) => a?.visible && b?.visible &&
    Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
  const collisions = [['brand', 'nav'], ['brand', 'actions'], ['nav', 'actions'], ['auth', 'lang'], ['auth', 'cta'], ['auth', 'toggle']]
    .filter(([a, b]) => overlap(parts[a], parts[b]));
  const outside = ['brand', 'nav', 'actions', 'auth', 'toggle', 'lang', 'cta']
    .filter(key => parts[key]?.visible && (parts[key].x < -1 || parts[key].right > innerWidth + 1 ||
      parts[key].y < parts.header.y - 1 || parts[key].bottom > parts.header.bottom + 1));
  return { width: innerWidth, height: innerHeight, scrollY, parts, collisions, outside };
}

describe('parsed authenticated header responsive behavior', () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30000);
  afterAll(async () => { if (browser) await browser.close(); });

  test.each(['ar', 'en'])('%s navigation changes interaction at the actual 1280px boundary', async lang => {
    const fixture = await openFixture({ lang, width: 375 });
    const { page } = fixture;
    try {
      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: HEIGHT });
        await waitForHeaderMeasure(page);
        expect(await page.locator('#navToggle').isVisible()).toBe(true);
        expect(await page.locator('#mainNav').isVisible()).toBe(false);
        await page.locator('#navToggle').click();
        await page.locator('#mainNav').waitFor({ state: 'visible' });
        const { parts } = await page.evaluate(measureHeader);
        expect(parts.nav.x).toBeGreaterThanOrEqual(-1);
        expect(parts.nav.right).toBeLessThanOrEqual(width + 1);
        expect(Math.abs(parts.nav.height - HEIGHT)).toBeLessThanOrEqual(1);

        const dropdown = page.locator('.main-header .dropdown').first();
        const toggle = dropdown.locator('.dropdown-toggle');
        const menu = dropdown.locator(':scope > .dropdown-menu');
        await toggle.hover();
        // Exceed the real 140ms hover timer: compact navigation must remain click-only.
        await page.waitForTimeout(250);
        expect(await toggle.getAttribute('aria-expanded')).toBe('false');
        expect(await menu.isVisible()).toBe(false);
        await toggle.click();
        await menu.waitFor({ state: 'visible' });
        expect(await toggle.getAttribute('aria-expanded')).toBe('true');
        const item = menu.locator('a').first();
        await waitForHeaderMeasure(page);
        const itemBounds = await item.boundingBox();
        const navBounds = await page.locator('#mainNav').boundingBox();
        expect(itemBounds.x).toBeGreaterThanOrEqual(navBounds.x - 1);
        expect(itemBounds.x + itemBounds.width).toBeLessThanOrEqual(navBounds.x + navBounds.width + 1);
        expect(itemBounds.y).toBeGreaterThanOrEqual(navBounds.y - 1);
        expect(itemBounds.y + itemBounds.height).toBeLessThanOrEqual(navBounds.y + navBounds.height + 1);
        const destination = await item.getAttribute('href');
        await item.evaluate(element => {
          window.__clickedHeaderLink = null;
          element.addEventListener('click', event => {
            event.preventDefault();
            window.__clickedHeaderLink = element.getAttribute('href');
          }, { once: true });
        });
        await item.click();
        expect(await page.evaluate(() => window.__clickedHeaderLink)).toBe(destination);
        await page.locator('#mainNav').waitFor({ state: 'hidden' });
        // Navigation is prevented for this fixture. Use the real outside-click
        // close path so the next viewport starts without a retained submenu.
        await page.mouse.click(width - 2, HEIGHT - 2);
        expect(await toggle.getAttribute('aria-expanded')).toBe('false');
      }

      await page.setViewportSize({ width: 1281, height: HEIGHT });
      await waitForHeaderMeasure(page);
      expect(await page.locator('#navToggle').isVisible()).toBe(false);
      expect(await page.locator('#mainNav').isVisible()).toBe(true);
      const desktop = await page.evaluate(measureHeader);
      expect(desktop.parts.auth.visible).toBe(false);
      expect(desktop.collisions).toEqual([]);
      expect(desktop.outside).toEqual([]);
      const dropdown = page.locator('.main-header .dropdown').first();
      const toggle = dropdown.locator('.dropdown-toggle');
      const menu = dropdown.locator(':scope > .dropdown-menu');
      expect(await menu.isVisible()).toBe(false);
      await toggle.hover();
      await menu.waitFor({ state: 'visible' });
      expect(await toggle.getAttribute('aria-expanded')).toBe('true');
      await toggle.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      expect(await toggle.getAttribute('aria-expanded')).toBe('false');
      expect(fixture.errors).toEqual([]);
    } finally {
      await fixture.context.close();
    }
  }, 30000);

  test.each([
    ['ar', true], ['en', true], ['ar', false], ['en', false]
  ])('%s long authenticated names remain clipped without header overlap (homepage=%s)', async (lang, homepage) => {
    const fixture = await openFixture({ lang, width: 1321, homepage });
    try {
      for (const width of [1321, 1440]) {
        await fixture.page.setViewportSize({ width, height: HEIGHT });
        await waitForHeaderMeasure(fixture.page);
        const state = await fixture.page.evaluate(measureHeader);
        expect(state.parts.auth.visible).toBe(true);
        expect(state.parts.name.textOverflow).toBe('ellipsis');
        expect(state.parts.name.whiteSpace).toBe('nowrap');
        expect(state.parts.name.overflow).toBe('hidden');
        expect(state.parts.name.scrollWidth).toBeGreaterThan(state.parts.name.clientWidth);
        expect(state.parts.name.width).toBeLessThanOrEqual(129);
        expect(state.collisions).toEqual([]);
        expect(state.outside).toEqual([]);
      }
      expect(fixture.errors).toEqual([]);
    } finally {
      await fixture.context.close();
    }
  }, 30000);

  test.each(['ar', 'en'])('%s tools mega menu is addressable and bounded at true desktop width', async lang => {
    const fixture = await openFixture({ lang, width: 1440 });
    const { page } = fixture;
    try {
      const tools = page.locator('[data-nav-id="tools"]');
      expect(await tools.count()).toBe(1);

      const toggle = tools.locator(':scope > .dropdown-toggle');
      const menu = tools.locator(':scope > .dropdown-menu--grouped');
      expect(await menu.isVisible()).toBe(false);

      await toggle.hover();
      await menu.waitFor({ state: 'visible' });
      expect(await toggle.getAttribute('aria-expanded')).toBe('true');
      expect(await menu.locator('.dropdown-group').count()).toBe(4);
      expect(await menu.locator('.dropdown-group a').count()).toBe(15);

      const box = await menu.boundingBox();
      expect(box).not.toBeNull();
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(1441);
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height).toBeLessThanOrEqual(901);

      const footer = menu.locator('.dropdown-menu__footer a');
      expect(await footer.count()).toBe(1);
      expect(await footer.getAttribute('href')).toContain('calculators/investment-center/index.html');

      await toggle.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      expect(await toggle.getAttribute('aria-expanded')).toBe('false');
      expect(fixture.errors).toEqual([]);
    } finally {
      await fixture.context.close();
    }
  }, 30000);

  test.each(['ar', 'en'])('%s feasibility toolbar stays below the header and in mobile flow', async lang => {
    const fixture = await openFixture({ lang, width: 1281, homepage: false, toolbar: true });
    const { page } = fixture;
    try {
      for (const width of [769, 1281]) {
        await page.setViewportSize({ width, height: HEIGHT });
        await waitForHeaderMeasure(page);
        await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
        const state = await page.evaluate(measureHeader);
        expect(state.scrollY).toBeGreaterThan(400);
        expect(state.parts.toolbar.position).toBe('sticky');
        expect(Math.abs(state.parts.toolbar.y - state.parts.header.bottom)).toBeLessThanOrEqual(1);
      }
      for (const width of [375, 768]) {
        await page.setViewportSize({ width, height: HEIGHT });
        await waitForHeaderMeasure(page);
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        const state = await page.evaluate(measureHeader);
        expect(state.parts.toolbar.position).toBe('relative');
        expect(parseFloat(state.parts.toolbar.top)).toBe(0);
        expect(state.parts.following.y).toBeGreaterThanOrEqual(state.parts.toolbar.bottom - 1);
      }
      expect(fixture.errors).toEqual([]);
    } finally {
      await fixture.context.close();
    }
  }, 30000);
});
