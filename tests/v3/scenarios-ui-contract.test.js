/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

const scenarioPage = fs.readFileSync(
  path.join(__dirname, '../../v3/scenarios.html'),
  'utf8'
);

describe('V3 scenarios UI contract', () => {
  test('loads country-scoped models and cities instead of unfiltered catalogs', () => {
    expect(scenarioPage).toContain("/models?country=");
    expect(scenarioPage).toContain("/cities?country=");
    expect(scenarioPage).not.toContain("fetchJson(API_URL + '/models')");
    expect(scenarioPage).not.toContain("fetchJson(API_URL + '/cities')");
  });

  test('uses hierarchical context selectors', () => {
    expect(scenarioPage).toContain('id="countrySelect"');
    expect(scenarioPage).toContain('id="sectorSelect"');
    expect(scenarioPage).toContain('id="activitySelect"');
    expect(scenarioPage).toContain('id="modelSelect"');
    expect(scenarioPage).toContain('id="citySelect"');
  });

  test('uses canonical investment taxonomy for sectors and activities', () => {
    expect(scenarioPage).toContain("/investment-taxonomy?country=");
    expect(scenarioPage).toContain("&depth=sector&include=activities,model_availability");
    expect(scenarioPage).toContain("sector.model_available !== false");
    expect(scenarioPage).toContain("&investment_sector=");
    expect(scenarioPage).toContain("m.canonical_activity?.code");
    expect(scenarioPage).not.toContain("m => m.sector?.code");
    expect(scenarioPage).not.toContain("m => m.activity?.code");
  });

  test('deduplicates financially equivalent legacy models before display', () => {
    expect(scenarioPage).toContain('function financialProfileKey(model)');
    expect(scenarioPage).toContain('const profileGroups = new Map()');
    expect(scenarioPage).toContain('legacy_sector_mapping_confidence');
  });

  test('renders authoritative preset shock details before calculation', () => {
    expect(scenarioPage).toContain("API_URL + '/calculate/scenarios/presets'");
    expect(scenarioPage).toContain('presetCatalog.get(scenario.preset)');
    expect(scenarioPage).not.toContain('سيتم تطبيق الصدمات الجاهزة عند تشغيل التحليل.');
  });

  test('passes country context and uses dynamic calculation currency', () => {
    expect(scenarioPage).toContain('payload.countryCode = countryCode');
    expect(scenarioPage).toContain('context.currencyCode');
    expect(scenarioPage).toContain("currency || 'عملة النموذج'");
  });

  test('shows city effect, freshness, provenance, risk, confidence and full scenario deltas', () => {
    expect(scenarioPage).toContain('id="cityImpactSummary"');
    expect(scenarioPage).toContain('context.cityAdjustmentsApplied');
    expect(scenarioPage).toContain('context.cityConfidence');
    expect(scenarioPage).toContain('context.cityIndicatorYear');
    expect(scenarioPage).toContain('context.cityMarketDataYear');
    expect(scenarioPage).toContain('context.cityMarketDataConfidence');
    expect(scenarioPage).toContain('context.cityMarketDataSource');
    expect(scenarioPage).toContain('سنة مؤشرات المدينة');
    expect(scenarioPage).toContain('سنة بيانات السوق المحلية');
    expect(scenarioPage).toContain('مصدر بيانات السوق المحلية');
    expect(scenarioPage).toContain("['التغير في IRR', 'deltaIrr'");
    expect(scenarioPage).toContain("['التغير في المخاطر', 'deltaRiskScore'");
    expect(scenarioPage).toContain("get: r => r.risk?.score");
  });

  test('treats relative custom shock input as a human percentage', () => {
    expect(scenarioPage).toContain("const value = type === 'relative' ? rawValue / 100 : rawValue");
    expect(scenarioPage).toContain('placeholder="10"');
  });

  test('shows applied and ignored shock diagnostics', () => {
    expect(scenarioPage).toContain('s.appliedShocks || []');
    expect(scenarioPage).toContain('s.ignoredShocks || []');
    expect(scenarioPage).toContain('لم يطبق');
  });

  test('keeps city optional and does not auto-select the first city', () => {
    expect(scenarioPage).toContain('data-ud-placeholder="اختر مدينة (اختياري)"');
    expect(scenarioPage).toContain("citySelect.value = ''");
    expect(scenarioPage).toContain("const cityDropdown = window.getUniversalDropdown?.(citySelect)");
    expect(scenarioPage).toContain("if (cityDropdown) cityDropdown.value = ''");
  });

  test('rejects invalid projection years instead of silently coercing zero to five', () => {
    expect(scenarioPage).toContain("const yearsRaw = String(document.getElementById('yearsInput').value).trim()");
    expect(scenarioPage).toContain("const years = yearsRaw === '' ? 5 : Number(yearsRaw)");
    expect(scenarioPage).toContain('مدة التحليل المالي يجب أن تكون بين سنة واحدة و10 سنوات');
    expect(scenarioPage).not.toContain("Number(document.getElementById('yearsInput').value) || 5");
  });

  test('keeps the scenarios runtime syntactically valid in browsers', () => {
    const match = scenarioPage.match(/<script>\s*(const API_URL[\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    expect(() => new Function(match[1])).not.toThrow();
    expect(scenarioPage).not.toContain("?.value =");
  });

  test('loads the current universal dropdown runtime with explicit cache-busting versions', () => {
    expect(scenarioPage).toContain('../components/universal-dropdown.js?v=2.52.2');
    expect(scenarioPage).toContain('../components/universal-dropdown-init.js?v=4');
  });

  test('syncs dynamic options directly into the universal dropdown component', () => {
    expect(scenarioPage).toContain("if (dropdown && typeof dropdown.setOptions === 'function')");
    expect(scenarioPage).toContain('dropdown.setOptions(normalized)');
    expect(scenarioPage).toContain("dropdown.value = ''");
    expect(scenarioPage).toContain('const countryDropdown = window.getUniversalDropdown?.(countrySelect)');
    expect(scenarioPage).toContain('countryDropdown.items.length !== countryOptions.length');
    expect(scenarioPage).toContain('countryDropdown.setOptions(countryOptions)');
    expect(scenarioPage).toContain('countryDropdown.value = countrySelect.value');
  });

  test('shows an explicit baseline, currency, base year and forecast period', () => {
    expect(scenarioPage).toContain('id="currencyDisplay"');
    expect(scenarioPage).toContain('id="baseYearInput"');
    expect(scenarioPage).toContain('id="forecastPeriod"');
    expect(scenarioPage).toContain('id="baselinePreview"');
    expect(scenarioPage).toContain('السيناريو الأساسي (Baseline)');
    expect(scenarioPage).toContain('فترة التوقع: ');
  });

  test('renders yearly financial projections from the calculated projection series', () => {
    expect(scenarioPage).toContain('id="yearlyProjectionTable"');
    expect(scenarioPage).toContain('id="yearlyProjectionSummary"');
    expect(scenarioPage).toContain("Array.isArray(item.result?.projections)");
    expect(scenarioPage).toContain("const calendarYear = projectionBaseYear + Number(period.year || 0)");
    expect(scenarioPage).toContain("period.cashFlowAfterDebt ?? period.cashFlow");
    expect(scenarioPage).toContain('يعرض الجدول القيم المحسوبة سنة بسنة');
  });

  test('uses economic activity terminology and preset severity with visible numeric shocks', () => {
    expect(scenarioPage).toContain('<label for="activitySelect">النشاط الاقتصادي</label>');
    expect(scenarioPage).not.toContain('<label for="activitySelect">التخصص / النشاط</label>');
    expect(scenarioPage).toContain('id="presetSeverity"');
    expect(scenarioPage).toContain('function scaledPresetShocks(preset, severity)');
    expect(scenarioPage).toContain('شدة الصدمة: ');
  });

  test('blocks analysis until required economic context is selected', () => {
    expect(scenarioPage).toContain("if (!countryCode) return alert('اختر الدولة أولاً')");
    expect(scenarioPage).toContain("if (!sectorCode) return alert('اختر القطاع أولاً')");
    expect(scenarioPage).toContain("if (!activityCode) return alert('اختر النشاط الاقتصادي أولاً')");
    expect(scenarioPage).toContain("if (!modelCode) return alert('اختر النموذج الاستثماري أولاً')");
  });

  test('renders a decision interpretation summary after calculation', () => {
    expect(scenarioPage).toContain('id="decisionSummary"');
    expect(scenarioPage).toContain('أكبر ضغط على NPV');
    expect(scenarioPage).toContain('أكبر زيادة في المخاطر');
  });

  test('defines the financial number formatter used by metrics rendering', () => {
    expect(scenarioPage).toContain('function formatNumber(value)');
    expect(scenarioPage).toContain('صافي القيمة الحالية (NPV)');
    expect(scenarioPage).toContain('معدل العائد الداخلي (IRR)');
    expect(scenarioPage).toContain('نسبة تغطية خدمة الدين (DSCR)');
  });

  test('caps client-side scenario count at the API maximum', () => {
    expect(scenarioPage).toContain('if (scenarios.length >= 10)');
    expect(scenarioPage).toContain('الحد الأقصى 10 سيناريوهات لكل تحليل');
  });

  test('prevents duplicate run submissions while analysis is in progress', () => {
    expect(scenarioPage).toContain('runBtn.disabled = true');
    expect(scenarioPage).toContain('runBtn.disabled = false');
    expect(scenarioPage).toContain('جاري تشغيل التحليل...');
  });

  test('escapes user-provided scenario names before rendering', () => {
    expect(scenarioPage).toContain("'<h4>' + escapeHtml(scenario.name) + '</h4>'");
  });

  test('loads UniversalDropdown before scenarios init and recovers country options deterministically', () => {
    const dropdownScript = scenarioPage.indexOf('../components/universal-dropdown.js?v=2.52.2');
    const pageInit = scenarioPage.indexOf('async function init()');
    expect(dropdownScript).toBeGreaterThanOrEqual(0);
    expect(pageInit).toBeGreaterThan(dropdownScript);
    expect(scenarioPage).toContain('if (countryDropdown.items.length !== countryOptions.length)');
    expect(scenarioPage).toContain('countryDropdown.setOptions(countryOptions)');
  });

  test('keeps institutional light theme and dropdowns visually consistent', () => {
    expect(scenarioPage).toContain('<html lang="ar" dir="rtl" data-theme="light">');
    for (const id of ['countrySelect','sectorSelect','activitySelect','modelSelect','citySelect']) {
      const re = new RegExp('<select[^>]*data-ud-theme="light"[^>]*id="' + id + '"');
      expect(scenarioPage).toMatch(re);
    }
    expect(scenarioPage).toContain('data-ud-remove-empty="true" data-ud-placeholder="اختر دولة"');
    expect(scenarioPage).toContain('data-ud-search="false" id="yearsInput"');
    expect(scenarioPage).toContain('data-ud-search="false" id="presetSeverity"');
    expect(scenarioPage).toContain("legend: { labels: { color: '#334155' } }");
    expect(scenarioPage).not.toContain("legend: { labels: { color: '#e8ecf4' } }");
  });

  test('shows country flags and retries transient context loads', () => {
    expect(scenarioPage).toContain('icon: c.flag || null');
    expect(scenarioPage).toContain('if (item.icon) opt.dataset.icon = item.icon');
    expect(scenarioPage).toContain('fetchJsonWithRetry');
    expect(scenarioPage).toContain("API_URL + '/models?country='");
    expect(scenarioPage).toContain("'&investment_sector=' + encodeURIComponent(sectorCode)");
    expect(scenarioPage).toContain("fetchJsonWithRetry(API_URL + '/cities?country='");
  });

  test('quarantines city records proven to have corrupt labels', () => {
    for (const code of ['EG-98-004','SY-98-018','IQ-98-001','YE-98-001']) {
      expect(scenarioPage).toContain(code);
    }
    expect(scenarioPage).toContain('!QUARANTINED_CITY_CODES.has(c.code)');
  });
});
