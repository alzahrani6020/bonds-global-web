/**
 * Site-wide emoji SVG regression audit.
 *
 * Static phase:
 *   - discovers every production HTML page in the repository
 *   - validates emoji renderer dependency ordering
 *
 * Runtime phase (CI/local server available):
 *   - visits every page that contains pre-rendered emoji SVGs or loads the runtime renderer
 *   - checks computed emoji SVG dimensions
 *   - exercises safe calculator example/calculate controls when present
 *
 * This specifically prevents emoji-derived SVGs from inheriting broad SVG rules
 * and expanding to cover large portions of the viewport.
 *
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

jest.setTimeout(5 * 60 * 1000);

const ROOT = path.resolve(__dirname, '..', '..');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3005';

const SKIP_DIRS = new Set([
  '.git',
  '.vercel',
  'node_modules',
  'tmp',
  'tmp-crawler',
  'coverage'
]);

function discoverHtmlFiles() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        if (rel.startsWith('tests/')) continue;
        files.push(rel);
      }
    }
  }
  walk(ROOT);
  return files.sort();
}

function toUrlPath(rel) {
  const normalized = '/' + rel.replace(/\\/g, '/');
  return normalized.replace(/\/index\.html$/, '/');
}

function sourceHasEmojiSurface(source) {
  return /emoji-renderer\.js/i.test(source) || /\bemoji-icon\b/i.test(source);
}

function validateRendererOrdering(rel, source) {
  if (!/emoji-renderer\.js/i.test(source)) return [];
  const issues = [];
  const rendererIndex = source.indexOf('emoji-renderer.js');
  const iconsIndex = source.indexOf('emoji-icons.js');
  if (iconsIndex < 0) issues.push(rel + ': emoji-renderer.js loaded without emoji-icons.js');
  if (iconsIndex >= 0 && iconsIndex > rendererIndex) {
    issues.push(rel + ': emoji-icons.js must load before emoji-renderer.js');
  }
  return issues;
}

async function serverAvailable() {
  try {
    const res = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function inspectEmojiSizing(page, rel, phase) {
  const issues = await page.evaluate(({ rel, phase }) => {
    const bad = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    document.querySelectorAll('.emoji-icon').forEach((span, index) => {
      const svg = span.querySelector('svg');
      if (!svg) return;

      const spanRect = span.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const spanStyle = getComputedStyle(span);
      const fontSize = Math.max(1, parseFloat(spanStyle.fontSize) || 16);
      const maxInline = Math.max(96, fontSize * 2.5);

      const escapedParent =
        svgRect.width > spanRect.width + 3 ||
        svgRect.height > spanRect.height + 3;

      const oversizedInline =
        spanRect.width > maxInline ||
        spanRect.height > maxInline ||
        svgRect.width > maxInline ||
        svgRect.height > maxInline;

      const viewportDominating =
        svgRect.width > vw * 0.25 ||
        svgRect.height > vh * 0.25;

      if (escapedParent || oversizedInline || viewportDominating) {
        bad.push({
          rel,
          phase,
          index,
          span: {
            w: Math.round(spanRect.width * 10) / 10,
            h: Math.round(spanRect.height * 10) / 10
          },
          svg: {
            w: Math.round(svgRect.width * 10) / 10,
            h: Math.round(svgRect.height * 10) / 10
          },
          fontSize: Math.round(fontSize * 10) / 10,
          className: String(span.className || '').slice(0, 120)
        });
      }
    });

    return bad;
  }, { rel, phase });

  return issues;
}

async function clickFirstVisibleByText(page, re) {
  const locator = page.locator('button, [role="button"], input[type="button"]').filter({ hasText: re });
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) {
      await item.click({ timeout: 500 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function auditRuntimePages(candidates) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1
  });

  await context.addInitScript(() => {
    try {
      localStorage.setItem('cookies', 'accepted');
      localStorage.removeItem('bonds-auth-token');
      localStorage.removeItem('bonds-auth-session');
      sessionStorage.removeItem('bonds-auth-token');
      sessionStorage.removeItem('bonds-auth-session');
    } catch {}
  });

  await context.route(/(global-auth-gate|calculators\/auth-gate)\.js(?:\?.*)?$/, route => route.abort());
  await context.route('**/*', route => {
    const request = route.request();
    const url = request.url();
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) return route.abort();
    if (['image', 'font', 'media'].includes(request.resourceType())) return route.abort();
    return route.continue();
  });

  const failures = [];
  const loadFailures = [];
  const CONCURRENCY = 16;
  let nextIndex = 0;

  async function worker() {
    const page = await context.newPage();
    let allowedPath = null;

    await page.route('**/*', route => {
      const request = route.request();
      if (!request.isNavigationRequest() || request.resourceType() !== 'document') {
        return route.fallback();
      }

      const url = request.url();
      if (!/^https?:\/\//.test(url)) return route.fallback();

      const pathname = new URL(url).pathname.replace(/\/+$/, '') || '/';
      if (allowedPath && pathname !== allowedPath) return route.abort();

      return route.fallback();
    });

    try {
      while (nextIndex < candidates.length) {
        const rel = candidates[nextIndex++];
        try {
          const url = new URL(toUrlPath(rel), BASE_URL).toString();
          allowedPath = new URL(url).pathname.replace(/\/+$/, '') || '/';

          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 3500 });
          await page.waitForTimeout(40);

          failures.push(...await inspectEmojiSizing(page, rel, 'initial'));

          const clickedExample = await clickFirstVisibleByText(page, /مثال توضيحي|تحميل مثال|Example/i);
          if (clickedExample) await page.waitForTimeout(40);

          const clickedCalculate = await clickFirstVisibleByText(page, /احسب النتائج|احسب النتيجة|Calculate Results|Calculate Result/i);
          if (clickedCalculate) {
            await page.waitForTimeout(100);
            failures.push(...await inspectEmojiSizing(page, rel, 'after-calculate'));
          }
        } catch (err) {
          loadFailures.push(rel + ': ' + String(err.message || err).slice(0, 220));
        }
      }
    } finally {
      await page.close();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () => worker())
  );

  await context.close();
  await browser.close();

  return { failures, loadFailures };
}

describe('site-wide emoji SVG safety', () => {
  const htmlFiles = discoverHtmlFiles();
  const sources = htmlFiles.map(rel => ({
    rel,
    source: fs.readFileSync(path.join(ROOT, rel), 'utf8')
  }));

  test('all emoji renderer pages load the icon library first', () => {
    const issues = [];
    for (const { rel, source } of sources) {
      issues.push(...validateRendererOrdering(rel, source));
    }
    expect(issues).toEqual([]);
  });

  test('all emoji surfaces stay bounded across the site', async () => {
    const candidates = sources
      .filter(({ source }) => sourceHasEmojiSurface(source))
      .map(({ rel }) => rel);

    expect(candidates.length).toBeGreaterThan(0);
    console.log('Site-wide emoji runtime candidates: ' + candidates.length + ' / HTML pages: ' + htmlFiles.length);

    const available = await serverAvailable();
    if (!available) {
      if (process.env.CI) {
        throw new Error('Local dev server is required for the site-wide emoji runtime audit');
      }
      console.warn('Skipping runtime emoji crawl because ' + BASE_URL + ' is unavailable');
      return;
    }

    const { failures, loadFailures } = await auditRuntimePages(candidates);

    expect(loadFailures).toEqual([]);
    expect(failures).toEqual([]);
  });
});
