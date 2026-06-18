/**
 * Tests for BondsGeo and BondsPlatforms shared libraries.
 */
const fs = require('fs');
const path = require('path');

function loadScript(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
}

function setupGlobals() {
  global.window = {};
  global.document = {
    getElementById: jest.fn(() => null),
    createElement: jest.fn(() => ({})),
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(() => null)
  };
  global.ARAB_COUNTRIES_GEO = undefined;
}

describe('BondsGeo', () => {
  beforeAll(() => {
    setupGlobals();
    loadScript('v3/master-data/countries-governorates-cities.js');
    global.ARAB_COUNTRIES_GEO = global.window.ARAB_COUNTRIES_GEO || ARAB_COUNTRIES_GEO;
    loadScript('calculators/shared-geo.js');
  });

  test('has 22 countries', () => {
    const countries = global.window.BondsGeo.getCountries({ lang: 'ar' });
    expect(countries.length).toBe(22);
  });

  test('each country has governorates and cities', () => {
    const countries = global.window.BondsGeo.getCountries({ lang: 'ar' });
    countries.forEach(c => {
      const govs = global.window.BondsGeo.getGovernorates(c.value, { lang: 'ar' });
      expect(govs.length).toBeGreaterThan(0);
      const cities = global.window.BondsGeo.getCities(c.value, 0, { lang: 'ar' });
      expect(cities.length).toBeGreaterThan(0);
    });
  });

  test('findCityByCode returns city data', () => {
    const riyadh = global.window.BondsGeo.findCityByCode('SA-01-001');
    expect(riyadh).not.toBeNull();
    expect(riyadh.city.name).toMatch(/الرياض|Riyadh/);
  });

  test('getCountryName supports Arabic and English', () => {
    expect(global.window.BondsGeo.getCountryName('SA', 'ar')).toBe('السعودية');
    expect(global.window.BondsGeo.getCountryName('SA', 'en')).toBe('Saudi Arabia');
  });
});

describe('BondsPlatforms', () => {
  beforeAll(() => {
    setupGlobals();
    loadScript('v3/master-data/countries-governorates-cities.js');
    global.ARAB_COUNTRIES_GEO = global.window.ARAB_COUNTRIES_GEO || ARAB_COUNTRIES_GEO;
    loadScript('calculators/shared-platforms.js');
  });

  test('has metadata for 22 countries', () => {
    const meta = global.window.BondsPlatforms.getAllCountryMeta();
    expect(Object.keys(meta).length).toBe(22);
  });

  test('each country has platforms', () => {
    Object.keys(global.window.BondsPlatforms.getAllCountryMeta()).forEach(code => {
      const platforms = global.window.BondsPlatforms.getPlatforms(code);
      expect(platforms.length).toBeGreaterThan(0);
    });
  });

  test('SA has expected platforms', () => {
    const platforms = global.window.BondsPlatforms.getPlatforms('SA');
    const ids = platforms.map(p => p.id);
    expect(ids).toContain('plat_hunger');
    expect(ids).toContain('plat_jahez');
  });

  test('currency and VAT are available', () => {
    const meta = global.window.BondsPlatforms.getCountryMeta('SA');
    expect(meta.currency).toBe('SAR');
    expect(meta.vatRate).toBe(15);
  });
});

describe('No regression to old country-platforms-data.js in calculators', () => {
  test('no calculator HTML references country-platforms-data.js', () => {
    const calculatorsDir = path.join(__dirname, '..', 'calculators');
    const enCalculatorsDir = path.join(__dirname, '..', 'en', 'calculators');
    const dirs = [calculatorsDir, enCalculatorsDir].filter(d => fs.existsSync(d));
    const badFiles = [];

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          const content = fs.readFileSync(p, 'utf8');
          if (/country-platforms-data\.js|country-platforms-data\.min\.js/.test(content)) {
            badFiles.push(path.relative(path.join(__dirname, '..'), p));
          }
        }
      }
    }

    dirs.forEach(walk);
    expect(badFiles).toEqual([]);
  });
});
