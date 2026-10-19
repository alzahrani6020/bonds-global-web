/** @jest-environment node */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'calculators/break-even.html'), 'utf8');

describe('Break-even institutional shell', () => {
  test('uses the unified Bonds site shell and navigation context', () => {
    expect(page).toContain('<div id="site-header"></div>');
    expect(page).toContain('<div id="site-footer"></div>');
    expect(page).toContain('href="/">الرئيسية</a>');
    expect(page).toContain('href="/calculator.html">الحاسبات</a>');
    expect(page).toContain('<script defer src="../site-layout.js?v=3.2.2"></script>');
    expect(page).toContain('assets/bonds-mark.svg');
  });

  test('shows Saudi calculation timestamp and preserves engine version', () => {
    expect(page).toContain("const SAUDI_TIME_ZONE='Asia/Riyadh'");
    expect(page).toContain("appVersion:'3.1.2'");
    expect(page).toContain("workspaceVersion:'3.2.0'");
    expect(page).toContain("calculationUpdatedAt:lastCalculationUpdatedAt.toISOString()");
  });

  test('requires authentication before the decision workspace is usable', () => {
    expect(page).toContain('id="workspaceLoginGate"');
    expect(page).toContain('class="app is-auth-locked" id="workspaceStart"');
    expect(page).toContain('سجّل الدخول لاستخدام محرك نقطة التعادل');
    expect(page).toContain("app.classList.toggle('is-auth-locked',!user)");
    expect(page).toContain("location.href='/calculators/auth/?redirect='");
  });

  test('renders official report letterhead structure', () => {
    expect(page).toContain('class="letterhead-head"');
    expect(page).toContain('https://bonds-global.com/assets/bonds-logo-2026-v2.webp');
    expect(page).toContain('السعودية - جدة');
    expect(page).toContain('مصر - الجيزة');
    expect(page).toContain('الرقم الضريبي 310224728600003');
    expect(page).toContain('رخصة النشاط 357359');
    expect(page).toContain('class="letterhead-foot"');
  });
});
