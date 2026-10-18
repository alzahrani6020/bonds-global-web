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
        if (/^components\/universal-dropdown\/showcase(?:-en)?\.html$/.test(rel)) continue;
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
  const visibleHtml = source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

  return /\bemoji-icon\b/i.test(visibleHtml) ||
    /<svg\b/i.test(visibleHtml) ||
    /[\p{Extended_Pictographic}\p{Emoji_Presentation}]/u.test(visibleHtml);
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

function validateEmojiRuntimeCoverage(rel, source) {
  if (!sourceHasEmojiSurface(source)) return [];
  const issues = [];
  const directRuntime = /emoji-icons\.js/i.test(source) && /emoji-renderer\.js/i.test(source);
  const sharedLayoutRuntime = /site-layout\.js/i.test(source);
  if (!directRuntime && !sharedLayoutRuntime) {
    issues.push(rel + ': emoji surface missing direct runtime or site-layout runtime provider');
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
        (svgRect.width > spanRect.width + 4 && svgRect.width > spanRect.width * 1.5) ||
        (svgRect.height > spanRect.height + 4 && svgRect.height > spanRect.height * 1.5);

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

async function inspectInterfaceIconSizing(page, rel, phase) {
  return page.evaluate(({ rel, phase }) => {
    const bad = [];
    const selectors = [
      '.emoji-icon > svg',
      'button > svg',
      '[role="button"] > svg',
      '.btn > svg',
      '.bonds-btn > svg',
      '.ecc-btn > svg',
      '.calc-btn-sm > svg',
      '.bonds-auth-modal__icon > svg',
      '.bonds-exit-modal__icon > svg',
      '.bonds-auth-modal__social > svg',
      '.bonds-exit-modal__social > svg',
      '.bec-smart-alert__icon > svg',
      '.calc-empty-icon-lg > svg',
      '.status-badge > svg',
      '.alert-icon > svg',
      'svg[aria-hidden="true"]'
    ];

    const seen = new Set();
    document.querySelectorAll(selectors.join(',')).forEach((svg, index) => {
      if (seen.has(svg)) return;
      seen.add(svg);

      const allowedVisualization = svg.closest(
        '.chart, .chart-container, .chart-wrap, .gauge, .gauge-container, .score-gauge, ' +
        '.map, .map-container, .diagram, .illustration, .hero-illustration, .logo, .brand-logo, ' +
        '.site-logo, .qr-code, [data-chart], [data-gauge], [data-map]'
      );
      if (allowedVisualization) return;

      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const parent = svg.parentElement;
      const parentRect = parent ? parent.getBoundingClientRect() : null;
      const isModalHero = parent && (
        parent.classList.contains('bonds-auth-modal__icon') ||
        parent.classList.contains('bonds-exit-modal__icon')
      );
      const maxSize = isModalHero ? 72 : 96;

      const escapedParent = parentRect &&
        ((rect.width > parentRect.width + 4 && rect.width > parentRect.width * 1.5) ||
         (rect.height > parentRect.height + 4 && rect.height > parentRect.height * 1.5));

      if (rect.width > maxSize || rect.height > maxSize || escapedParent) {
        bad.push({
          rel,
          phase,
          index,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
          parentWidth: parentRect ? Math.round(parentRect.width * 10) / 10 : null,
          parentHeight: parentRect ? Math.round(parentRect.height * 10) / 10 : null,
          parentClass: parent ? String(parent.className || '').slice(0, 140) : ''
        });
      }
    });

    return bad;
  }, { rel, phase });
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
  const emojiIconsSource = fs.readFileSync(path.join(ROOT, 'components', 'emoji-icons.js'), 'utf8');
  const emojiRendererSource = fs.readFileSync(path.join(ROOT, 'components', 'emoji-renderer.js'), 'utf8');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1
  });

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

    await page.route('**/*', route => {
      const request = route.request();
      if (request.isNavigationRequest() && request.resourceType() === 'document') {
        return route.abort();
      }
      return route.fallback();
    });

    try {
      while (nextIndex < candidates.length) {
        const rel = candidates[nextIndex++];
        try {
          const url = new URL(toUrlPath(rel), BASE_URL);
          let html = fs.readFileSync(path.join(ROOT, rel), 'utf8');

          // Preserve the page DOM and CSS, but exclude unrelated application scripts.
          // The audit loads only the emoji runtime below to avoid auth redirects,
          // timers, API calls, and other side effects that are outside this regression.
          html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

          const baseHref = new URL('.', url).toString();
          const baseTag = '<base href="' + baseHref.replace(/"/g, '&quot;') + '">';
          if (/<head\b[^>]*>/i.test(html)) {
            html = html.replace(/<head\b[^>]*>/i, match => match + baseTag);
          } else {
            html = baseTag + html;
          }

          await page.setContent(html, { waitUntil: 'load', timeout: 2500 });

          // Simulate the exact failure class seen in production: a page-level
          // SVG rule trying to blow inline icons up to viewport size. Runtime
          // hardening must win even against !important declarations.
          await page.addStyleTag({
            content:
              '.emoji-icon > svg { width:100vw!important;height:100vh!important;' +
              'max-width:none!important;max-height:none!important;position:fixed!important;' +
              'inset:0!important;transform:scale(2)!important; }'
          });

          await page.addScriptTag({ content: emojiIconsSource });
          await page.addScriptTag({ content: emojiRendererSource });
          await page.waitForTimeout(20);

          failures.push(...await inspectEmojiSizing(page, rel, 'initial'));
          failures.push(...await inspectInterfaceIconSizing(page, rel, 'initial'));

          const clickedExample = await clickFirstVisibleByText(page, /مثال توضيحي|تحميل مثال|Example/i);
          if (clickedExample) await page.waitForTimeout(20);

          const clickedCalculate = await clickFirstVisibleByText(page, /احسب النتائج|احسب النتيجة|Calculate Results|Calculate Result/i);
          if (clickedCalculate) {
            await page.waitForTimeout(40);
            failures.push(...await inspectEmojiSizing(page, rel, 'after-calculate'));
            failures.push(...await inspectInterfaceIconSizing(page, rel, 'after-calculate'));
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

  test('all emoji surfaces load the shared runtime', () => {
    const issues = [];
    for (const { rel, source } of sources) {
      issues.push(...validateEmojiRuntimeCoverage(rel, source));
    }
    expect(issues).toEqual([]);

    const siteLayout = fs.readFileSync(path.join(ROOT, 'site-layout.js'), 'utf8');
    expect(siteLayout).toContain("'/components/emoji-icons.js'");
    expect(siteLayout).toContain("'/components/emoji-renderer.js'");
    expect(siteLayout).toContain('ensureEmojiRuntime()');
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

  test('shared calculator modals keep hero and button SVG icons bounded', async () => {
    const available = await serverAvailable();
    if (!available) {
      if (process.env.CI) throw new Error('Local dev server is required for modal SVG audit');
      return;
    }

    const exitIntentSource = fs.readFileSync(path.join(ROOT, 'calculators', 'exit-intent.js'), 'utf8');
    const authModalSource = fs.readFileSync(path.join(ROOT, 'calculators', 'auth-modal.js'), 'utf8');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });

    async function loadFixture(page, options = {}) {
      const externalStyles = options.externalStyles === false
        ? ''
        : '<link rel="stylesheet" href="' + BASE_URL + '/styles.css">' +
          '<link rel="stylesheet" href="' + BASE_URL + '/styles/institutional-system.css?v=4">';
      await page.setContent(
        '<!doctype html><html lang="ar" dir="rtl"><head>' +
        externalStyles +
        '</head><body><main>fixture</main></body></html>',
        { waitUntil: 'load', timeout: 3500 }
      );
    }

    try {
      const exitPage = await context.newPage();
      await loadFixture(exitPage);
      await exitPage.addScriptTag({ content: exitIntentSource });
      await exitPage.evaluate(() => {
        window._calcCompleted = true;
        document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, bubbles: true }));
      });
      await exitPage.waitForTimeout(50);

      expect(await inspectInterfaceIconSizing(exitPage, 'calculators/exit-intent.js', 'modal-open')).toEqual([]);
      const exitHero = await exitPage.locator('.bonds-exit-modal__icon > svg').boundingBox();
      expect(exitHero.width).toBeLessThanOrEqual(72);
      expect(exitHero.height).toBeLessThanOrEqual(72);
      const exitButtons = exitPage.locator('.bonds-exit-modal__btn > svg');
      expect(await exitButtons.count()).toBeGreaterThan(0);
      for (let i = 0; i < await exitButtons.count(); i++) {
        const box = await exitButtons.nth(i).boundingBox();
        expect(box.width).toBeLessThanOrEqual(32);
        expect(box.height).toBeLessThanOrEqual(32);
      }
      await exitPage.close();

      // Regression for stale/missing shared CSS: the modal scripts themselves must
      // hard-bound their SVGs so an icon can never fill the dialog while a cached
      // stylesheet is still being revalidated.
      const isolatedExitPage = await context.newPage();
      await loadFixture(isolatedExitPage, { externalStyles: false });
      await isolatedExitPage.addScriptTag({ content: exitIntentSource });
      await isolatedExitPage.evaluate(() => {
        window._calcCompleted = true;
        document.dispatchEvent(new MouseEvent('mouseout', { clientY: 0, bubbles: true }));
      });
      await isolatedExitPage.waitForTimeout(50);
      const isolatedExitHero = await isolatedExitPage.locator('.bonds-exit-modal__icon > svg').boundingBox();
      expect(isolatedExitHero.width).toBeLessThanOrEqual(72);
      expect(isolatedExitHero.height).toBeLessThanOrEqual(72);
      const isolatedExitButtons = isolatedExitPage.locator('.bonds-exit-modal__btn > svg');
      expect(await isolatedExitButtons.count()).toBeGreaterThan(0);
      for (let i = 0; i < await isolatedExitButtons.count(); i++) {
        const box = await isolatedExitButtons.nth(i).boundingBox();
        expect(box.width).toBeLessThanOrEqual(32);
        expect(box.height).toBeLessThanOrEqual(32);
      }
      await isolatedExitPage.close();

      const authPage = await context.newPage();
      await loadFixture(authPage);
      await authPage.addScriptTag({ content: authModalSource });
      await authPage.evaluate(() => {
        window.showAuthModal('save', () => {}, () => {}, { calculator: 'medical-viability' });
      });
      await authPage.waitForTimeout(50);

      expect(await inspectInterfaceIconSizing(authPage, 'calculators/auth-modal.js', 'modal-open')).toEqual([]);
      const authHero = await authPage.locator('.bonds-auth-modal__icon > svg').boundingBox();
      expect(authHero.width).toBeLessThanOrEqual(72);
      expect(authHero.height).toBeLessThanOrEqual(72);
      await authPage.close();

      const isolatedAuthPage = await context.newPage();
      await loadFixture(isolatedAuthPage, { externalStyles: false });
      await isolatedAuthPage.addScriptTag({ content: authModalSource });
      await isolatedAuthPage.evaluate(() => {
        window.showAuthModal('save', () => {}, () => {}, { calculator: 'medical-viability' });
      });
      await isolatedAuthPage.waitForTimeout(50);
      const isolatedAuthHero = await isolatedAuthPage.locator('.bonds-auth-modal__icon > svg').boundingBox();
      expect(isolatedAuthHero.width).toBeLessThanOrEqual(72);
      expect(isolatedAuthHero.height).toBeLessThanOrEqual(72);
      await isolatedAuthPage.close();
    } finally {
      await context.close();
      await browser.close();
    }
  });
});
