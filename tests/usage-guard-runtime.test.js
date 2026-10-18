/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'http://usage-banner-regression.test';
const HEIGHT = 900;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon'
};
const assets = new Map();
let browser;

// Only identity, remote usage data, and history storage are synthetic. The
// actual pricing page, calculation, auth renderer, header, and usage guard run.
function installFixture({ tier }) {
  const user = {
    id: '00000000-0000-4000-8000-000000000197',
    email: 'usage-layout-fixture@example.invalid',
    user_metadata: { restaurant_name: 'Usage Layout Fixture Long User Name' }
  };
  const session = { user, access_token: 'synthetic-layout-fixture-not-a-real-token', expires_at: 4102444800 };
  const profile = { id: user.id, restaurant_name: user.user_metadata.restaurant_name, tier };
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
        data: table === 'profiles' ? profile : table === 'subscriptions' ? { tier, status: 'active' } : [],
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
  const history = new Map();
  window.idbKeyval = {
    get: async key => history.get(key), set: async (key, value) => { history.set(key, value); },
    keys: async () => [...history.keys()], del: async key => { history.delete(key); }
  };
}

async function settle(page) {
  await page.waitForFunction(() => {
    const header = document.getElementById('header');
    if (!header || Math.abs(parseFloat(document.body.style.paddingTop) - header.offsetHeight) > 1) return false;
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet)) return false;
    if (document.fonts.status !== 'loaded') return false;
    return [header, document.getElementById('bonds-usage-banner')].filter(Boolean).every(element =>
      element.getAnimations({ subtree: true }).every(animation =>
        !Number.isFinite(animation.effect.getComputedTiming().endTime) || animation.playState === 'finished'));
  });
}

async function dismissExitPrompt(page) {
  // Pricing's initial validation already sets _calcCompleted. Exercise the
  // real exit-intent trigger before later pointer movements can open its modal.
  const { width } = page.viewportSize();
  await page.mouse.move(width / 2, 100);
  await page.mouse.move(width / 2, -1);
  const overlay = page.locator('.bonds-exit-overlay');
  await page.locator('.bonds-exit-overlay.active').waitFor({ state: 'visible' });
  expect(await overlay.count()).toBe(1);
  const close = overlay.locator('[data-action="close"]');
  await close.evaluate(button => button.addEventListener('click', event => {
    window.__usageExitCloseTrusted = event.isTrusted;
  }, { once: true }));
  await close.click();
  expect(await page.evaluate(() => window.__usageExitCloseTrusted)).toBe(true);
  await overlay.waitFor({ state: 'detached' });
}

