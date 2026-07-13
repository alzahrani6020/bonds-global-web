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
}

let CORE_ARAB_COUNTRY_CODES = [];
let EXTENDED_ARAB_COUNTRY_CODES = [];

beforeAll(() => {
  setupGlobals();
  loadScript('v3/master-data/countries-governorates-cities.js');
  global.ARAB_COUNTRIES_GEO = global.window.ARAB_COUNTRIES_GEO || ARAB_COUNTRIES_GEO;
  CORE_ARAB_COUNTRY_CODES = Object.keys(global.ARAB_COUNTRIES_GEO || {});

  loadScript('v3/master-data/arab-extended-countries.js');
  global.ARAB_EXTENDED_COUNTRIES_GEO = global.window.ARAB_EXTENDED_COUNTRIES_GEO || ARAB_EXTENDED_COUNTRIES_GEO;
  EXTENDED_ARAB_COUNTRY_CODES = Object.keys(global.ARAB_EXTENDED_COUNTRIES_GEO || {});
});

describe('BondsGeo', () => {
  beforeAll(() => {
    loadScript('v3/master-data/global-countries.js');
    global.GLOBAL_COUNTRIES_GEO = global.window.GLOBAL_COUNTRIES_GEO || GLOBAL_COUNTRIES_GEO;
    loadScript('calculators/shared-geo.js');
  });

  test('has all 22 core Arab countries', () => {
    const countries = global.window.BondsGeo.getCountries({ lang: 'ar' });
    const codes = countries.map(c => c.value);
    CORE_ARAB_COUNTRY_CODES.forEach(code => {
      expect(codes).toContain(code);
    });
    expect(CORE_ARAB_COUNTRY_CODES.length).toBe(22);
  });

  test('has all extended Arabic-speaking/observer countries', () => {
    const countries = global.window.BondsGeo.getCountries({ lang: 'ar' });
    const codes = countries.map(c => c.value);
    EXTENDED_ARAB_COUNTRY_CODES.forEach(code => {
      expect(codes).toContain(code);
    });
    expect(EXTENDED_ARAB_COUNTRY_CODES.length).toBe(10);
  });

  test('total countries equals 96 (22 core Arab + 10 extended Arab + 64 global)', () => {
    const countries = global.window.BondsGeo.getCountries({ lang: 'ar' });
    expect(countries.length).toBe(96);
  });

  test('each core country has governorates and cities', () => {
    CORE_ARAB_COUNTRY_CODES.forEach(code => {
      const govs = global.window.BondsGeo.getGovernorates(code, { lang: 'ar' });
      expect(govs.length).toBeGreaterThan(0);
      const cities = global.window.BondsGeo.getCities(code, 0, { lang: 'ar' });
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
    loadScript('calculators/shared-platforms.js');
  });

  test('has metadata for all 22 core Arab countries', () => {
    const meta = global.window.BondsPlatforms.getAllCountryMeta();
    CORE_ARAB_COUNTRY_CODES.forEach(code => {
      expect(meta[code]).toBeTruthy();
    });
  });

  test('has metadata for all 10 extended Arab countries', () => {
    const meta = global.window.BondsPlatforms.getAllCountryMeta();
    EXTENDED_ARAB_COUNTRY_CODES.forEach(code => {
      expect(meta[code]).toBeTruthy();
    });
  });

  test('total platform metadata equals 96 countries', () => {
    const meta = global.window.BondsPlatforms.getAllCountryMeta();
    expect(Object.keys(meta).length).toBe(96);
  });

  test('each country has at least a direct fallback platform', () => {
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

  test('currency and VAT are available for core country', () => {
    const meta = global.window.BondsPlatforms.getCountryMeta('SA');
    expect(meta.currency).toBe('SAR');
    expect(meta.vatRate).toBe(15);
  });

  test('every country has currency, symbol, and VAT metadata', () => {
    Object.entries(global.window.BondsPlatforms.getAllCountryMeta()).forEach(([code, meta]) => {
      expect(meta.currency).toBeTruthy();
      expect(meta.currency.length).toBe(3);
      expect(meta.currencySymbol).toBeTruthy();
      expect(typeof meta.vatRate).toBe('number');
      expect(code).toBe(code.toUpperCase());
    });
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
