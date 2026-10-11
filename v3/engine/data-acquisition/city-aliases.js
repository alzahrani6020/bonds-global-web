'use strict';

const CITY_CODE_ALIASES = Object.freeze({
  'SA-01-001': 'RUH',
  'SA-02-002': 'JED',
  'SA-03-001': 'MED',
  'AE-01-001': 'DXB',
  'QA-01-001': 'DOH',
  'KW-01-001': 'KWI',
  'BH-01-001': 'BAH',
  'OM-01-001': 'MCT'
});

function toBenchmarkCityCode(cityCode) {
  if (!cityCode) return null;
  const code = String(cityCode).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) return code;
  return CITY_CODE_ALIASES[code] || null;
}

function resolveBenchmarkCity(cityCode) {
  const canonical = cityCode ? String(cityCode).trim().toUpperCase() : null;
  const benchmarkCode = toBenchmarkCityCode(canonical);
  return {
    canonicalCode: canonical,
    benchmarkCode,
    matched: Boolean(benchmarkCode),
    resolution: benchmarkCode ? 'canonical_alias' : 'no_city_specific_benchmark'
  };
}

module.exports = {
  CITY_CODE_ALIASES,
  toBenchmarkCityCode,
  resolveBenchmarkCity
};
