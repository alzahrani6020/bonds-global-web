const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 opportunity bank investment taxonomy pilot', () => {
  test('first load uses lightweight sector taxonomy and does not preload all activities', () => {
    const page = read('v3/opportunity-bank.html');

    expect(page).toContain('id="sectorSelect"');
    expect(page).toContain("/investment-taxonomy?depth=sector");
    expect(page).toContain("const [countriesData, taxonomyData] = await Promise.all");
    expect(page).not.toContain("API_URL + '/catalog/activities?country='");
  });

  test('activities are loaded lazily only after a sector is selected', () => {
    const page = read('v3/opportunity-bank.html');

    expect(page).toContain('async function refreshSectorActivities');
    expect(page).toContain("sector: sectorSelect.value");
    expect(page).toContain("include: 'activities'");
    expect(page).toContain("activitySelect.disabled = true");
    expect(page).toContain("_universalDropdown");
    expect(page).toContain("instance.refresh()");
  });

  test('sector selection is sent to opportunity ranking API', () => {
    const page = read('v3/opportunity-bank.html');

    expect(page).toContain("if (sector) params.set('sector', sector)");
    expect(page).toContain("document.getElementById('sectorSelect').addEventListener('change', refreshSectorActivities)");
  });
});
