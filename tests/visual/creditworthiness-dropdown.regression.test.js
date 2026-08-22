/**
 * Dropdown regression test for /calculators/creditworthiness country selector.
 * Verifies the UD country selector:
 *  - is closed by default
 *  - opens on click
 *  - closes on outside click / Escape
 *  - supports keyboard navigation
 *  - does not expand page height
 *  - uses internal scroll for long lists
 */

const { chromium } = require('playwright');

const TEST_URL = 'http://localhost:3005/tests/visual/fixtures/creditworthiness-dropdown-test.html';

jest.setTimeout(30000);

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
    return {
      menuOpen: menu?.classList.contains('ud-open'),
      menuVisible: menu ? getComputedStyle(menu).visibility === 'visible' && getComputedStyle(menu).opacity !== '0' : false,
      menuStyles: menu ? {
        display: getComputedStyle(menu).display,
        visibility: getComputedStyle(menu).visibility,
        opacity: getComputedStyle(menu).opacity,
        position: getComputedStyle(menu).position,
        maxHeight: getComputedStyle(menu).maxHeight,
        overflowY: getComputedStyle(menu).overflowY,
      } : null,
      triggerVisible: trigger ? getComputedStyle(trigger).visibility === 'visible' : false,
      nativeDisplay: native ? getComputedStyle(native).display : null,
      optionCount: menu?.querySelectorAll('.ud-option, .ud-item').length || 0,
      bodyHeight: document.body.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
}

describe('creditworthiness country selector', () => {
  let page;

  beforeEach(async () => {
    page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    await page.goto(TEST_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  test('is closed by default and native select is hidden', async () => {
    const state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);
    expect(state.menuVisible).toBe(false);
    expect(state.nativeDisplay).toBe('none');
    expect(state.optionCount).toBeGreaterThanOrEqual(20);
    expect(state.bodyHeight).toBeLessThanOrEqual(state.viewportHeight * 1.2);
  });

  test('opens on click and has constrained internal scroll', async () => {
    const trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.click();
    await page.waitForTimeout(300);
    const state = await getDropdownState(page);
    expect(state.menuOpen).toBe(true);
    expect(state.menuVisible).toBe(true);
    expect(['absolute', 'fixed']).toContain(state.menuStyles.position);
    expect(parseInt(state.menuStyles.maxHeight, 10)).toBeLessThanOrEqual(400);
    expect(state.menuStyles.overflowY).toBe('auto');
    expect(state.bodyHeight).toBeLessThanOrEqual(state.viewportHeight * 1.2);
  });

  test('closes after selection and updates value', async () => {
    const trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.click();
    await page.waitForTimeout(300);
    const option = page.locator('.ud-dropdown:has(#country) .ud-menu .ud-item, .ud-dropdown:has(#country) .ud-menu .ud-option').first();
    await option.click();
    await page.waitForTimeout(300);
    const state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);
    const selectedValue = await page.evaluate(() => document.querySelector('#country')?.value);
    expect(selectedValue).toMatch(/^[A-Z]{2}$/);
  });

  test('closes on outside click', async () => {
    const trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.click();
    await page.waitForTimeout(300);
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
    const state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);
  });

  test('supports keyboard ArrowDown, Escape, and Space', async () => {
    let trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    let state = await getDropdownState(page);
    expect(state.menuOpen).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    state = await getDropdownState(page);
    expect(state.menuOpen).toBe(false);

    trigger = page.locator('#country').locator('..').locator('.ud-trigger');
    await trigger.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    state = await getDropdownState(page);
    expect(state.menuOpen).toBe(true);
  });
});
