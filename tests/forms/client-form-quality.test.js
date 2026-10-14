/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Bonds client form quality hardening', () => {
  test('branded export utility renders Bonds-branded documents', () => {
    const exporter = require('../../lib/forms/branded-export.js');
    const html = exporter.buildHtml({
      lang: 'ar',
      title: 'اختبار',
      metadata: [{ label: 'العملة', value: 'SAR' }],
      tables: [{ title: 'بيانات', headers: ['أ'], rows: [['1']] }]
    }, '/assets/bonds-logo-2026-v2-sm.webp?v=2026f');
    expect(html).toContain('Bonds Global');
    expect(html).toContain('bonds-logo-2026-v2-sm.webp');
    expect(html).toContain('<table>');
  });

  test('KYC validates conditional risk disclosures and supports all exports', () => {
    const page = read('client/kyc.html');
    expect(page).toContain("pepStatus').value==='yes'");
    expect(page).toContain('type="number" min="0" max="100"');
    expect(page).toContain('data-export="print"');
    expect(page).toContain('data-export="pdf"');
    expect(page).toContain('data-export="excel"');
    expect(page).toContain('data-export="word"');
    expect(page).toContain('BondsBrandedExport.exportDocument');
  });

  test('aging restores drafts, validates rows, and separates old aging buckets', () => {
    const page = read('client/receivables-aging.html');
    expect(page).toContain("in('status',['draft'])");
    expect(page).toContain('المبلغ المسدد لا يمكن أن يتجاوز قيمة الفاتورة');
    expect(page).toContain('id="sum120"');
    expect(page).toContain('id="sumOver120"');
    expect(page).toContain('BondsBrandedExport.exportDocument');
  });

  test('server recalculates aging instead of trusting browser summary', () => {
    const migration = read('supabase/migrations/20261014001500_receivables_aging_hardening.sql');
    expect(migration).toContain('normalize_receivables_aging_report');
    expect(migration).toContain('paid amount cannot exceed invoice amount');
    expect(migration).toContain("NEW.summary := jsonb_build_object");
  });
});
