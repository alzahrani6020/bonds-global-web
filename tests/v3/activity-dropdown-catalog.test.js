/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { canonicalizeActivities } = require('../../lib/catalog/canonical-registry');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function parseActivitiesCsv() {
  const lines = read('v3/master-data/activities.csv').trim().split(/\r?\n/);
  return lines.slice(1).map(line => {
    const [sub_sector_code, code, name_ar, name_en] = line.split(',');
    return { sub_sector_code, code, name_ar, name_en, is_active: true };
  });
}

describe('canonical activity dropdowns', () => {
  const dropdowns = [
    'v3/opportunity-bank.html',
    'v3/city-intelligence.html',
    'v3/investment-map.html',
    'v3/city-comparison.html',
    'v3/alerts.html'
  ];

  test('all five activity dropdowns use the canonical catalog and searchable full-result UI', () => {
    for (const file of dropdowns) {
      const page = read(file);
      expect(page).toContain("data-ud-search=\"true\"");
      expect(page).toContain('data-ud-max-results="0"');
      expect(page).toContain('data-ud-virtualize="true"');
      expect(page).toContain('data-ud-search-placeholder="ابحث عن نشاط..."');
    }

    expect(read('v3/opportunity-bank.html')).toContain("fetchJson(API_URL + '/catalog/activities')");
    expect(read('v3/opportunity-bank.html')).not.toContain("fetchJson(API_URL + '/sectors')");

    expect(read('v3/alerts.html')).toContain("fetchJson(API_URL + '/catalog/activities')");
    expect(read('v3/alerts.html')).not.toContain("fetchJson(API_URL + '/sectors')");
  });

  test('canonicalization keeps every raw activity code as a canonical code or alias without duplicate labels', () => {
    const raw = parseActivitiesCsv();
    const canonical = canonicalizeActivities(raw);

    const aliases = canonical.flatMap(activity => activity.aliases || []);
    const rawCodes = raw.map(activity => activity.code);
    expect(new Set(aliases)).toEqual(new Set(rawCodes));

    const names = canonical.map(activity => activity.name_ar);
    expect(new Set(names).size).toBe(names.length);

    const commercial = canonical.find(activity => activity.name_ar === 'التجاري');
    expect(commercial).toBeTruthy();
    expect(new Set(commercial.aliases)).toEqual(new Set([
      'real_estate_commercial_activity',
      'research_development_commercial_activity'
    ]));
  });

  test('V3 APIs resolve aliases instead of filtering only one raw activity id/code', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain('async function resolveActivityAliases');
    expect(api).toContain('async function resolveActivityIds');
    expect(api).toContain("q.in('economic_activities.code', filters.activityCodes)");
    expect(api).toContain("query.in('activity_id', activityIds)");
  });

  test('alerts expose raw activity code so canonical aliases can filter loaded alerts', () => {
    const api = read('v3/api/alerts.js');
    const page = read('v3/alerts.html');
    expect(api).toContain('activity:activity_id(code, name_ar)');
    expect(page).toContain('const aliases = new Set');
    expect(page).toContain('aliases.has(a.activity?.code)');
  });
});
