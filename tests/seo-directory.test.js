const fs = require('fs');
const path = require('path');
const data = require('../scripts/seo-directory-data');

require('../scripts/funding-sources-fallback.js');

const ROOT = path.join(__dirname, '..');
const sources = global.BONDS_FUNDING_FALLBACK_SOURCES;

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

describe('SEO directory fingerprint pages', () => {
  test('helper paths are stable and unique', () => {
    const a = data.sourcePath({ id: 'fs-sa-snb', type: 'bank' }, 'ar');
    const b = data.sourcePath({ id: 'fs-sa-snb', type: 'bank' }, 'en');
    expect(a).toBe('/directory/banks/sa-snb');
    expect(b).toBe('/en/directory/banks/sa-snb');
    expect(data.sectorPath('healthcare', 'ar')).toBe('/directory/sectors/healthcare');
    expect(data.servicePath('financial-analysis', 'en')).toBe('/en/directory/services/financial-analysis');
    expect(data.fingerprint('bank', 'fs-sa-snb', 'https://www.alahli.com')).toMatch(/^BFP-BAN-[0-9A-F]{16}$/);
  });

  test('generated pages exist for SNB, a sector and a service in both languages', () => {
    expect(exists('directory/banks/sa-snb.html')).toBe(true);
    expect(exists('en/directory/banks/sa-snb.html')).toBe(true);
    expect(exists('directory/sectors/healthcare.html')).toBe(true);
    expect(exists('en/directory/sectors/healthcare.html')).toBe(true);
    expect(exists('directory/services/financial-analysis.html')).toBe(true);
    expect(exists('en/directory/services/financial-analysis.html')).toBe(true);
    expect(exists('directory/index.html')).toBe(true);
    expect(exists('en/directory/index.html')).toBe(true);
  });

  test('every catalog bank has AR and EN fingerprint pages', () => {
    const banks = sources.filter((row) => row.type === 'bank');
    expect(banks.length).toBeGreaterThanOrEqual(300);
    banks.forEach((row) => {
      const slug = data.sourceSlug(row.id);
      expect(exists(`directory/banks/${slug}.html`)).toBe(true);
      expect(exists(`en/directory/banks/${slug}.html`)).toBe(true);
    });
  });

  test('SNB page has unique title, canonical, schema and stamp', () => {
    const html = fs.readFileSync(path.join(ROOT, 'directory/banks/sa-snb.html'), 'utf8');
    expect(html).toContain('<title>البنك الأهلي السعودي');
    expect(html).toContain('rel="canonical" href="https://bonds-global.com/directory/banks/sa-snb"');
    expect(html).toContain('BankOrCreditUnion');
    expect(html).toContain('BFP-BAN-');
    expect(html).toContain('https://www.alahli.com');
    expect(html).toContain('index,follow');
    expect(html).not.toContain('defense-minister');
  });

  test('fingerprint names Bonds as source, extraction, requirements and feasibility', () => {
    const files = [
      'directory/banks/sa-snb.html',
      'directory/sectors/healthcare.html',
      'directory/services/financial-analysis.html',
      'directory/index.html',
      'en/directory/banks/sa-snb.html'
    ];
    const ar = fs.readFileSync(path.join(ROOT, files[0]), 'utf8');
    expect(ar).toContain('مصدر المعلومة');
    expect(ar).toContain('بوندز (Bonds Global)');
    expect(ar).toContain('استخراج التمويل');
    expect(ar).toContain('يتم عبر بوندز');
    expect(ar).toContain('الاشتراطات والأهلية');
    expect(ar).toContain('تُعدّ وتُراجع عبر بوندز');
    expect(ar).toContain('دراسة الجدوى');
    expect(ar).toContain('تُنجَز عبر بوندز');
    expect(ar).toContain('إعلان بوندز');
    expect(ar).toContain('dir-hero__ad');
    expect(ar).toContain('href="/funding-extraction.html"');
    expect(ar).toContain('href="/funding-readiness.html"');
    expect(ar).toContain('href="/feasibility-study.html"');

    files.slice(1, 4).forEach((rel) => {
      const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(html).toContain('مصدر المعلومة');
      expect(html).toContain('يتم عبر بوندز');
      expect(html).toContain('تُنجَز عبر بوندز');
    });

    const en = fs.readFileSync(path.join(ROOT, files[4]), 'utf8');
    expect(en).toContain('Bonds advertisement');
    expect(en).toContain('Information source');
    expect(en).toContain('Through Bonds');
    expect(en).toContain('Prepared and reviewed by Bonds');
    expect(en).toContain('Prepared by Bonds');
    expect(en).toContain('href="/en/funding-extraction.html"');
  });
});
