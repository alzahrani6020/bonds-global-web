const { chromium } = require('playwright');
const axeCore = require('axe-core');

jest.setTimeout(120000);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

let browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  if (browser) await browser.close();
});

async function createPage(viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ viewport });

  await context.addInitScript(() => {
    window.BondsAuth = {
      initAdminGuard() {},
      async getUser() {
        return {
          data: {
            user: {
              id: 'test-admin-user',
              email: 'admin-test@example.com'
            }
          },
          error: null
        };
      },
      async getProfile() {
        return {
          data: {
            id: 'test-admin-user',
            email: 'admin-test@example.com'
          },
          error: null
        };
      },
      async getSession() {
        return {
          data: {
            session: {
              access_token: 'test-admin-token',
              user: {
                id: 'test-admin-user',
                email: 'admin-test@example.com'
              }
            }
          },
          error: null
        };
      },
      getRedirectUrl() {
        return '/admin/dashboard';
      },
      getSupabase() {
        return null;
      },
      async authenticatedFetch(url, options = {}) {
        return fetch(url, options);
      }
    };

    window.__ADMIN_ROLE = 'super_admin';
    window.__ADMIN_PERMS = ['*'];
    window.__ADMIN_TOKEN = 'test-admin-token';
  });

  const page = await context.newPage();

  await page.route('**/bonds-auth-2026.js*', route => route.abort());
  await page.route('**/calculators/auth-gate.js*', route => route.abort());

  await page.route('**/api/**', route => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/env') {
      return route.continue();
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        stats: {},
        items: [],
        users: [],
        subscriptions: [],
        messages: [],
        roles: [],
        settings: {}
      })
    });
  });

  return { context, page };
}

async function getDashboardModuleTargets() {
  const { context, page } = await createPage();

  await page.goto(
    new URL('/admin/dashboard', BASE_URL).toString(),
    { waitUntil: 'domcontentloaded' }
  );

  const targets = await page.locator('[data-target]').evaluateAll(elements => {
    const values = elements
      .map(el => el.getAttribute('data-target'))
      .filter(Boolean)
      .filter(value => value.startsWith('/admin/'));

    return [...new Set(values)];
  });

  await context.close();

  return targets;
}

function normalizePath(target) {
  return target.replace(/\/+$/, '');
}

describe('admin linked modules UI', () => {
  test('all dashboard-linked admin modules render without fatal UI failures', async () => {
    const targets = await getDashboardModuleTargets();

    expect(targets.length).toBeGreaterThan(10);

    const failures = [];

    for (const rawTarget of targets) {
      const target = normalizePath(rawTarget);

      const { context, page } = await createPage({
        width: 1280,
        height: 900
      });

      const pageErrors = [];

      page.on('pageerror', error => {
        pageErrors.push(error.message);
      });

      try {
        const response = await page.goto(
          new URL(target, BASE_URL).toString(),
          {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          }
        );

        await page.waitForTimeout(300);

        const status = response ? response.status() : null;

        const bodyText = await page.locator('body').innerText().catch(() => '');

        if (status && status >= 400) {
          failures.push({
            target,
            type: 'http-status',
            status
          });
        }

        if (!bodyText.trim()) {
          failures.push({
            target,
            type: 'empty-page'
          });
        }

        const fatalErrors = pageErrors.filter(message =>
          !/ResizeObserver loop/i.test(message)
        );

        if (fatalErrors.length) {
          failures.push({
            target,
            type: 'page-error',
            errors: fatalErrors
          });
        }
      } catch (error) {
        failures.push({
          target,
          type: 'navigation-error',
          error: error.message
        });
      } finally {
        await context.close();
      }
    }

    if (failures.length) {
      console.log(
        'Admin module render failures:',
        JSON.stringify(failures, null, 2)
      );
    }

    expect(failures).toEqual([]);
  });

  test('dashboard-linked admin modules do not overflow horizontally on mobile', async () => {
    const targets = await getDashboardModuleTargets();

    const failures = [];

    for (const rawTarget of targets) {
      const target = normalizePath(rawTarget);

      const { context, page } = await createPage({
        width: 375,
        height: 667
      });

      try {
        await page.goto(
          new URL(target, BASE_URL).toString(),
          {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          }
        );

        await page.waitForTimeout(300);

        const sizes = await page.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth
        }));

        if (sizes.document > sizes.viewport + 1) {
          failures.push({
            target,
            viewport: sizes.viewport,
            document: sizes.document
          });
        }
      } catch (error) {
        failures.push({
          target,
          error: error.message
        });
      } finally {
        await context.close();
      }
    }

    if (failures.length) {
      console.log(
        'Admin mobile overflow failures:',
        JSON.stringify(failures, null, 2)
      );
    }

    expect(failures).toEqual([]);
  });

  test('dashboard-linked admin modules have no serious or critical axe violations', async () => {
    const targets = await getDashboardModuleTargets();

    const failures = [];

    for (const rawTarget of targets) {
      const target = normalizePath(rawTarget);

      const { context, page } = await createPage({
        width: 1280,
        height: 900
      });

      try {
        await page.goto(
          new URL(target, BASE_URL).toString(),
          {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          }
        );

        await page.waitForTimeout(300);
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
              nodes: v.nodes.map(node => ({
                target: node.target,
                html: node.html,
                failureSummary: node.failureSummary
              }))
            }));
        });

        if (violations.length) {
          failures.push({
            target,
            violations
          });
        }
      } catch (error) {
        failures.push({
          target,
          error: error.message
        });
      } finally {
        await context.close();
      }
    }

    if (failures.length) {
      console.log(
        'Admin module accessibility failures:',
        JSON.stringify(failures, null, 2)
      );
    }

    expect(failures).toEqual([]);
  });
});
