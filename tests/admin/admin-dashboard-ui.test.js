const { chromium } = require('playwright');
const axeCore = require('axe-core');

jest.setTimeout(30000);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

let browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  if (browser) await browser.close();
});

async function openAdmin(viewport) {
  const context = await browser.newContext({ viewport });

  // Test-only auth harness. Production code is untouched.
  await context.addInitScript(() => {
    window.BondsAuth = {
      initAdminGuard() {}
    };

    window.__ADMIN_ROLE = 'super_admin';
    window.__ADMIN_PERMS = ['*'];
    window.__ADMIN_TOKEN = 'test-admin-token';
  });

  const page = await context.newPage();

  // Prevent the real auth bundle from replacing the test harness.
  await page.route('**/bonds-auth-2026.js*', route => route.abort());

  // Prevent the secondary auth gate from redirecting the test.
  await page.route('**/calculators/auth-gate.js*', route => route.abort());

  // Do not let dashboard tests call live APIs.
  await page.route('**/api/admin*', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        stats: {},
        online: [],
        journey: []
      })
    });
  });

  await page.goto(
    new URL('/admin/dashboard', BASE_URL).toString(),
    { waitUntil: 'domcontentloaded' }
  );

  await page.waitForTimeout(500);

  return { context, page };
}

describe('admin dashboard UI', () => {
  test('mobile dashboard has no horizontal document overflow', async () => {
    const { context, page } = await openAdmin({
      width: 375,
      height: 667
    });

    const sizes = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth
    }));

    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);

    await context.close();
  });

  test('mobile sidebar opens and closes', async () => {
    const { context, page } = await openAdmin({
      width: 375,
      height: 667
    });

    const toggle = page.locator('#mobileToggle');
    const sidebar = page.locator('#sidebar');

    expect(await toggle.count()).toBe(1);

    await toggle.click();

    expect(
      await sidebar.evaluate(el => el.classList.contains('open'))
    ).toBe(true);

    const overviewLink = sidebar.locator(
      '.sidebar-link[data-target="overview"]'
    );

    expect(await overviewLink.count()).toBe(1);
    expect(await overviewLink.isVisible()).toBe(true);

    await overviewLink.click();

    expect(
      await sidebar.evaluate(el => el.classList.contains('open'))
    ).toBe(false);

    await context.close();
  });

  test('core admin controls have accessible names', async () => {
    const { context, page } = await openAdmin({
      width: 1280,
      height: 900
    });

    const unnamedButtons = await page.locator('button').evaluateAll(buttons =>
      buttons
        .filter(button => {
          const text = (button.textContent || '').trim();
          const aria = button.getAttribute('aria-label');
          const title = button.getAttribute('title');

          return !text && !aria && !title;
        })
        .map(button => button.id || button.className || '<button>')
    );

    expect(unnamedButtons).toEqual([]);

    await context.close();
  });

  test('sidebar navigation has visible interactive items', async () => {
    const { context, page } = await openAdmin({
      width: 1280,
      height: 900
    });

    const count = await page.locator('#sidebar .sidebar-link').count();

    expect(count).toBeGreaterThan(5);

    await context.close();
  });

  test('admin dashboard has no serious or critical accessibility violations', async () => {
    const { context, page } = await openAdmin({
      width: 1280,
      height: 900
    });

    await page.addScriptTag({ content: axeCore.source });

    const violations = await page.evaluate(async () => {
      const result = await axe.run(document, {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa']
        },
        resultTypes: ['violations']
      });

      return result.violations
        .filter(v => v.impact === 'critical' || v.impact === 'serious')
        .map(v => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          targets: v.nodes.map(node => node.target)
        }));
    });

    if (violations.length) {
      console.log(
        'Admin accessibility violations:',
        JSON.stringify(violations, null, 2)
      );
    }

    expect(violations).toEqual([]);

    await context.close();
  }});
});
