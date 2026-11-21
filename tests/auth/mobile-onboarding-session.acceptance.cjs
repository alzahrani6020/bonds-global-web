'use strict';
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3005';
const routes = ['/calculators/auth/onboarding.html', '/en/calculators/auth/onboarding.html'];

async function exercise(browser, pathname) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    // No credentials, live sessions, database mutations, or production writes.
    await page.route(/\.js(?:\?.*)?$|\/api\/env(?:\?.*)?$/, async route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* mocked */' }));
    await page.addInitScript(() => {
      window.__mockUser = null;
      window.__savedProfile = null;
      window.BondsGeo = { bindCascading: () => ({ setValues() {} }) };
      window.BondsLeadConversion = { markConverted() {} };
      window.BondsAuth = {
        getUser: async () => ({ data: { user: window.__mockUser }, error: null }),
        getSession: async () => ({ data: { session: window.__mockUser ? { user: window.__mockUser } : null }, error: null }),
        getProfile: async () => ({ data: null, error: null }),
        isValidPhone: () => true,
        updateProfile: async (userId, payload) => {
          window.__savedProfile = { userId, payload };
          return { data: payload, error: null };
        }
      };
    });
    const response = await page.goto(BASE + pathname, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    await page.locator('#errorMsg').waitFor({ state: 'visible', timeout: 12000 });
    assert.ok((await page.locator('#errorMsg').innerText()).length > 10);
    await page.locator('#restaurantName').fill('Mobile retained form');
    await page.locator('#bio').fill('Initial form data');
    await page.locator('#saveBtn').click();
    await page.waitForFunction(() => !document.getElementById('saveBtn').disabled);
    assert.equal(new URL(page.url()).pathname, pathname, 'No premature sign-in redirect');
    assert.equal(await page.locator('#restaurantName').inputValue(), 'Mobile retained form');
    assert.equal(await page.locator('#bio').inputValue(), 'Initial form data');
    assert.equal(await page.evaluate(() => window.__savedProfile), null);

    // A recovered session must save the exact form rather than losing user input.
    await page.evaluate(() => {
      window.__mockUser = { id: '00000000-0000-4000-8000-000000000001',
        email: 'fixture@example.invalid', user_metadata: {} };
    });
    await page.locator('#saveBtn').click();
    await page.waitForFunction(() => !!window.__savedProfile, { timeout: 10000 });
    const saved = await page.evaluate(() => window.__savedProfile);
    assert.equal(saved.payload.restaurant_name, 'Mobile retained form');
    assert.equal(saved.payload.bio, 'Initial form data');
    assert.equal(saved.userId, '00000000-0000-4000-8000-000000000001');
    console.log('PASS mobile onboarding session recovery and retained form: ' + pathname);
  } finally {
    await context.close();
  }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const route of routes) await exercise(browser, route);
  } finally {
    await browser.close();
  }
  console.log('MOBILE_ONBOARDING_ACCEPTANCE: PASS (2/2)');
})().catch(error => { console.error(error); process.exitCode = 1; });
