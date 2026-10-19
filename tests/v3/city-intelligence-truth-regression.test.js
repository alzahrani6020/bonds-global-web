/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { ARAB_COUNTRIES_GEO } = require('../../v3/master-data/countries-governorates-cities');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('V3 city intelligence catalog and truth regressions', () => {
  test('Arab master catalog covers all Arab League states and a broad city set', () => {
    const countries = Object.values(ARAB_COUNTRIES_GEO);
    const cityCount = countries.reduce((sum, country) =>
      sum + (country.governorates || []).reduce((n, governorate) => n + (governorate.cities || []).length, 0), 0);
    expect(countries).toHaveLength(22);
    expect(cityCount).toBeGreaterThan(250);
  });

  test('city intelligence loads canonical catalogs and explicitly pins readable dark dropdowns', () => {
    const page = read('v3/city-intelligence.html');
    expect(page).toContain("/catalog/countries");
    expect(page).toContain("/investment-taxonomy");
    expect(page).toContain("include: 'activities'");
    expect(page).toContain("/catalog/cities?country=");
    expect(page).toContain('data-ud-theme="dark"');
    expect(page).toContain('لا توجد ثلاثة أبعاد مستقلة على الأقل بأدلة مصدرية مثبتة');
    expect(page).toContain('/evidence?year=');
    expect(page).toContain('id="catalogSummary"');
    expect(page).not.toContain('أكثر من 1200 مدينة');
  });

  test('city evidence endpoint is routed before the generic city detail route', () => {
    const api = read('v3/api/index.js');
    const evidenceRoute = "if (path.match(/^\\/cities\\/[^\\/]+\\/evidence$/)";
    const detailRoute = "if (path.match(/^\\/cities\\/[^\\/]+$/)";
    expect(api).toContain(evidenceRoute);
    expect(api.indexOf(evidenceRoute)).toBeLessThan(api.indexOf(detailRoute));
  });

  test('investment map loads the complete country/city catalog instead of deriving countries from DB rows', () => {
    const page = read('v3/investment-map.html');
    expect(page).toContain("/catalog/countries");
    expect(page).toContain("/catalog/activities");
    expect(page).toContain("/catalog/cities?country=");
    expect(page).toContain('data-ud-theme="dark"');
    expect(page).toContain('المدن دون بيانات لا تُمنح درجات افتراضية');
  });

  test('non-live national adapters do not synthesize fallback metrics by default', () => {
    for (const file of [
      'v3/engine/data-acquisition/adapters/EgyptCapmasAdapter.js',
      'v3/engine/data-acquisition/adapters/UaeStatsAdapter.js',
      'v3/engine/data-acquisition/adapters/JordanStatsAdapter.js',
      'v3/engine/data-acquisition/adapters/QatarPlanningAdapter.js'
    ]) {
      const source = read(file);
      expect(source).toContain('this.useFallback = config.useFallback === true;');
      expect(source).toContain("rawItem.quality === 'fallback' ? null");
    }
  });

  test('Saudi open-data adapter understands canonical SA region codes', () => {
    const source = read('v3/engine/data-acquisition/adapters/GastatAdapter.js');
    expect(source).toContain("normalizedCode.match(/^SA-(\\d{2})-\\d{3}$/)");
    expect(source).toContain("'02': 'Makkah Al Mukarramah'");
    expect(source).toContain("'10': 'Al Jawf'");
    expect(source).toContain("'11': 'Jazan'");
    expect(source).toContain("'12': 'Najran'");
    expect(source).toContain("'13': 'Al Bahah'");
    expect(source).toContain('this.useFallback = config.useFallback === true;');
    expect(source).toContain("metricScope.population = 'region'");
    expect(source).toContain("metricScope[k] = 'national'");
  });
});
