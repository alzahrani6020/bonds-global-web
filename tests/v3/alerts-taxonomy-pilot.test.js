const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 alerts taxonomy pilot', () => {
  test('first load fetches sector-only taxonomy instead of the full activity catalog', () => {
    const page = read('v3/alerts.html');

    expect(page).toContain('id="sectorFilter"');
    expect(page).toContain("/investment-taxonomy?depth=sector");
    expect(page).not.toContain("fetchJson(API_URL + '/catalog/activities'");
    expect(page).not.toContain("API_URL + '/models'");
  });

  test('sector activities load lazily and remain country-aware', () => {
    const page = read('v3/alerts.html');

    expect(page).toContain('async function loadSectorActivities');
    expect(page).toContain("include: 'activities'");
    expect(page).toContain("params.set('country', countryCode)");
    expect(page).toContain("activity.country?.availability_status !== 'unavailable'");
    expect(page).toContain('activityFilter.disabled = true');
  });

  test('sector filtering uses canonical aliases locally without changing alerts API semantics', () => {
    const page = read('v3/alerts.html');

    expect(page).toContain('sectorActivityAliases = new Set()');
    expect(page).toContain('aliases.forEach(alias => sectorActivityAliases.add(alias))');
    expect(page).toContain('sectorActivityAliases.has(a.activity?.code)');
    expect(page).toContain("${API_URL}/alerts?${params.toString()}");
    expect(page).not.toContain("params.set('sector'");
  });
});
