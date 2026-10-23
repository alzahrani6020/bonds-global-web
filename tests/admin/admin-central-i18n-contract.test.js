/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const read = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

function loadI18n(initialLocale = 'ar') {
  const storage = new Map([['bonds-admin-locale', initialLocale]]);
  const documentElement = { lang: initialLocale, dir: initialLocale === 'ar' ? 'rtl' : 'ltr' };
  const document = {
    readyState: 'complete',
    documentElement,
    querySelectorAll: () => [],
    createTreeWalker: () => ({ currentNode: null, nextNode: () => null })
  };
  const window = {
    parent: null,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    addEventListener: () => {},
    dispatchEvent: () => {}
  };
  window.parent = window;
  const context = {
    window,
    document,
    location: { origin: 'https://bonds-global.com' },
    NodeFilter: { SHOW_TEXT: 4, SHOW_ELEMENT: 1 },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
    Intl,
    Number,
    String,
    Object,
    Array,
    Map,
    Set,
    RegExp
  };
  vm.runInNewContext(read('admin/admin-i18n.js'), context, { filename: 'admin-i18n.js' });
  return { i18n: window.BondsAdminI18n, documentElement };
}

describe('central Admin i18n contract', () => {
  const i18nSource = read('admin/admin-i18n.js');
  const commonSource = read('admin/admin-common.js');
  const localeSource = read('admin/admin-locale.js');
  const embedSource = read('admin/admin-embed.js');
  const dashboardSource = read('admin/dashboard.html');

  test('admin-i18n is the only translation dictionary source', () => {
    expect(i18nSource).toContain('const dictionary = Object.freeze');
    expect(commonSource).not.toContain('ADMIN_LABELS_AR');
    expect(localeSource).not.toMatch(/\bconst\s+(EXACT|PHRASES)\b/);
    expect(dashboardSource).not.toContain('const shellLabels');
  });

  test('Arabic runtime translates known simple and nested metric keys with no English fallback', () => {
    const { i18n, documentElement } = loadI18n('ar');
    i18n.setLocale('ar');
    expect(i18n.label('summary.grossPaid')).toBe('إجمالي المدفوع');
    expect(i18n.label('summary.gross_paid')).toBe('إجمالي المدفوع');
    expect(i18n.label('summary.events-24h')).toBe('الأحداث خلال 24 ساعة');
    expect(i18n.label('flags')).toBe('العلامات');
    expect(i18n.label('entitlements')).toBe('الاستحقاقات');
    expect(i18n.label('pipeline.proposal.count')).toBe('عدد العروض في خط المبيعات');
    expect(i18n.label('unknownBackendMetric')).toBe('مسمى غير معرّف');
    expect(documentElement.lang).toBe('ar');
    expect(documentElement.dir).toBe('rtl');
  });

  test('English runtime stays English and never falls back to Arabic', () => {
    const { i18n, documentElement } = loadI18n('en');
    i18n.setLocale('en');
    expect(i18n.label('summary.grossPaid')).toBe('Gross Paid');
    expect(i18n.label('summary.events24h')).toBe('Events 24h');
    expect(i18n.label('flags')).toBe('Flags');
    expect(i18n.label('entitlements')).toBe('Entitlements');
    expect(i18n.label('pipeline.proposal.count')).toBe('Pipeline Proposal Count');
    expect(i18n.label('مفتاح_غير_معروف')).toBe('Unknown label');
    expect(documentElement.lang).toBe('en');
    expect(documentElement.dir).toBe('ltr');
  });

  test('legacy humanizeAdminKey delegates to BondsAdminI18n.label', () => {
    expect(commonSource).toContain('global.BondsAdminI18n?.label');
    expect(commonSource).not.toContain('ADMIN_LABELS_AR');
  });

  test('locale compatibility shim has no translation tables or translating MutationObserver', () => {
    expect(localeSource).toContain('global.BondsAdminI18n');
    expect(localeSource).not.toContain('MutationObserver');
    expect(localeSource).not.toMatch(/\bEXACT\b|\bPHRASES\b/);
  });

  test('embed locale is applied only through central i18n', () => {
    expect(embedSource).toContain('i18n.setLocale(value)');
    expect(embedSource).not.toContain('document.documentElement.lang =');
    expect(embedSource).not.toContain('document.documentElement.dir =');
  });

  test('dashboard has one central locale path and forwards it to embedded pages', () => {
    expect(dashboardSource).toContain('/admin/admin-i18n.js?v=2');
    expect(dashboardSource).not.toContain('/admin/admin-locale.js');
    expect(dashboardSource).not.toContain('shellLabels');
    expect(dashboardSource).not.toContain('BondsAdminLocale.applyToDocument');
    expect(dashboardSource).toContain("postMessage({ type: 'admin-locale'");
    expect(dashboardSource).toContain('adminI18n?.bind(iframe.contentDocument)');
  });

  test('known mixed-language regression labels exist in both locale dictionaries', () => {
    for (const key of ['summary','grossPaid','events24h','flags','entitlements','pipeline','proposal']) {
      expect(i18nSource).toContain(key + ':');
    }
  });
});
