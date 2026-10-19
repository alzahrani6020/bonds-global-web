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

  test('funding registry exposes receivables aging', () => {
    const migration = read('supabase/migrations/20261019064000_funding_file_case_architecture.sql');
    expect(migration).toContain("'receivables'");
    expect(migration).toContain("'/client/receivables-aging'");
    expect(migration).toContain("'/en/client/receivables-aging'");
  });
});
