const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

jest.setTimeout(30000);

let browser;
let server;
let baseUrl;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  server = await startStaticServer(ROOT);
  baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  if (browser) await browser.close();
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

function contentType(ext) {
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
  };
  return map[ext] || 'application/octet-stream';
}

function startStaticServer(root) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let pathname = req.url.split('?')[0];
      if (pathname.endsWith('/')) pathname += 'index.html';
      const safe = path.normalize(pathname).replace(/^(\.\.\/)+/, '');
      const filePath = path.join(root, safe);
      if (!filePath.startsWith(root)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }
        res.setHeader('Content-Type', contentType(path.extname(filePath)));
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve(srv);
    });
  });
}

function mockBondsAuth(projects = [], hasAuthFetch = true) {
  const projectsJson = JSON.stringify(projects);
  return `
    (function() {
      window.__lastApiCall = null;
      window.BondsAuth = {
        getUser: async () => ({ data: { user: { id: 'u1', email: 'a@example.com', user_metadata: {} } }, error: null }),
        getSession: async () => ({ data: { session: { access_token: 'test-token' } }, error: null }),
        initSiteAuth: async () => {},
        authenticatedFetch: ${hasAuthFetch ? `async (url, options) => {
          window.__lastApiCall = { url, options };
          return {
            ok: true,
            status: 200,
            json: async () => ({ projects: ${projectsJson} })
          };
        }` : 'undefined'}
      };
    })();
  `;
}

async function openMyBondsPage(pagePath, initScript) {
  const page = await browser.newPage();
  await page.route(/bonds-auth-2026.*\.js/, route => route.abort());
  if (initScript) await page.addInitScript(initScript);
  await page.goto(baseUrl + pagePath);
  await page.waitForTimeout(700);
  return page;
}

describe('my-bonds cache regression', () => {
  test('Arabic: authenticatedFetch present loads projects', async () => {
    const projects = [{ id: 'p1', name: 'مشروع 1', sector: 'test', activity: 'محلي' }];
    const page = await openMyBondsPage('/my-bonds/', mockBondsAuth(projects, true));
    const count = await page.locator('#projectCount').textContent();
    expect(count).toBe('1');
    const lastCall = await page.evaluate(() => window.__lastApiCall);
    expect(lastCall && lastCall.url).toBe('/api/v3/projects');
    expect(await page.locator('#manualRefreshBtn').count()).toBe(0);
    const projectsHtml = await page.locator('#projectsList').innerHTML();
    expect(projectsHtml).toContain('مشروع 1');
    await page.close();
  });

  test('Arabic: missing authenticatedFetch triggers reload and does not call API', async () => {
    const page = await openMyBondsPage('/my-bonds/', mockBondsAuth([], false));
    const lastCall = await page.evaluate(() => window.__lastApiCall);
    expect(lastCall).toBeNull();
    await page.waitForTimeout(900);
    const url = page.url();
    expect(url).toContain('__bust=');
    const flag = await page.evaluate(() => sessionStorage.getItem('bonds_auth_reload_once'));
    expect(flag).toBe('1');
    await page.close();
  });

  test('Arabic: missing authenticatedFetch triggers one reload with cache bust', async () => {
    const page = await browser.newPage();
    await page.route(/bonds-auth-2026.*\.js/, route => route.abort());
    await page.addInitScript(mockBondsAuth([], false));
    await page.goto(baseUrl + '/my-bonds/');
    await page.waitForTimeout(900);
    const url = page.url();
    const flag = await page.evaluate(() => sessionStorage.getItem('bonds_auth_reload_once'));
    expect(flag).toBe('1');
    expect(url).toContain('__bust=');
    await page.close();
  });

  test('Arabic: after reload still missing shows manual refresh button', async () => {
    const page = await browser.newPage();
    await page.route(/bonds-auth-2026.*\.js/, route => route.abort());
    await page.addInitScript(mockBondsAuth([], false) + `\n      sessionStorage.setItem('bonds_auth_reload_once', '1');\n    `);
    await page.goto(baseUrl + '/my-bonds/');
    await page.waitForTimeout(700);
    const count = await page.locator('#projectCount').textContent();
    expect(count).toBe('—');
    const btn = page.locator('#manualRefreshBtn');
    expect(await btn.count()).toBe(1);
    await page.close();
  });

  test('English: missing authenticatedFetch triggers reload and does not call API', async () => {
    const page = await openMyBondsPage('/en/my-bonds/', mockBondsAuth([], false));
    const lastCall = await page.evaluate(() => window.__lastApiCall);
    expect(lastCall).toBeNull();
    const flag = await page.evaluate(() => sessionStorage.getItem('bonds_auth_reload_once'));
    expect(flag).toBe('1');
    await page.close();
  });

  test('English: authenticatedFetch present loads projects', async () => {
    const projects = [{ id: 'p1', name: 'Project 1', sector: 'test', activity: 'local' }];
    const page = await openMyBondsPage('/en/my-bonds/', mockBondsAuth(projects, true));
    const count = await page.locator('#projectCount').textContent();
    expect(count).toBe('1');
    await page.close();
  });
});
