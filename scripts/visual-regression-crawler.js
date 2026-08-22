/**
 * Visual Regression Crawler
 * Crawls the static site and checks every HTML page at multiple viewports.
 *
 * Load strategy:
 *   - goto with waitUntil: 'domcontentloaded'
 *   - short settle wait (1200 ms)
 *   - per-page timeout 20 s; on timeout the viewport is marked FAILED/TIMEDOUT
 *     and the crawler continues.
 *
 * Usage:
 *   node scripts/visual-regression-crawler.js [baseUrl] [maxPages] [offset]
 * Defaults: baseUrl=http://localhost:3005, maxPages=0 (all), offset=0
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.argv[2] || 'http://localhost:3005';
const MAX_PAGES = parseInt(process.argv[3] || '0', 10);
const OFFSET = parseInt(process.argv[4] || '0', 10);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'tmp-crawler');

const PAGE_TIMEOUT_MS = 20000;
const SETTLE_MS = 1200;
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
];

function discoverHtmlFiles() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.vercel', 'tmp-crawler', 'tmp'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(full);
      }
    }
  }
  walk(PROJECT_ROOT);
  return files.map(f => {
    const rel = '/' + path.relative(PROJECT_ROOT, f).replace(/\\/g, '/');
    return rel.replace(/\/index\.html$/, '/');
  });
}

async function auditPage(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const bodyWidth = body ? body.scrollWidth : 0;
    const docWidth = doc.scrollWidth;
    const overflowX = Math.max(bodyWidth, docWidth) > winW;

    const hiddenVisible = [];
    document.querySelectorAll('[hidden], .ud-menu:not(.ud-open), .dropdown-menu:not(.is-open), [aria-hidden="true"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      if (visible) {
        const cls = (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '').slice(0, 80);
        hiddenVisible.push({ tag: el.tagName, class: cls, rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } });
      }
    });

    const openDropdowns = [];
    document.querySelectorAll('.ud-menu.ud-open, .dropdown.is-open .dropdown-menu, .dropdown-menu.is-open, [aria-expanded="true"]').forEach(el => {
      openDropdowns.push({ tag: el.tagName, class: el.className?.slice(0, 80) });
    });

    const fixedOverlays = [];
    document.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      if ((style.position === 'fixed' || style.position === 'sticky') && parseFloat(style.zIndex) > 100) {
        const rect = el.getBoundingClientRect();
        if (rect.width >= winW * 0.9 && rect.height >= winH * 0.9) {
          const cls = (typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '').slice(0, 80);
        fixedOverlays.push({ tag: el.tagName, class: cls, rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }, zIndex: style.zIndex });
        }
      }
    });

    const contrastIssues = [];
    if (body) {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
      const checked = new Set();
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (!text || text.length < 2) continue;
        const parent = node.parentElement;
        if (!parent) continue;
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const key = style.color + '|' + style.backgroundColor + '|' + style.fontSize;
        if (checked.has(key)) continue;
        checked.add(key);
        const color = style.color;
        const bg = style.backgroundColor;
        const fontSize = parseFloat(style.fontSize);
        const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/;
        const cm = color.match(m);
        const bm = bg.match(m);
        const isLight = vals => vals && vals[1] > 180 && vals[2] > 180 && vals[3] > 180;
        const isDark = vals => vals && vals[1] < 80 && vals[2] < 80 && vals[3] < 80;
        if ((isLight(cm) && isLight(bm)) || (isDark(cm) && isDark(bm))) {
          contrastIssues.push({ color, bg, fontSize, text: text.slice(0, 60) });
        }
      }
    }

    return {
      overflowX,
      bodyWidth,
      docWidth,
      winW,
      hiddenVisibleCount: hiddenVisible.length,
      hiddenVisible: hiddenVisible.slice(0, 10),
      openDropdownsCount: openDropdowns.length,
      openDropdowns: openDropdowns.slice(0, 10),
      fixedOverlaysCount: fixedOverlays.length,
      fixedOverlays: fixedOverlays.slice(0, 5),
      contrastIssuesCount: contrastIssues.length,
      contrastIssues: contrastIssues.slice(0, 10),
    };
  });
}

async function testPage(browser, pagePath) {
  const url = BASE_URL.replace(/\/$/, '') + pagePath;
  const result = { path: pagePath, url, viewports: {} };
  const context = await browser.newContext();
  // Block the dynamic auth gate so protected pages load for layout testing.
  await context.route(/global-auth-gate\.js/, route => route.abort());

  for (const vp of VIEWPORTS) {
    const page = await context.newPage({ viewport: vp });
    const shared = { consoleErrors: [], pageErrors: [], failedRequests: [] };
    page.on('console', msg => {
      if (msg.type() === 'error') shared.consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', err => shared.pageErrors.push(err.message.slice(0, 300)));
    page.on('response', res => {
      const status = res.status();
      const reqUrl = res.url();
      if (status >= 400 && !reqUrl.includes('favicon')) {
        shared.failedRequests.push({ url: reqUrl, status });
      }
    });

    const start = Date.now();
    let timedOut = false;
    let error = null;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(SETTLE_MS);
      const audit = await auditPage(page);
      result.viewports[vp.name] = {
        status: 'ok',
        elapsedMs: Date.now() - start,
        ...audit,
        consoleErrors: shared.consoleErrors.slice(),
        pageErrors: shared.pageErrors.slice(),
        failedRequests: shared.failedRequests.slice(),
      };
    } catch (err) {
      timedOut = err.message && err.message.toLowerCase().includes('timeout');
      error = err.message;
      result.viewports[vp.name] = {
        status: timedOut ? 'timedout' : 'error',
        elapsedMs: Date.now() - start,
        timedOut,
        error,
        consoleErrors: shared.consoleErrors.slice(),
        pageErrors: shared.pageErrors.slice(),
        failedRequests: shared.failedRequests.slice(),
      };
    }
    await page.close();
  }

  await context.close();
  return result;
}

function classifyResult(r) {
  let hasError = false;
  let hasTimeout = false;
  let hasIssue = false;
  for (const vp of VIEWPORTS) {
    const v = r.viewports[vp.name];
    if (!v) { hasError = true; continue; }
    if (v.status === 'timedout') hasTimeout = true;
    if (v.status === 'error') hasError = true;
    if (v.status === 'ok') {
      if (v.overflowX || v.hiddenVisibleCount > 0 || v.openDropdownsCount > 0 ||
          v.fixedOverlaysCount > 0 || v.contrastIssuesCount > 0 ||
          v.consoleErrors.length > 0 || v.pageErrors.length > 0 || v.failedRequests.length > 0) {
        hasIssue = true;
      }
    }
  }
  if (hasError) return 'failed';
  if (hasTimeout) return 'timedout';
  if (hasIssue) return 'failed';
  return 'passed';
}

function generateMarkdown(summary, results, outFile) {
  const lines = [
    '# Visual Regression Crawler Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Base URL: ${BASE_URL}`,
    '',
    '## Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Discovered | ${summary.discovered} |`,
    `| Processed | ${summary.processed} |`,
    `| Passed | ${summary.passed} |`,
    `| Failed | ${summary.failed} |`,
    `| Timed out | ${summary.timedOut} |`,
    `| Skipped | ${summary.skipped} |`,
    `| Total | ${summary.discovered} |`,
    '',
    '## Issue Types',
    '',
    '| Type | Count |',
    '|------|-------|',
    ...Object.entries(summary.issueTypes).map(([k, v]) => `| ${k} | ${v} |`),
    '',
    '## Failed / Timed-out Pages',
    '',
    '| Path | Status | Issues |',
    '|------|--------|--------|',
    ...results
      .filter(r => ['failed', 'timedout'].includes(r.classification))
      .map(r => `| ${r.path} | ${r.classification} | ${r.issueSummary || '-'} |`),
    '',
    `## Full JSON results`,
    '',
    `[${path.basename(outFile)}](${path.basename(outFile)})`,
    '',
  ];
  return lines.join('\n');
}

async function run() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const allPaths = discoverHtmlFiles();
  let pagesToTest = allPaths;
  if (OFFSET > 0) pagesToTest = pagesToTest.slice(OFFSET);
  if (MAX_PAGES > 0) pagesToTest = pagesToTest.slice(0, MAX_PAGES);

  console.log(`Discovered ${allPaths.length} HTML files; testing ${pagesToTest.length} (offset ${OFFSET}, max ${MAX_PAGES || 'unlimited'})`);

  const browser = await chromium.launch();
  const allResults = [];

  const CONCURRENCY = 2;
  async function runBatch(batch, offset) {
    const batchResults = await Promise.all(batch.map(p => testPage(browser, p)));
    for (const r of batchResults) {
      r.classification = classifyResult(r);
      r.issueSummary = VIEWPORTS.map(vp => {
        const v = r.viewports[vp.name];
        if (!v) return null;
        const parts = [];
        if (v.status !== 'ok') parts.push(`${vp.name}:${v.status}`);
        else {
          if (v.overflowX) parts.push(`${vp.name}:overflow`);
          if (v.hiddenVisibleCount) parts.push(`${vp.name}:hiddenVisible`);
          if (v.openDropdownsCount) parts.push(`${vp.name}:openDropdown`);
          if (v.fixedOverlaysCount) parts.push(`${vp.name}:overlay`);
          if (v.contrastIssuesCount) parts.push(`${vp.name}:contrast`);
          if (v.consoleErrors.length) parts.push(`${vp.name}:consoleError`);
          if (v.pageErrors.length) parts.push(`${vp.name}:pageError`);
          if (v.failedRequests.length) parts.push(`${vp.name}:failedRequest`);
        }
        return parts.length ? parts.join(', ') : null;
      }).filter(Boolean).join('; ');
      allResults.push(r);
    }
    console.log(`  processed ${Math.min(offset + batch.length, pagesToTest.length)}/${pagesToTest.length} pages`);
  }

  for (let i = 0; i < pagesToTest.length; i += CONCURRENCY) {
    const batch = pagesToTest.slice(i, i + CONCURRENCY);
    await runBatch(batch, i);
    // Small breather to avoid overwhelming the local dev server (429s).
    if (i + CONCURRENCY < pagesToTest.length) await new Promise(r => setTimeout(r, 300));
  }

  await browser.close();

  const issueTypes = {};
  let passed = 0, failed = 0, timedOut = 0;
  for (const r of allResults) {
    if (r.classification === 'passed') passed++;
    else if (r.classification === 'timedout') timedOut++;
    else failed++;
    for (const vp of VIEWPORTS) {
      const v = r.viewports[vp.name];
      if (!v || v.status !== 'ok') continue;
      const checks = [
        ['overflowX', v.overflowX],
        ['hiddenVisible', v.hiddenVisibleCount > 0],
        ['openDropdowns', v.openDropdownsCount > 0],
        ['fixedOverlays', v.fixedOverlaysCount > 0],
        ['contrastIssues', v.contrastIssuesCount > 0],
        ['consoleErrors', v.consoleErrors.length > 0],
        ['pageErrors', v.pageErrors.length > 0],
        ['failedRequests', v.failedRequests.length > 0],
      ];
      for (const [name, flag] of checks) {
        if (flag) issueTypes[name] = (issueTypes[name] || 0) + 1;
      }
    }
  }

  const summary = {
    discovered: allPaths.length,
    processed: allResults.length,
    passed,
    failed,
    timedOut,
    skipped: allPaths.length - pagesToTest.length - (OFFSET > 0 ? OFFSET : 0),
    total: allPaths.length,
    issueTypes,
    pages: allResults.filter(r => r.classification !== 'passed').map(r => ({
      path: r.path,
      classification: r.classification,
      issueSummary: r.issueSummary,
    })),
  };

  const timestamp = Date.now();
  const jsonFile = path.join(OUTPUT_DIR, `crawl-results-${timestamp}.json`);
  const mdFile = path.join(OUTPUT_DIR, `crawl-results-${timestamp}.md`);
  fs.writeFileSync(jsonFile, JSON.stringify({ summary, results: allResults }, null, 2));
  fs.writeFileSync(mdFile, generateMarkdown(summary, allResults, jsonFile));

  console.log('\nCrawl complete.');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`JSON: ${jsonFile}`);
  console.log(`Markdown: ${mdFile}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
