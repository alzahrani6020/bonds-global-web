const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 investment map rendering regression', () => {
  test('marker renderer and bounded geocode fallback are present', () => {
    const page = read('v3/investment-map.html');

    expect(page).toContain('function hasCoordinates(city)');
    expect(page).toContain('async function geocodeCity(city)');
    expect(page).toContain('async function renderMarkers(cities)');
    expect(page).toContain('cities.length === 1 && !hasCoordinates(cities[0])');
    expect(page).not.toContain('Promise.all(cities.map(async city =>');
  });

  test('renderer only plots finite coordinates and reports empty coordinate coverage', () => {
    const page = read('v3/investment-map.html');

    expect(page).toContain('const valid = enriched.filter(hasCoordinates)');
    expect(page).toContain("لا تتوفر إحداثيات موثقة للمدن المعروضة بعد");
    expect(page).toContain('L.marker([Number(city.lat), Number(city.lng)]');
    expect(page).toContain('map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })');
  });

  test('map callers await the restored renderer', () => {
    const page = read('v3/investment-map.html');

    expect(page).toContain('await renderMarkers(filtered)');
    expect(page).toContain('await renderMarkers(mapped)');
  });
});