async function openPricing({ lang, width, server }) {
  const context = await browser.newContext({ viewport: { width, height: HEIGHT }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(installFixture, { tier: server.tier });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const errors = [];
  const requests = [];
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== ORIGIN) {
      if (url.href.includes('@supabase/supabase-js') || url.href.includes('idb-keyval@6.2.1/')) {
        return route.fulfill({ contentType: 'application/javascript', body: '/* Fixture identity/history already installed. */' });
      }
      // Chart/CDN failures use the page's own handling; they do not replace its
      // calculation or markup. No request leaves this isolated fixture.
      return route.abort();
    }
    if (url.pathname === '/api/usage') {
      requests.push(url.search);
      if (url.searchParams.get('action') === 'settings') {
        return route.fulfill({ contentType: 'application/json', body: '{"calc_limit":3,"feas_limit":1}' });
      }
      if (url.searchParams.get('action') === 'check' && url.searchParams.get('calculator') === 'restaurant') await gate;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(server) });
    }
    if (url.pathname === '/api/env' || url.pathname.startsWith('/_vercel/')) {
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: '{"data":[],"success":true}' });
    const filename = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname));
    if (!filename.startsWith(ROOT + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) return route.abort();
    if (!assets.has(filename)) assets.set(filename, fs.readFileSync(filename));
    return route.fulfill({ contentType: MIME[path.extname(filename)] || 'application/octet-stream', body: assets.get(filename) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => errors.push(error.message));
  const isCheck = request => {
    const url = new URL(request.url());
    return url.origin === ORIGIN && url.pathname === '/api/usage' &&
      url.searchParams.get('action') === 'check' && url.searchParams.get('calculator') === 'restaurant';
  };
  try {
    const checkRequested = page.waitForRequest(isCheck, { timeout: 10000 });
    await Promise.all([
      page.goto(ORIGIN + (lang === 'en' ? '/en' : '') + '/calculators/pricing.html', { waitUntil: 'load', timeout: 15000 }),
      checkRequested
    ]);
    await page.locator('#authContainer .bonds-user-menu').waitFor({ state: 'attached' });
    await settle(page);
    // The real page initializes onCountryChange -> onPlatformChange ->
    // calculateAll with empty inputs, showing a 3000ms validation toast. Let its
    // own removal finish; do not hide it or mock toast/calculation behavior.
    await page.waitForFunction(() => !document.querySelector('#bonds-toast-container > div'));
    await dismissExitPrompt(page);
    expect(await page.locator('#bonds-usage-banner').count()).toBe(0);
    return { context, page, release, isCheck, errors, requests };
  } catch (error) {
    release();
    await context.close();
    throw error;
  }
}

async function calculateAndRelease(fixture) {
  const { page } = fixture;
  for (const [id, value] of Object.entries({ directCost: '150', overheadCost: '50', packagingCost: '5', deliveryCost: '10', cac: '8', desiredMargin: '25', monthlyVolume: '100' })) {
    await page.locator('#' + id).fill(value);
  }
  expect(await page.locator('#bonds-toast-container > div').count()).toBe(0);
  await page.locator('button[onclick="calculateAll()"]').evaluate(button => {
    let previousResult;
    button.addEventListener('click', event => {
      previousResult = window._lastPricingResult;
      window.__usageClick = { trusted: event.isTrusted };
    }, { capture: true, once: true });
    button.addEventListener('click', () => {
      window.__usageClick.calculated = !!window._lastPricingResult && window._lastPricingResult !== previousResult;
    }, { once: true });
  });
  await page.locator('button[onclick="calculateAll()"]').click();
  expect(await page.evaluate(() => window.__usageClick)).toEqual({ trusted: true, calculated: true });
  const result = await page.evaluate(() => ({
    direct: window._lastPricingResult.inputs.direct,
    price: window._lastPricingResult.r.priceBeforeTax,
    text: document.getElementById('resPriceBeforeTax').textContent
  }));
  expect(result.direct).toBe(150);
  expect(result.price).toBeCloseTo(297.3333333333333);
  expect(result.text).toContain('297');
  expect(await page.locator('#bonds-toast-container > div').count()).toBe(0);
  expect(await page.locator('#bonds-usage-banner').count()).toBe(0);
  const response = page.waitForResponse(response => fixture.isCheck(response.request()));
  fixture.release();
  await (await response).finished();
  // Body completion plus a rendered frame lets the guard's JSON/DOM microtasks
  // run, including the return path for paid/admin responses.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  return result;
}

function geometry() {
  const rect = element => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  };
  const banner = document.getElementById('bonds-usage-banner');
  const header = document.getElementById('header');
  const link = banner.querySelector('a');
  const linkBox = rect(link);
  const hit = document.elementFromPoint(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
  const headerHits = ['.header-brand', '.lang-switch', '#navToggle', '#mainNav > ul > li:first-child > a'].flatMap(selector => {
    const element = document.querySelector(selector);
    if (!element) return [];
    const box = rect(element);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden' || x < 0 || x >= innerWidth) return [];
    const target = document.elementFromPoint(x, y);
    return [{ selector, delivered: target === element || element.contains(target) }];
  });
  return {
    header: rect(header), banner: rect(banner), next: rect(banner.nextElementSibling), link: linkBox,
    position: getComputedStyle(banner).position, icon: rect(banner.querySelector('svg')),
    linkHit: hit === link || link.contains(hit), headerHits,
    headingY: document.querySelector('.hero').getBoundingClientRect().y
  };
}

describe('usage notice after a real pricing calculation', () => {
  beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30000);
  afterAll(async () => { if (browser) await browser.close(); });

  const cases = ['ar', 'en'].flatMap(lang => [375, 1280, 1440].map((width, remaining) => ({ lang, width, remaining })));
  test.each(cases)('$lang pricing at $width px keeps the late notice ($remaining remaining) clear of header and content', async ({ lang, width, remaining }) => {
    const fixture = await openPricing({ lang, width, server: { tier: 'free', admin: false, used: 3 - remaining } });
    const { page } = fixture;
    try {
      const result = await calculateAndRelease(fixture);
      await page.locator('#bonds-usage-banner').waitFor({ state: 'visible' });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await settle(page);
      const state = await page.evaluate(geometry);
      expect(state.position).toBe('static');
      expect(state.banner.y).toBeGreaterThanOrEqual(state.header.bottom);
      expect(state.banner.x).toBeGreaterThanOrEqual(-1);
      expect(state.banner.right).toBeLessThanOrEqual(width + 1);
      expect(state.next.y).toBeGreaterThanOrEqual(state.banner.bottom - 1);
      expect(state.headingY).toBeGreaterThanOrEqual(state.banner.bottom - 1);
      expect(state.icon.width).toBeLessThanOrEqual(21);
      expect(state.icon.height).toBeLessThanOrEqual(21);
      expect(state.link.x).toBeGreaterThanOrEqual(state.banner.x - 1);
      expect(state.link.right).toBeLessThanOrEqual(state.banner.right + 1);
      expect(state.link.y).toBeGreaterThanOrEqual(state.banner.y - 1);
      expect(state.link.bottom).toBeLessThanOrEqual(state.banner.bottom + 1);
      expect(state.linkHit).toBe(true);
      expect(state.headerHits.length).toBeGreaterThanOrEqual(3);
      expect(state.headerHits.filter(hit => !hit.delivered)).toEqual([]);
      expect(await page.locator('#bonds-usage-banner a').getAttribute('href')).toBe('/pricing.html');
      const message = await page.locator('#bonds-usage-banner').textContent();
      expect(message).toContain(remaining === 0 ? 'استنفدت' : 'تبقت ' + remaining);
      expect(await page.evaluate(() => window._lastPricingResult.r.priceBeforeTax)).toBe(result.price);

      // A trusted header interaction after the delayed banner must still reach
      // the original control, not an overlapping notice or another overlay.
      if (width <= 1280) {
        await page.locator('#navToggle').click();
        expect(await page.locator('#navToggle').getAttribute('aria-expanded')).toBe('true');
        await page.locator('#mainNav').waitFor({ state: 'visible' });
        await page.locator('#navToggle').click();
        await page.locator('#mainNav').waitFor({ state: 'hidden' });
      } else {
        const toggle = page.locator('.main-header .dropdown-toggle').first();
        await toggle.focus();
        await toggle.press('ArrowDown');
        await page.locator('.main-header .dropdown.is-open > .dropdown-menu').first().waitFor({ state: 'visible' });
      }
      expect(fixture.errors).toEqual([]);
      expect(fixture.requests.filter(search => search.includes('action=check'))).toHaveLength(1);
    } finally {
      fixture.release();
      await fixture.context.close();
    }
  }, 30000);

  test.each([
    { lang: 'ar', width: 375, tier: 'pro', admin: false },
    { lang: 'en', width: 1440, tier: 'free', admin: true }
  ])('$lang $tier/admin=$admin server response still suppresses the notice', async ({ lang, width, tier, admin }) => {
    const fixture = await openPricing({ lang, width, server: { tier, admin, used: 3 } });
    try {
      await calculateAndRelease(fixture);
      await settle(fixture.page);
      expect(await fixture.page.locator('#bonds-usage-banner').count()).toBe(0);
      expect(fixture.errors).toEqual([]);
    } finally {
      fixture.release();
      await fixture.context.close();
    }
  }, 30000);
});
