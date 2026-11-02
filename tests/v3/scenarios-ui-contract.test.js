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

  test('renders preset scenarios safely before engine normalization', () => {
    expect(scenarioPage).toContain('Array.isArray(scenario.shocks) ? scenario.shocks : []');
    expect(scenarioPage).toContain('سيتم تطبيق الصدمات الجاهزة عند تشغيل التحليل.');
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

  test('quarantines city records proven to have corrupt labels', () => {
    for (const code of ['EG-98-004','SY-98-018','IQ-98-001','YE-98-001']) {
      expect(scenarioPage).toContain(code);
    }
    expect(scenarioPage).toContain('!QUARANTINED_CITY_CODES.has(c.code)');
  });
});
