'use strict';

const BenchmarkAdapter = require('../../v3/engine/data-acquisition/adapters/BenchmarkAdapter');

describe('BenchmarkAdapter geography resolution', () => {
  test('preserves modern city code and records the benchmark alias used', async () => {
    const adapter = new BenchmarkAdapter();
    const rows = await adapter.fetch({
      cityCode: 'SA-01-001',
      activityCode: 'restaurant',
      population: 1000000,
      year: 2026
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].cityCode).toBe('SA-01-001');
    expect(rows[0].benchmarkCityCode).toBe('RUH');
    expect(rows[0].benchmarkResolution).toBe('canonical_alias');
  });

  test('unknown city remains a benchmark fallback with explicit generic resolution', async () => {
    const adapter = new BenchmarkAdapter();
    const rows = await adapter.fetch({
      cityCode: 'QA-07-002',
      activityCode: 'restaurant',
      population: 10000,
      year: 2026
    });
    expect(rows[0].benchmarkCityCode).toBeNull();
    expect(rows[0].benchmarkResolution).toBe('no_city_specific_benchmark');
    const transformed = await adapter.transform(rows[0]);
    expect(transformed[0].confidence).toBe(55);
    expect(transformed[0].metadata.isEstimated).toBe(true);
  });
});
