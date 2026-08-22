/**
 * Real-page dropdown regression test for /calculators/creditworthiness.
 * Blocks auth-gate scripts so the page stays loaded for layout testing.
 */

const { chromium } = require('playwright');

const TEST_URL = 'http://localhost:3005/calculators/creditworthiness.html';

jest.setTimeout(60000);

let browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  if (browser) await browser.close();
});

async function getDropdownState(page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('#country')?.closest('.ud-dropdown');
    const menu = wrap?.querySelector('.ud-menu');
    const trigger = wrap?.querySelector('.ud-trigger');
    const native = wrap?.querySelector('select');
    const body = document.body;
    const doc = document.documentElement;

    const menuRect = menu ? menu.getBoundingClientRect() : null;
    const menuStyle = menu ? getComputedStyle(menu) : null;

    // Check for visible options outside the menu (the dropdown regression signature)
    const allOptions = Array.from(document.querySelectorAll('.ud-option, .ud-item, option'));
    const visibleOutside = allOptions.filter(el => {
      if (menu && menu.contains(el)) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    }).map(el => ({ tag: el.tagName, text: (el.textContent || '').slice(0, 40) }));

    // A field that appears after the country selector; opening the menu must not
    // shift it vertically because the menu is absolutely positioned.
    const nextField = document.querySelector('#financingAmount');
    const nextFieldRect = nextField ? nextField.getBoundingClientRect() : null;

    return {
      menuOpen: menu?.classList.contains('ud-open') ?? false,
      menuVisible: menuStyle ? menuStyle.visibility === 'visible' && menuStyle.opacity !== '0' : false,
      menuStyles: menuStyle ? {
        display: menuStyle.display,
        visibility: menuStyle.visibility,
        opacity: menuStyle.opacity,
        position: menuStyle.position,
        maxHeight: menuStyle.maxHeight,
        overflowY: menuStyle.overflowY,
      } : null,
      menuRect: menuRect ? { width: menuRect.width, height: menuRect.height, top: menuRect.top, left: menuRect.left } : null,
      triggerVisible: trigger ? getComputedStyle(trigger).visibility === 'visible' : false,
      nativeDisplay: native ? getComputedStyle(native).display : null,
      optionCount: menu?.querySelectorAll('.ud-option, .ud-item').length || 0,
      visibleOutsideCount: visibleOutside.length,
      visibleOutside: visibleOutside.slice(0, 10),
      nextFieldTop: nextFieldRect ? nextFieldRect.top : null,
      bodyHeight: body.scrollHeight,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      bodyWidth: body.scrollWidth,
      docWidth: doc.scrollWidth,
      horizontalOverflow: Math.max(body.scrollWidth, doc.scrollWidth) > window.innerWidth,
    };
  });
}

describe('real /calculators/creditworthiness country selector', () => {
  let page;
  const consoleErrors = [];
  const pageErrors = [];

  beforeEach(async () => {
    consoleErrors.length = 0;
    pageErrors.length = 0;

    page = await browser.newPage();

    // Keep the page loaded for CSS/layout testing by blocking the dynamic
    // global auth gate (site-layout.js injects it); local auth scripts see the
    // fake token and do not redirect.
    await page.route(/(\/global-auth-gate|\/calculators\/auth-gate)\.js(?:\?.*)?$/, route => route.abort());

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text().slice(0, 300));
      }
    });
    page.on('pageerror', err => pageErrors.push(err.message.slice(0, 300)));

    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 60000 });
    // Wait for geo data + UD initialization
    await page.waitForTimeout(3000);
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  test('stays on real creditworthiness page and menu is closed by default', async () => {
    expect(page.url()).toBe(TEST_URL);
    const state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);
    expect(state.menuVisible).toBe(false);
    expect(state.nativeDisplay).toBe('none');
    expect(state.visibleOutsideCount).toBe(0);
    expect(state.optionCount).toBeGreaterThanOrEqual(20);
    expect(state.horizontalOverflow).toBe(false);
    // Closed menu must be visually hidden (opacity/visibility), not merely off-screen.
    if (state.menuStyles) {
      expect(state.menuStyles.visibility === 'hidden' || state.menuStyles.opacity === '0').toBe(true);
    }
  });

  test('opens on click, selects Saudi Arabia, and closes', async () => {
    const trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.click();
    await page.waitForTimeout(400);

    let state = await getDropdownState(page);
    expect(state.menuOpen).toBe(true);
    expect(state.menuVisible).toBe(true);
    expect(['absolute', 'fixed']).toContain(state.menuStyles.position);
    expect(parseInt(state.menuStyles.maxHeight, 10)).toBeLessThanOrEqual(400);
    expect(state.menuStyles.overflowY).toBe('auto');
    expect(state.horizontalOverflow).toBe(false);

    // Find and click Saudi Arabia option
    const saOption = page.locator('.ud-dropdown:has(#country) .ud-menu .ud-item, .ud-dropdown:has(#country) .ud-menu .ud-option').filter({ hasText: /السعودية/ }).first();
    await saOption.click();
    await page.waitForTimeout(400);

    state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);
    expect(state.visibleOutsideCount).toBe(0);

    const selectedValue = await page.evaluate(() => document.querySelector('#country')?.value);
    expect(selectedValue).toBe('SA');
  });

  test('closes on outside click and Escape', async () => {
    const trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.click();
    await page.waitForTimeout(400);

    await page.mouse.click(10, 10);
    await page.waitForTimeout(400);
    let state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    state = await getDropdownState(page);
    expect(state.menuOpen).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);
  });

  test('dropdown menu does not shift following fields or expand body', async () => {
    const closedState = await getDropdownState(page);
    expect(closedState.visibleOutsideCount).toBe(0);
    expect(closedState.horizontalOverflow).toBe(false);
    expect(closedState.nextFieldTop).not.toBeNull();

    const trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.click();
    await page.waitForTimeout(400);

    const openState = await getDropdownState(page);
    expect(openState.menuOpen).toBe(true);
    expect(openState.menuVisible).toBe(true);
    expect(['absolute', 'fixed']).toContain(openState.menuStyles.position);
    expect(parseInt(openState.menuStyles.maxHeight, 10)).toBeLessThanOrEqual(400);
    expect(openState.visibleOutsideCount).toBe(0);
    expect(openState.horizontalOverflow).toBe(false);

    // Absolutely-positioned menu must not shift the field below it.
    expect(openState.nextFieldTop).toBeCloseTo(closedState.nextFieldTop, 0);

    // Opening the menu must not blow up the body scroll height.
    const scrollDelta = openState.bodyHeight - closedState.bodyHeight;
    expect(scrollDelta).toBeLessThanOrEqual(50);

    // The menu itself must be the clipped scroll container; no options should
    // appear elsewhere on the page (already covered by visibleOutsideCount).
    expect(openState.menuStyles.overflowY).toBe('auto');
    expect(parseInt(openState.menuStyles.maxHeight, 10)).toBeLessThanOrEqual(400);
  });

  test('has no critical JS errors (allows known env/api errors)', async () => {
    // Filter out known environment/API errors unrelated to CSS/JS/layout
    const critical = consoleErrors.filter(e =>
      !e.includes('Sentry') &&
      !e.includes('Supabase') &&
      !e.includes('500') &&
      !e.includes('Failed to load resource') &&
      !e.includes('auth') &&
      !e.includes('Not initialized')
    );
    expect(pageErrors).toEqual([]);
    expect(critical).toEqual([]);
  });
});
