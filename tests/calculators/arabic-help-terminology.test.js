/** @jest-environment node */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'calculators/break-even.html'), 'utf8');
const help = fs.readFileSync(path.join(root, 'calculators/break-even-help.js'), 'utf8');

describe('Arabic break-even help terminology', () => {
  test('loads a syntactically valid help enhancer outside the print function', () => {
    expect(() => new Function(help)).not.toThrow();
    expect(page).toContain('<script defer src="break-even-help.js?v=1"></script>');

    const printStart = page.indexOf('function printExecOnePager()');
    const printEnd = page.indexOf('function updateScenarios', printStart);
    const printBlock = page.slice(printStart, printEnd);
    expect(printBlock).not.toContain('enhanceArabicBreakEvenHelp');
    expect(printBlock).not.toContain('break-even-help.js');
  });

  test('keeps embedded report markup from terminating the main script', () => {
    const exportStart = page.indexOf('function downloadExecutiveHtml()');
    const renderCashStart = page.indexOf('function renderCash', exportStart);
    expect(exportStart).toBeGreaterThan(-1);
    expect(renderCashStart).toBeGreaterThan(exportStart);

    const exportBlock = page.slice(exportStart, renderCashStart);
    expect(exportBlock).not.toContain('src="break-even-help.js?v=1"></script>');
    expect(exportBlock).toContain('src="break-even-help.js?v=1"><\\/script>');
  });

  test('explains key English financial terms in Arabic', () => {
    expect(help).toContain("['VAT', 'ضريبة القيمة المضافة']");
    expect(help).toContain("['Final', 'نهائي']");
    expect(help).toContain("['Draft', 'مسودة']");
    expect(help).toContain("['ROI', 'العائد على الاستثمار']");
    expect(help).toContain("['IRR', 'معدل العائد الداخلي']");
    expect(help).toContain("['NPV', 'صافي القيمة الحالية']");
    expect(help).toContain("['EBITDA', 'الأرباح قبل الفوائد والضرائب والإهلاك والاستهلاك']");
    expect(help).toContain("['CAPEX', 'النفقات الرأسمالية']");
    expect(help).toContain("['OPEX', 'المصروفات التشغيلية']");
  });

  test('provides decision-useful answers for the four help questions', () => {
    expect(help).toContain('كمية التعادل هي عدد الوحدات التي يجب بيعها حتى يغطي هامش المساهمة التكاليف الثابتة');
    expect(help).toContain('VAT (ضريبة القيمة المضافة) مبلغ ضريبي يُحصّل من العميل');
    expect(help).toContain('الربح يوضح ما إذا كان النشاط حقق فائضاً محاسبياً');
    expect(help).toContain('Final (نهائياً)');
    expect(help).toContain('Draft (مسودة)');
  });

  test('handles help content added after initial page load, including a question root node', () => {
    expect(help).toContain('new MutationObserver');
    expect(help).toContain("observer.observe(document.body, { childList: true, subtree: true })");
    expect(help).toContain('if (root.matches && root.matches(selector)) candidates.push(root)');
  });
});
