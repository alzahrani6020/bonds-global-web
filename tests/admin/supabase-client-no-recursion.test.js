/**
 * Regression test for the Maximum call stack recursion that occurred when
 * bonds-auth-2026.js and supabase-client.js both defined window.BondsAuth.
 *
 * Loads an admin page that includes both scripts and asserts no page errors.
 */
const { chromium } = require('playwright');

jest.setTimeout(30000);

let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  if (browser) await browser.close();
});

test('admin calculator-leads loads without BondsAuth recursion', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  // Block the dynamic gate so the protected admin page stays loaded for layout.
  await page.route(/(\/global-auth-gate|\/calculators\/auth-gate)\.js(?:\?.*)?$/, route => route.abort());

  await page.goto('http://localhost:3005/admin/calculator-leads.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  // The recursive getSupabase caused "Maximum call stack size exceeded".
  const stackErrors = pageErrors.filter(e => e.toLowerCase().includes('maximum call stack'));
  expect(stackErrors).toEqual([]);

  // Universal Dropdown should initialise (even though this page has no selectors).
  const udInitialized = await page.evaluate(() => typeof window.UniversalDropdown !== 'undefined');
  expect(udInitialized).toBe(true);

  await page.close();
  await context.close();
});

test('english admin calculator-leads loads without BondsAuth recursion', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.route(/(\/global-auth-gate|\/calculators\/auth-gate)\.js(?:\?.*)?$/, route => route.abort());

  await page.goto('http://localhost:3005/admin/en/calculator-leads.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  const stackErrors = pageErrors.filter(e => e.toLowerCase().includes('maximum call stack'));
  expect(stackErrors).toEqual([]);

  await page.close();
  await context.close();
});
