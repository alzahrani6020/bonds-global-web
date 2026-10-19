/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('V3 activity dropdown UI on current taxonomy sources', () => {
  const pages = [
    'v3/alerts.html',
    'v3/opportunity-bank.html',
    'v3/city-intelligence.html',
    'v3/investment-map.html',
    'v3/city-comparison.html'
  ];

  test('all activity dropdowns expose full searchable virtualized UI', () => {
    for (const file of pages) {
      const page = read(file);
      expect(page).toContain('data-ud-max-results="0"');
      expect(page).toContain('data-ud-virtualize="true"');
      expect(page).toContain('data-ud-virtual-threshold="40"');
      expect(page).toContain('data-ud-search-placeholder="ابحث عن نشاط..."');
    }
  });

  test('country-aware pages keep investment taxonomy sources', () => {
    for (const file of [
      'v3/alerts.html',
      'v3/opportunity-bank.html',
      'v3/investment-map.html',
      'v3/city-comparison.html'
    ]) {
      const page = read(file);
      expect(page).toContain('/investment-taxonomy');
    }
  });

  test('city intelligence keeps its existing canonical catalog source', () => {
    const page = read('v3/city-intelligence.html');
    expect(page).toContain('/catalog/activities');
  });

  test('city comparison remains sector-first and country-aware', () => {
    const page = read('v3/city-comparison.html');
    expect(page).toContain('id="sectorSelect"');
    expect(page).toContain("params.set('country', countryCode)");
    expect(page).toContain("include: 'activities'");
    expect(page).not.toContain("fetchJson(API_URL + '/catalog/activities')");
  });
});
