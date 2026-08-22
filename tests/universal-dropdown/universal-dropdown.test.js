const { chromium } = require('playwright');
const path = require('path');

const TEST_PAGE = path.resolve(__dirname, 'test-page.html');

jest.setTimeout(15000);

let browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  if (browser) await browser.close();
});

async function pageWithErrors() {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page._flushErrors = () => errors;
  return page;
}

function wrapperBySelectId(page, id) {
  return page.locator('.ud-dropdown:has(#' + id + ')');
}

describe('UniversalDropdown', () => {
  test('enhances selects and keeps value sync', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapperCount = await page.locator('.ud-dropdown').count();
    expect(wrapperCount).toBe(10);

    const selected = await page.evaluate(() => document.getElementById('ratingSelect').value);
    expect(selected).toBe('3');

    const triggerText = await wrapperBySelectId(page, 'ratingSelect').locator('.ud-trigger-value').textContent();
    expect(triggerText).toBe('3');

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('search filters items', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'countrySelect');
    await wrapper.locator('.ud-trigger').click();
    await wrapper.locator('.ud-search input').fill('مص');
    await page.waitForTimeout(200); // debounce
    const items = await wrapper.locator('.ud-item').allTextContents();
    expect(items).toEqual(['مصر']);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('sort, deduplicate and remove empty', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'countrySelect');
    await wrapper.locator('.ud-trigger').click();
    const items = await wrapper.locator('.ud-item').allTextContents();
    // Empty removed, duplicates removed, sorted alphabetically
    expect(items).toEqual(['الأردن', 'الإمارات', 'السعودية', 'مصر']);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('removes sentinel unknown/empty values', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'sentinelSelect');
    await wrapper.locator('.ud-trigger').click();
    const items = await wrapper.locator('.ud-item').allTextContents();
    expect(items).toEqual(['السعودية', 'مصر']);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('hover uses solid gold background and black text', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'countrySelect');
    await wrapper.locator('.ud-trigger').click();
    const item = wrapper.locator('.ud-item').first();
    await item.hover();
    const bg = await item.evaluate(el => getComputedStyle(el).backgroundColor);
    const color = await item.evaluate(el => getComputedStyle(el).color);
    expect(bg).toBe('rgb(212, 169, 74)'); // #D4A94A
    expect(color).toBe('rgb(0, 0, 0)'); // #000000

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('renders icons from data-icon in items and trigger', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'iconSelect');
    await wrapper.locator('.ud-trigger').click();

    const firstItemIcon = await wrapper.locator('.ud-item').first().locator('.ud-icon').innerHTML();
    expect(firstItemIcon).toContain('<svg');

    await wrapper.locator('.ud-item').filter({ hasText: 'الإمارات' }).click();
    const triggerIcon = await wrapper.locator('.ud-trigger-value .ud-icon').innerHTML();
    expect(triggerIcon).toContain('<svg');
    const triggerText = await wrapper.locator('.ud-trigger-value').textContent();
    expect(triggerText).toContain('الإمارات');

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('selecting an item updates native select', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'ratingSelect');
    await wrapper.locator('.ud-trigger').click();
    await wrapper.locator('.ud-item').filter({ hasText: '5' }).click();

    const value = await page.evaluate(() => document.getElementById('ratingSelect').value);
    expect(value).toBe('5');

    const triggerText = await wrapper.locator('.ud-trigger-value').textContent();
    expect(triggerText).toBe('5');

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('light theme applied from ancestor', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const lightWrapper = wrapperBySelectId(page, 'lightSelect');
    const theme = await lightWrapper.getAttribute('data-ud-theme');
    expect(theme).toBe('light');

    const bg = await lightWrapper.locator('.ud-trigger').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('uses native select on mobile for short lists', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 }, hasTouch: true });
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    // ratingSelect has 5 options, should remain native on touch
    const ratingNative = await page.locator('#ratingSelect').evaluate(el => {
      return !el.closest('.ud-dropdown') && el.offsetParent !== null;
    });
    expect(ratingNative).toBe(true);

    // longSelect has 8 options, should be enhanced even on touch
    const longEnhanced = await wrapperBySelectId(page, 'longSelect').count();
    expect(longEnhanced).toBe(1);

    await page.close();
  });

  test('multi-select renders initial selections as chips', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const chips = await wrapperBySelectId(page, 'multiSelect').locator('.ud-chip').allTextContents();
    expect(chips.sort()).toEqual(['خيار 1', 'خيار 3'].sort());

    const selected = await page.evaluate(() =>
      Array.from(document.getElementById('multiSelect').selectedOptions).map(o => o.value)
    );
    expect(selected.sort()).toEqual(['m1', 'm3'].sort());

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('multi-select toggles options', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'multiSelect');
    await wrapper.locator('.ud-trigger').click();
    await wrapper.locator('.ud-item').filter({ hasText: 'خيار 2' }).click();

    const selected = await page.evaluate(() =>
      Array.from(document.getElementById('multiSelect').selectedOptions).map(o => o.value)
    );
    expect(selected.sort()).toEqual(['m1', 'm2', 'm3'].sort());

    await wrapper.locator('.ud-item').filter({ hasText: 'خيار 1' }).click();
    const selected2 = await page.evaluate(() =>
      Array.from(document.getElementById('multiSelect').selectedOptions).map(o => o.value)
    );
    expect(selected2.sort()).toEqual(['m2', 'm3'].sort());

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('multi-select select all and clear all buttons work', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'multiSelect');
    await wrapper.locator('.ud-trigger').click();

    await wrapper.locator('.ud-action-btn').filter({ hasText: 'تحديد الكل' }).click();
    const allSelected = await page.evaluate(() =>
      Array.from(document.getElementById('multiSelect').selectedOptions).map(o => o.value)
    );
    expect(allSelected.sort()).toEqual(['m1', 'm2', 'm3'].sort());

    await wrapper.locator('.ud-action-btn').filter({ hasText: 'إلغاء التحديد' }).click();
    const noneSelected = await page.evaluate(() =>
      Array.from(document.getElementById('multiSelect').selectedOptions).map(o => o.value)
    );
    expect(noneSelected).toEqual([]);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('virtualization renders only visible slice of long list', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'virtualSelect');
    await wrapper.locator('.ud-trigger').click();

    const rendered = await wrapper.locator('.ud-item').count();
    expect(rendered).toBeLessThan(100);
    expect(rendered).toBeGreaterThan(0);

    const listHeight = await wrapper.locator('.ud-list').evaluate(el => el.style.height);
    expect(parseInt(listHeight)).toBeGreaterThan(0);

    // Scroll to bottom and verify new items render
    await wrapper.locator('.ud-menu').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(100);
    const lastItem = await wrapper.locator('.ud-item').last().textContent();
    expect(lastItem).toContain('خيار 100');

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('search clear button clears the filter', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'countrySelect');
    await wrapper.locator('.ud-trigger').click();
    await wrapper.locator('.ud-search input').fill('مص');
    await page.waitForTimeout(200); // debounce
    let items = await wrapper.locator('.ud-item').count();
    expect(items).toBe(1);

    await wrapper.locator('.ud-search-clear').click();
    await page.waitForTimeout(200); // debounce
    items = await wrapper.locator('.ud-item').count();
    expect(items).toBe(4);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('MutationObserver auto-inits dynamically added select', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      const s = document.createElement('select');
      s.id = 'dynamicObserverSelect';
      s.setAttribute('data-universal-dropdown', 'true');
      s.innerHTML = '<option value="a">A</option><option value="b">B</option>';
      document.body.appendChild(s);
    });
    await page.waitForTimeout(200);

    const wrapperCount = await wrapperBySelectId(page, 'dynamicObserverSelect').count();
    expect(wrapperCount).toBe(1);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('optgroups render headers and search filters within groups', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const wrapper = wrapperBySelectId(page, 'groupSelect');
    await wrapper.locator('.ud-trigger').click();
    const headers = await wrapper.locator('.ud-group-header').allTextContents();
    expect(headers).toEqual(['المجموعة أ', 'المجموعة ب']);

    await wrapper.locator('.ud-search input').fill('ب1');
    await page.waitForTimeout(200); // debounce
    const items = await wrapper.locator('.ud-item').allTextContents();
    expect(items).toEqual(['عنصر ب1']);
    const visibleHeaders = await wrapper.locator('.ud-group-header').allTextContents();
    expect(visibleHeaders).toEqual(['المجموعة ب']);

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });

  test('setLoading shows loading state', async () => {
    const page = await pageWithErrors();
    await page.goto('file://' + TEST_PAGE);
    await page.waitForTimeout(300);

    const loadingText = await page.evaluate(() => {
      const select = document.createElement('select');
      document.body.appendChild(select);
      const dd = window.UniversalDropdown.fromSelect(select, { loadingText: 'جاري التحميل...' });
      dd.setLoading(true);
      dd.open();
      return dd.listEl.querySelector('.ud-loading')?.textContent;
    });
    expect(loadingText).toBe('جاري التحميل...');

    expect(page._flushErrors()).toEqual([]);
    await page.close();
  });
});
