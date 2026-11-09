/**
 * @jest-environment node
 */
const {
  liveAdapterIdsForCountry,
  metricGeoLevel,
  isCityGrainObservation,
  LIVE_CRON_CITY_CODES
} = require('../../v3/engine/data-acquisition/source-capability-registry');

describe('source capability registry geo grain', () => {
  test('Saudi live adapters are official only', () => {
    expect(liveAdapterIdsForCountry('SA')).toEqual(['gastat', 'sama']);
    expect(liveAdapterIdsForCountry('EG')).toEqual([]);
  });

  test('scheduled live cities are Saudi codes with live adapters', () => {
    expect(LIVE_CRON_CITY_CODES).toEqual(expect.arrayContaining(['SA-01-001', 'SA-02-002']));
    expect(LIVE_CRON_CITY_CODES.every(code => code.startsWith('SA-'))).toBe(true);
  });

  test('published grain is region or national, never invented city', () => {
    expect(metricGeoLevel('gastat', 'population')).toBe('region');
    expect(metricGeoLevel('gastat', 'unemployment_rate')).toBe('national');
    expect(metricGeoLevel('sama', 'inflation_rate')).toBe('national');
    expect(metricGeoLevel('world_bank_country', 'gdp_per_capita_usd')).toBe('national');
  });

  test('only explicit city grain or overrides enter city Gold', () => {
    expect(isCityGrainObservation({
      metadata: { scope: 'national' },
      source_id: 'sama'
    })).toBe(false);
    expect(isCityGrainObservation({
      metadata: { scope: 'region' },
      source_id: 'gastat',
      metric_code: 'population'
    })).toBe(false);
    expect(isCityGrainObservation({
      metadata: { scope: 'city' },
      source_id: 'municipal'
    })).toBe(true);
    expect(isCityGrainObservation({
      is_override: true,
      metadata: { scope: 'national' }
    })).toBe(true);
  });
});
