/** @jest-environment node */
const fs = require('fs');
const { chromium } = require('playwright');

const widget = fs.readFileSync('v3/components/ai-chat-widget.js', 'utf8');
const homepageCss = fs.readFileSync('styles/bonds-redesign-2026.css', 'utf8');
let browser;

beforeAll(async () => { browser = await chromium.launch({ headless: true }); }, 30000);
afterAll(async () => { if (browser) await browser.close(); });

test('assistant composer and mobile CTA remain usable without posting any message', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  try {
    await page.route('https://assistant-ui-fixture.test/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/') {
        return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="ar" dir="rtl"><body class="bonds-redesign"><button id="bondsServiceStart" style="position:fixed;bottom:16px;left:12px;width:110px;height:44px">Service CTA</button></body></html>'
        });
      }
      return route.fulfill({ contentType: 'application/json', body: '{"services":[],"notifications":[],"checks":{}}' });
    });
    await page.goto('https://assistant-ui-fixture.test/');
    await page.addStyleTag({ content: homepageCss });
    await page.addScriptTag({ content: widget });
    await page.evaluate(() => window.BondsAIChat.mount({ global: true, pagePath: '/' }));

    const launcher = page.getByRole('button', { name: 'فتح مساعد بوندز' });
    await expectVisible(launcher);
    await page.evaluate(() => document.body.classList.add('bonds-service-cta-visible'));
    await expectVisible(launcher);
    // Small phone, standard phone, tall phone: never obscure the primary service CTA.
    for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await expectVisible(launcher);
      const geometry = await page.evaluate(() => {
        const launcher = document.querySelector('#bonds-ai-chat-root .bonds-ai-chat-toggle').getBoundingClientRect();
        const cta = document.querySelector('#bondsServiceStart').getBoundingClientRect();
        return { launcher: { top: launcher.top, bottom: launcher.bottom }, cta: { top: cta.top } };
      });
      expect(geometry.launcher.bottom).toBeLessThan(geometry.cta.top);
    }

    await launcher.click();
    const composer = page.getByRole('textbox', { name: 'اكتب سؤالك هنا...' });
    await expectVisible(composer);
    expect(await composer.evaluate(el => el.tagName)).toBe('TEXTAREA');
    await composer.fill('test');
    await composer.press('Shift+Enter');
    expect(await composer.inputValue()).toBe('test\n');
    await composer.press('Escape');
    await page.waitForFunction(() => document.querySelector('.bonds-ai-chat-window').getAttribute('aria-hidden') === 'true');
    expect(await launcher.evaluate(el => el === document.activeElement)).toBe(true);
  } finally {
    await page.close();
  }
}, 30000);

async function expectVisible(locator) {
  await locator.waitFor({ state: 'visible' });
}
