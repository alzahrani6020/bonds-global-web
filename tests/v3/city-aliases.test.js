'use strict';

const { toBenchmarkCityCode, resolveBenchmarkCity } = require('../../v3/engine/data-acquisition/city-aliases');

describe('canonical city benchmark aliases', () => {
  test.each([
    ['SA-01-001', 'RUH'],
    ['SA-02-002', 'JED'],
    ['AE-01-001', 'DXB'],
    ['QA-01-001', 'DOH']
  ])('%s resolves to %s', (modern, legacy) => {
    expect(toBenchmarkCityCode(modern)).toBe(legacy);
  });

  test('unknown modern city is explicit instead of silently pretending city-specific coverage', () => {
    expect(resolveBenchmarkCity('QA-07-002')).toEqual({
      canonicalCode: 'QA-07-002',
      benchmarkCode: null,
      matched: false,
      resolution: 'no_city_specific_benchmark'
    });
  });
});
