/**
 * Real auth-flow regression test: a protected calculator page without a
 * session must redirect to the login page, preserve the return path, and not
 * leak protected content or enter a redirect loop.
 *
 * This test deliberately does NOT block global-auth-gate.js.
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

describe('protected page redirect flow', () => {
  const protectedUrl = 'http://localhost:3005/calculators/creditworthiness.html';
  const expectedLoginUrl = 'http://localhost:3005/calculators/auth/?redirect=%2Fcalculators%2Fcreditworthiness.html';

  test('redirects anonymous user to login with return-path preserved', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Ensure no stale session token is present.
    await context.clearCookies();
    await page.evaluate(() => {
      try { localStorage.removeItem('bonds-auth-token'); } catch (e) {}
    });

    await page.goto(protectedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // Wait for the redirect to the login page.
    await page.waitForURL(/\/calculators\/auth\//, { timeout: 10000 });

    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/calculators/auth/');
    expect(finalUrl.searchParams.get('redirect')).toBe('/calculators/creditworthiness.html');

    // No redirect loop: URL should remain on the login page.
    await page.waitForTimeout(1000);
    const stableUrl = new URL(page.url());
    expect(stableUrl.pathname).toBe('/calculators/auth/');
    expect(stableUrl.searchParams.get('redirect')).toBe('/calculators/creditworthiness.html');

    // Protected content must not be present on the login page.
    const protectedContent = await page.locator('#cwForm, #country, .cw-result').count();
    expect(protectedContent).toBe(0);

    // The redirect query parameter must decode back to the original path.
    const redirectParam = await page.evaluate(() => {
      return new URLSearchParams(window.location.search).get('redirect');
    });
    expect(redirectParam).toBe('/calculators/creditworthiness.html');

    await page.close();
    await context.close();
  });

  test('does not redirect public homepage', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('http://localhost:3005/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(page.url()).toBe('http://localhost:3005/');
    await page.close();
    await context.close();
  });
});
