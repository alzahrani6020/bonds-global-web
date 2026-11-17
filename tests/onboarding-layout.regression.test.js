/** @jest-environment node */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://onboarding-layout.test';
let browser;

beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30000);
afterAll(async () => { if (browser) await browser.close(); });

describe.each(['calculators/auth/onboarding.html', 'en/calculators/auth/onboarding.html'])('%s', file => {
  test.each([375, 768, 1280])('fields stay inside their form at %ipx', async width => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin !== ORIGIN) return route.abort();
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        const resolved = path.resolve(ROOT, relative);
        if (!resolved.startsWith(ROOT + path.sep) || !fs.existsSync(resolved)) return route.abort();
        const type = resolved.endsWith('.css') ? 'text/css' : resolved.endsWith('.html') ? 'text/html' : 'application/octet-stream';
        const body = resolved.endsWith('.html')
          ? fs.readFileSync(resolved, 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
          : fs.readFileSync(resolved);
        return route.fulfill({ status: 200, contentType: type, body });
      });
      await page.goto(ORIGIN + '/' + file, { waitUntil: 'load' });
      const issues = await page.locator('#onboardingForm').evaluate(form => {
        const outer = form.getBoundingClientRect();
        return Array.from(form.querySelectorAll('input, select, textarea')).flatMap(el => {
          const rect = el.getBoundingClientRect();
          const group = el.closest('.form-group').getBoundingClientRect();
          return rect.left < Math.max(outer.left, group.left) - 1 ||
            rect.right > Math.min(outer.right, group.right) + 1 ||
            Math.abs(rect.width - group.width) > 1 ? [el.id] : [];
        });
      });
      expect(issues).toEqual([]);
      await expect(page.locator('#needs').count()).resolves.toBe(1);
    } finally {
      await page.close();
    }
  }, 30000);
});
