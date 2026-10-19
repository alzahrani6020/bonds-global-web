const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 city comparison taxonomy pilot', () => {
  test('first load uses sector-only taxonomy and does not preload activities or models', () => {
    const page = read('v3/city-comparison.html');

    expect(page).toContain('id="sectorSelect"');
    expect(page).toContain("/investment-taxonomy?depth=sector");
    expect(page).not.toContain("fetchJson(API_URL + '/catalog/activities')");
    expect(page).not.toContain("/models?limit=500&country=");
  });

  test('activities are loaded lazily by sector and remain country-aware', () => {
    const page = read('v3/city-comparison.html');

    expect(page).toContain('async function loadCountryActivities');
    expect(page).toContain("sector: sectorCode");
    expect(page).toContain("include: 'activities'");
    expect(page).toContain("params.set('country', countryCode)");
    expect(page).toContain("activity.country?.availability_status !== 'unavailable'");
  });

  test('models are loaded only after activity selection and remain localized-only', () => {
    const page = read('v3/city-comparison.html');

    expect(page).toContain('async function loadCountryModels');
    expect(page).toContain("activity: activityCode");
    expect(page).toContain("country: countryCode");
    expect(page).toContain("model.localized === true");
    expect(page).toContain("modelSelect.disabled = true");
  });

  test('comparison calculations remain activity-driven and preserve canonical aliases', () => {
    const page = read('v3/city-comparison.html');

    expect(page).toContain('function selectedActivityCodes()');
    expect(page).toContain("activity.aliases || [activity.code]");
    expect(page).toContain("&activity_codes=");
    expect(page).toContain("&model=");
  });
});
