'use strict';

/**
 * SDMX-style source capabilities: what each official adapter actually publishes.
 * Geographic grain is a property of the dataflow, not of the city page.
 * Missing GEO×TIME cells stay empty. National/region rows never become city Gold.
 */
const SOURCES = Object.freeze({
  gastat: {
    adapterKey: 'gastat',
    sourceId: 'gastat',
    live: true,
    countries: ['SA'],
    defaultGeoLevel: 'national',
    metrics: Object.freeze({
      population: 'region',
      unemployment_rate: 'national',
      household_income: 'national'
    })
  },
  sama: {
    adapterKey: 'sama',
    sourceId: 'sama',
    live: true,
    countries: ['SA'],
    defaultGeoLevel: 'national',
    metrics: Object.freeze({
      inflation_rate: 'national',
      growth_rate: 'national'
    })
  },
  world_bank_country: {
    adapterKey: null,
    sourceId: 'world_bank_country',
    live: true,
    countries: ['*'],
    defaultGeoLevel: 'national',
    metrics: Object.freeze({
      inflation_rate: 'national',
      economic_growth_rate: 'national',
      unemployment_rate: 'national',
      population_total: 'national',
      gdp_per_capita_usd: 'national',
      fdi_net_inflows_pct_gdp: 'national'
    })
  }
});

function getCapability(sourceId) {
  return SOURCES[sourceId] || null;
}

function liveAdapterIdsForCountry(countryCode) {
  const country = String(countryCode || '').toUpperCase();
  return Object.values(SOURCES)
    .filter(source =>
      source.live &&
      source.adapterKey &&
      (source.countries.includes('*') || source.countries.includes(country))
    )
    .map(source => source.adapterKey);
}

function metricGeoLevel(sourceId, metricCode) {
  const cap = SOURCES[sourceId];
  if (!cap) return 'unknown';
  if (metricCode && cap.metrics[metricCode]) return cap.metrics[metricCode];
  return cap.defaultGeoLevel || 'unknown';
}

function observationGeoLevel(row) {
  const scope = String(row?.metadata?.scope || row?.scope || '').toLowerCase();
  if (scope === 'city' || scope === 'region' || scope === 'national') return scope;
  if (row?.source_id || row?.sourceId) {
    return metricGeoLevel(row.source_id || row.sourceId, row.metric_code || row.metricCode);
  }
  return 'unknown';
}

function isCityGrainObservation(row) {
  if (!row) return false;
  if (row.is_override === true || row.isOverride === true) return true;
  return observationGeoLevel(row) === 'city';
}

/** Saudi cities with live GASTAT/SAMA adapters. Bounded for serverless time. */
const LIVE_CRON_CITY_CODES = Object.freeze([
  'SA-01-001', // Riyadh
  'SA-02-001', // Makkah
  'SA-02-002', // Jeddah
  'SA-03-001', // Madinah
  'SA-05-001', // Dammam
  'SA-05-002'  // Khobar
]);

module.exports = {
  SOURCES,
  getCapability,
  liveAdapterIdsForCountry,
  metricGeoLevel,
  observationGeoLevel,
  isCityGrainObservation,
  LIVE_CRON_CITY_CODES
};
