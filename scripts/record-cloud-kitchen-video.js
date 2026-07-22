#!/usr/bin/env node
/**
 * Bonds Global — Record a demo video of the Cloud Kitchen calculator.
 *
 * Usage:
 *   node scripts/record-cloud-kitchen-video.js
 *
 * Output:
 *   .tmp-pdf/cloud-kitchen-demo.webm
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.tmp-pdf');
const OUT_FILE = path.join(OUT_DIR, 'cloud-kitchen-demo.webm');
const PORT = 3456; // Use a non-conflicting port
const BASE_URL = `http://localhost:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['scripts/dev-server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'ignore',
    });

    // Wait for server to be ready
    let attempts = 0;
    const maxAttempts = 30;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${BASE_URL}/`);
        if (res.ok) {
          clearInterval(timer);
          resolve(proc);
        }
      } catch (e) {
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          proc.kill();
          reject(new Error('Dev server did not start in time'));
        }
      }
    }, 1000);
  });
}

async function stopServer(proc) {
  if (proc && !proc.killed) {
    proc.kill('SIGTERM');
    await wait(1000);
    if (!proc.killed) proc.kill('SIGKILL');
  }
}

async function addOverlay(page, text, options = {}) {
  const {
    top = '10%',
    left = '50%',
    duration = 3000,
    bg = 'rgba(10,15,26,0.92)',
    color = '#f0c96a',
    fontSize = '1.6rem',
    width = 'auto',
    maxWidth = '80%',
  } = options;

  const id = ' bonds-demo-overlay-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  await page.evaluate(
    ({ id, text, top, left, bg, color, fontSize, width, maxWidth }) => {
      const el = document.createElement('div');
      el.id = id;
      el.textContent = text;
      el.style.cssText = `
        position: fixed;
        top: ${top};
        left: ${left};
        transform: translate(-50%, 0);
        z-index: 2147483647;
        background: ${bg};
        color: ${color};
        font-size: ${fontSize};
        font-weight: 800;
        padding: 1rem 1.5rem;
        border-radius: 16px;
        border: 2px solid rgba(212,168,83,0.4);
        box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        text-align: center;
        width: ${width};
        max-width: ${maxWidth};
        font-family: Vazirmatn, system-ui, sans-serif;
        line-height: 1.5;
        pointer-events: none;
        direction: rtl;
        opacity: 0;
        transition: opacity 0.5s ease;
      `;
      document.body.appendChild(el);
      requestAnimationFrame(() => (el.style.opacity = '1'));
    },
    { id, text, top, left, bg, color, fontSize, width, maxWidth }
  );

  await wait(duration);

  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }
  }, id);

  await wait(500);
}

async function highlightElement(page, selector, options = {}) {
  const { duration = 1500, label = '' } = options;
  const id = 'bonds-demo-highlight-' + Date.now() + '-' + Math.random().toString(36).slice(2);

  await page.evaluate(
    ({ selector, id, label }) => {
      const target = document.querySelector(selector);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const box = document.createElement('div');
      box.id = id;
      box.style.cssText = `
        position: fixed;
        top: ${rect.top - 8}px;
        left: ${rect.left - 8}px;
        width: ${rect.width + 16}px;
        height: ${rect.height + 16}px;
        border: 3px dashed #f0c96a;
        border-radius: 12px;
        z-index: 2147483646;
        pointer-events: none;
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.35);
      `;
      if (label) {
        const badge = document.createElement('div');
        badge.textContent = label;
        badge.style.cssText = `
          position: absolute;
          top: -36px;
          right: 0;
          background: #f0c96a;
          color: #0a0f1a;
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          font-family: Vazirmatn, system-ui, sans-serif;
          direction: rtl;
        `;
        box.appendChild(badge);
      }
      document.body.appendChild(box);
    },
    { selector, id, label }
  );

  await wait(duration);

  await page.evaluate((id) => {
    const el = document.getElementById(id);
    if (el) el.remove();
  }, id);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);

  let serverProc;
  try {
    console.log('Starting dev server on port', PORT);
    serverProc = await startServer();
    console.log('Server ready');

    console.log('Launching browser and starting video recording...');
    const browser = await chromium.launch();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
      locale: 'ar-SA',
    });

    // Bypass auth gate by injecting a fake token before any page script runs
    await context.addInitScript(() => {
      localStorage.setItem('bonds-auth-token', 'demo-token-for-video-recording');
    });

    const page = await context.newPage();

    // Load calculator
    await page.goto(`${BASE_URL}/calculators/investment-center/cloud-kitchen.html`, {
      waitUntil: 'networkidle',
    });

    // Wait for universal dropdown and layout to settle
    await wait(1500);

    // Scene 1: Title
    await addOverlay(page, 'حاسبة مطبخ سحابي من بوندز\nحلل جدوى مشروعك في دقائق', {
      top: '35%',
      duration: 3500,
      fontSize: '2rem',
      maxWidth: '70%',
    });

    // Scene 2: Show inputs panel
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(500);
    await addOverlay(page, 'أدخل بيانات مشروعك بسهولة', { top: '8%', duration: 2500 });

    await highlightElement(page, '#dailyOrders', { label: 'عدد الطلبات اليومية', duration: 1800 });
    await highlightElement(page, '#avgTicketValue', { label: 'متوسط قيمة الطلب', duration: 1800 });
    await highlightElement(page, '#setupCost', { label: 'تكلفة التجهيز', duration: 1800 });
    await highlightElement(page, '#foodCostRate', { label: 'تكلفة الطعام %', duration: 1800 });
    await highlightElement(page, '#monthlyRentSalaries', { label: 'الإيجار + الرواتب', duration: 1800 });

    // Scene 3: Scroll to platform costs
    await page.evaluate(() => {
      const el = document.querySelector('#platformSetupFee');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await wait(500);
    await addOverlay(page, 'وأيضاً تكاليف المنصات والتوصيل الخفية', { top: '12%', duration: 2500 });
    await highlightElement(page, '#platformCommissionRate', { label: 'عمولة المنصة', duration: 1800 });
    await highlightElement(page, '#deliveryFeePerOrder', { label: 'رسوم التوصيل', duration: 1800 });
    await highlightElement(page, '#packagingCostPerOrder', { label: 'تكلفة التغليف', duration: 1800 });

    // Scene 4: Click calculate
    await page.evaluate(() => {
      const el = document.querySelector('#platformSetupFee');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await wait(500);
    const calculateBtn = await page.$('#calculateBtn, button[onclick*="calculate"], .investment-form__submit');
    if (calculateBtn) {
      await highlightElement(page, '#calculateBtn, button[onclick*="calculate"], .investment-form__submit', {
        label: 'اضغط حساب',
        duration: 1500,
      });
      await calculateBtn.click();
    } else {
      // Trigger calculate directly if button selector is uncertain
      await page.evaluate(() => {
        if (typeof calculate === 'function') calculate();
      });
    }
    await wait(2000);

    // Scene 5: Results
    await page.evaluate(() => {
      const el = document.getElementById('resultsSection');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await wait(800);
    await addOverlay(page, 'النتائج المالية تظهر فوراً', { top: '8%', duration: 2500 });
    await highlightElement(page, '#metricRoi', { label: 'ROI', duration: 1500 });
    await highlightElement(page, '#metricIrr', { label: 'IRR', duration: 1500 });
    await highlightElement(page, '#metricNpv', { label: 'NPV', duration: 1500 });
    await highlightElement(page, '#metricPayback', { label: 'فترة الاسترداد', duration: 1500 });
    await highlightElement(page, '#metricBreakEven', { label: 'نقطة التعادل', duration: 1500 });

    // Scene 6: Hidden costs
    await page.evaluate(() => {
      const el = document.querySelector('.hidden-costs-analysis');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await wait(800);
    await addOverlay(page, 'تحليل التكاليف الخفية يكشف الربح الحقيقي', { top: '8%', duration: 2500 });
    await highlightElement(page, '#hcaApparentProfit', { label: 'الربح الظاهر', duration: 1500 });
    await highlightElement(page, '#hcaHiddenCosts', { label: 'التكاليف الخفية', duration: 1500 });
    await highlightElement(page, '#hcaRealProfit', { label: 'الربح الحقيقي', duration: 1500 });

    // Scene 7: Recommendation
    await page.evaluate(() => {
      const el = document.getElementById('recommendationBar');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await wait(800);
    await addOverlay(page, 'والتوصية النهائية مع درجة المخاطرة', { top: '15%', duration: 2500 });

    // Scene 8: Decision intelligence
    await page.evaluate(() => {
      const el = document.getElementById('decisionIntelligencePanel');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await wait(800);
    await addOverlay(page, 'طبقة الذكاء الاقتصادي لدعم قرارك', { top: '8%', duration: 2500 });

    // Scene 9: End card
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(500);
    await addOverlay(page, 'جرب الحاسبة الآن\nbonds-global.com/calculators/investment-center/cloud-kitchen', {
      top: '35%',
      duration: 4000,
      fontSize: '1.8rem',
      maxWidth: '75%',
    });

    await wait(1000);

    await context.close();
    await browser.close();

    // Playwright saves the video with a random name; rename it.
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
    if (files.length === 0) {
      throw new Error('No video file was produced');
    }
    const latest = files
      .map((f) => ({ name: f, time: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time)[0].name;
    fs.renameSync(path.join(OUT_DIR, latest), OUT_FILE);

    console.log('Video saved to:', OUT_FILE);
  } catch (err) {
    console.error('Recording failed:', err.message);
    process.exitCode = 1;
  } finally {
    await stopServer(serverProc);
  }
}

main();
