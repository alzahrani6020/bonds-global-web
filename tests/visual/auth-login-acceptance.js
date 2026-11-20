'use strict';
/**
 * Auth-page release acceptance, both languages and six viewport sizes.
 * Runs against the local preview-equivalent static server, never submits
 * credentials, and never accesses a production account.
 */
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3005';
const viewports = [
  ['desktop', 1920, 1080],
  ['laptop', 1366, 768],
  ['short', 1280, 720],
  ['tablet', 768, 1024],
  ['mobile', 390, 844],
  ['small-mobile', 320, 568],
];
const languages = [
  ['ar', '/calculators/auth/'],
  ['en', '/en/calculators/auth/'],
];
let failures = 0;

async function checkPage(browser, lang, route, label, width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const id = lang + '/' + label;
  try {
    const response = await page.goto(new URL(route, BASE_URL).href, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.locator('#loginBtn').waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    const initial = await page.evaluate(() => {
      const get = selector => {
        const el = document.querySelector(selector);
        if (!el) return { exists: false };
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          exists: true,
          visible: r.width > 0 && r.height > 0 &&
            cs.visibility !== 'hidden' && cs.display !== 'none',
          inViewport: r.left >= -1 && r.right <= innerWidth + 1 &&
            r.top >= -1 && r.bottom <= innerHeight + 1
        };
      };
      const logo = document.querySelector('.auth-card .logo img');
      return {
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        logoLoaded: Boolean(logo && logo.complete && logo.naturalWidth > 0),
        controls: Object.fromEntries(['#loginEmail','#loginPassword',
          '#loginBtn','#otpBtn','#googleBtn'].map(s => [s, get(s)]))
      };
    });
    const controls = Object.values(initial.controls);
    if (response?.status() !== 200 || initial.horizontalOverflow ||
        !initial.logoLoaded || !controls.every(x => x.exists && x.visible)) {
      throw new Error('initial visibility: ' + JSON.stringify({status: response?.status(), initial}));
    }
    if (width > 900 && height >= 720 &&
        !controls.every(x => x.inViewport)) {
      throw new Error('desktop viewport fit: ' + JSON.stringify(initial.controls));
    }

    // Test both login methods, then return to email.
    await page.locator('.method-tab[data-method="phone"]').click();
    await page.locator('#loginPhoneSection').waitFor({ state: 'visible' });
    await page.locator('.method-tab[data-method="email"]').click();
    await page.locator('#loginEmailSection').waitFor({ state: 'visible' });

    // Test the two account tabs, including ability to return to login.
    await page.locator('.tab-btn[data-tab="signup"]').click();
    await page.locator('#signupPanel').waitFor({ state: 'visible' });
    await page.locator('.tab-btn[data-tab="login"]').click();
    await page.locator('#loginPanel').waitFor({ state: 'visible' });
    if (await page.locator('#loginBtn').isHidden()) {
      throw new Error('login button hidden after tab navigation');
    }
    console.log('PASS ' + id);
  } catch (error) {
    failures++;
    console.error('FAIL ' + id + ': ' + error.message);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [lang, route] of languages) {
      for (const [label, width, height] of viewports) {
        await checkPage(browser, lang, route, label, width, height);
      }
    }
  } finally {
    await browser.close();
  }
  console.log('AUTH_ACCEPTANCE: ' + (failures ? 'FAIL (' + failures + '/12)' : 'PASS (12/12)'));
  if (failures) process.exitCode = 1;
})().catch(err => {
  console.error('AUTH_ACCEPTANCE_FATAL:', err.message);
  process.exitCode = 1;
});
