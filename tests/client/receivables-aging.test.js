/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('receivables aging form', () => {
  test('contains required aging buckets and automatic calculation hooks', () => {
    const page = read('client/receivables-aging.html');
    expect(page).toContain('نموذج أعمار الذمم');
    expect(page).toContain('غير مستحق');
    expect(page).toContain('1–30');
    expect(page).toContain('31–60');
    expect(page).toContain('61–90');
    expect(page).toContain('91–120');
    expect(page).toContain('أكثر من 120');
    expect(page).toContain("from('client_receivables_aging_reports')");
  });

  test('form is available in Arabic and English', () => {
    expect(read('client/receivables-aging.html')).toContain('lang="ar" dir="rtl"');
    expect(read('en/client/receivables-aging.html')).toContain('lang="en" dir="ltr"');
  });

  test('forms dropdown exposes receivables aging', () => {
    const layout = read('site-layout.js');
    expect(layout).toContain("receivablesAging: isEn ? 'Receivables Aging' : 'أعمار الذمم'");
    expect(layout).toContain("const receivablesAgingHref = isEn ? '/en/client/receivables-aging' : '/client/receivables-aging';");
    expect(layout).toContain('{ label: labels.receivablesAging, href: receivablesAgingHref }');
  });
});
