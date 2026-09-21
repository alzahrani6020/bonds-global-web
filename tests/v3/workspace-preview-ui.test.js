const { chromium } = require('playwright');
const axeCore = require('axe-core');

jest.setTimeout(90000);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';
let browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  if (browser) await browser.close();
});

async function createPage({
  viewport = { width: 1280, height: 900 },
  authenticated = true
} = {}) {
  const context = await browser.newContext({ viewport });

  await context.addInitScript(({ authenticated }) => {
    window.BondsAuth = {
      async getSession() {
        return {
          data: {
            session: authenticated
              ? {
                  access_token: 'test-workspace-token',
                  user: {
                    id: 'workspace-test-user',
                    email: 'workspace@example.com'
                  }
                }
              : null
          },
          error: null
        };
      },

      async authenticatedFetch(url, options = {}) {
        return fetch(url, options);
      }
    };
  }, { authenticated });

  const page = await context.newPage();

  await page.route('**/bonds-auth-2026.js*', route => route.abort());

  await page.route('**/api/v3/ecc/portfolio', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projects: [],
        summary: {},
        totals: {}
      })
    });
  });

  await page.route('**/api/v3/ecc/notifications', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        notifications: []
      })
    });
  });

  return { context, page };
}

describe('v3 workspace preview', () => {
  test('authenticated workspace renders without fatal errors', async () => {
    const { context, page } = await createPage();

    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    const response = await page.goto(
      new URL('/v3/workspace-preview/', BASE_URL).toString(),
      {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      }
    );

    await page.waitForTimeout(500);

    expect(response.status()).toBeLessThan(400);
    expect((await page.locator('body').innerText()).trim()).not.toBe('');
    expect(errors).toEqual([]);

    await context.close();
  });

  test('unauthenticated workspace shows auth gate', async () => {
    const { context, page } = await createPage({
      authenticated: false
    });

    await page.goto(
      new URL('/v3/workspace-preview/', BASE_URL).toString(),
      {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      }
    );

    await page.waitForTimeout(500);

    const body = await page.locator('body').innerText();

    expect(
      /sign in|login|تسجيل الدخول|تسجيل/i.test(body)
    ).toBe(true);

    await context.close();
  });

  test('workspace has no horizontal overflow on mobile', async () => {
    const { context, page } = await createPage({
      viewport: { width: 375, height: 667 }
    });

    await page.goto(
      new URL('/v3/workspace-preview/', BASE_URL).toString(),
      {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      }
    );

    await page.waitForTimeout(500);

    const sizes = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth
    }));

    expect(sizes.document).toBeLessThanOrEqual(sizes.viewport + 1);

    await context.close();
  });

  test('workspace has no serious or critical accessibility violations', async () => {
    const { context, page } = await createPage();

    await page.goto(
      new URL('/v3/workspace-preview/', BASE_URL).toString(),
      {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      }
    );

    await page.waitForTimeout(500);
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
        .filter(v =>
          v.impact === 'critical' ||
          v.impact === 'serious'
        )
        .map(v => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          targets: v.nodes.map(node => node.target)
        }));
    });

    if (violations.length) {
      console.log(
        'Workspace accessibility violations:',
        JSON.stringify(violations, null, 2)
      );
    }

    expect(violations).toEqual([]);

    await context.close();
  });
});
