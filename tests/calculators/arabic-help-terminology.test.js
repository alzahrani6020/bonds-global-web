/** @jest-environment node */
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, '../../calculators/break-even.html'), 'utf8');

describe('Arabic calculator help terminology', () => {
  test('explains English financial terms in Arabic help copy', () => {
    expect(page).toContain("['VAT', 'ضريبة القيمة المضافة']");
    expect(page).toContain("['Final', 'نهائي']");
    expect(page).toContain("['Draft', 'مسودة']");
    expect(page).toContain("['ROI', 'العائد على الاستثمار']");
    expect(page).toContain("['IRR', 'معدل العائد الداخلي']");
    expect(page).toContain("['NPV', 'صافي القيمة الحالية']");
  });

  test('replaces shallow FAQ answers with decision-useful explanations', () => {
    expect(page).toContain('كمية التعادل هي عدد الوحدات التي يجب بيعها حتى يغطي هامش المساهمة التكاليف الثابتة');
    expect(page).toContain('VAT (ضريبة القيمة المضافة) مبلغ ضريبي يُحصّل من العميل');
    expect(page).toContain('الربح يوضح ما إذا كان النشاط حقق فائضاً محاسبياً');
    expect(page).toContain('Final (نهائياً)');
    expect(page).toContain('Draft (مسودة)');
  });

  test('handles help content added after initial page load', () => {
    expect(page).toContain('new MutationObserver');
    expect(page).toContain("observer.observe(document.body, { childList: true, subtree: true })");
  });
});
