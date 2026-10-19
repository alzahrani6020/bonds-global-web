const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 investment map taxonomy pilot', () => {
  test('first load fetches countries and sector-only taxonomy, not the full activity catalog', () => {
    const page = read('v3/investment-map.html');

    expect(page).toContain('id="sectorSelect"');
    expect(page).toContain("/investment-taxonomy?depth=sector");
    expect(page).toContain("const [countriesRes, taxonomyRes] = await Promise.all");
    expect(page).not.toContain("fetchJson(API_URL + '/catalog/activities')");
    expect(page).not.toContain("API_URL + '/models'");
  });

  test('activities load only after selecting a sector and remain country-scoped', () => {
    const page = read('v3/investment-map.html');

    expect(page).toContain("const sectorCode = sectorSelect.value");
    expect(page).toContain("include: 'activities'");
    expect(page).toContain("params.set('country', countryCode)");
    expect(page).toContain("activity.country?.availability_status !== 'unavailable'");
    expect(page).toContain("activitySelect.disabled = true");
  });

  test('map opportunity calculations remain activity-driven', () => {
    const page = read('v3/investment-map.html');

    expect(page).toContain("if (activity) params.set('activity', activity)");
    expect(page).toContain("new URLSearchParams({ activity, limit: '10', year: 'latest' })");
    expect(page).not.toContain("params.set('sector', sectorSelect.value)");
  });
});
