'use strict';

/**
 * Bonds Local Geo Intelligence Engine
 * Deterministic only: no AI provider, external runtime API, API key, or provider token.
 */

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function inverseDistanceScore(km, excellentKm, poorKm) {
  const n = Number(km);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= excellentKm) return 100;
  if (n >= poorKm) return 0;
  return 100 * (poorKm - n) / (poorKm - excellentKm);
}

function weightedAverage(pairs) {
  let total = 0;
  let weight = 0;
  for (const pair of pairs) {
    const value = clamp(pair.value);
    const w = Number(pair.weight);
    if (value === null || !Number.isFinite(w) || w <= 0) continue;
    total += value * w;
    weight += w;
  }
  return weight ? Math.round((total / weight) * 100) / 100 : null;
}

function deriveLogisticsScore(f = {}) {
  return weightedAverage([
    { value: inverseDistanceScore(f.distance_to_highway_km, 1, 50), weight: 0.35 },
    { value: inverseDistanceScore(f.distance_to_port_km, 5, 250), weight: 0.25 },
    { value: inverseDistanceScore(f.distance_to_airport_km, 5, 150), weight: 0.20 },
    { value: clamp(Number(f.road_density_km_per_sqkm) * 20), weight: 0.20 }
  ]);
}

function deriveEnvironmentScore(f = {}) {
  const heat = clamp(f.heat_stress_score);
  const flood = clamp(f.flood_risk_score);
  const drought = clamp(f.drought_risk_score);
  const positive = [
    { value: heat === null ? null : 100 - heat, weight: 0.34 },
    { value: flood === null ? null : 100 - flood, weight: 0.33 },
    { value: drought === null ? null : 100 - drought, weight: 0.33 }
  ];
  return weightedAverage(positive);
}

function deriveMarketScore(f = {}) {
  const population = Number(f.population);
  const populationScore = Number.isFinite(population) && population > 0
    ? clamp((Math.log10(population) - 3) * 25)
    : null;
  return weightedAverage([
    { value: populationScore, weight: 0.35 },
    { value: clamp(f.purchasing_power_index), weight: 0.30 },
    { value: clamp(Number(f.poi_density_5km) * 5), weight: 0.20 },
    { value: clamp(f.urban_growth_score), weight: 0.15 }
  ]);
}

function deriveDataConfidence(f = {}, place = {}) {
  const sourceSignals = [
    place.name_ar || place.name_en,
    Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lng)),
    place.source_code,
    f.dataset_version,
    f.provenance && Object.keys(f.provenance).length > 0
  ].filter(Boolean).length;
  const base = sourceSignals * 14;
  const explicit = clamp(f.data_confidence_score);
  return Math.round((explicit === null ? base : Math.max(base, explicit)) * 100) / 100;
}

function calculateSiteIntelligence(place = {}, features = {}) {
  const logisticsScore = clamp(features.logistics_score) ?? deriveLogisticsScore(features);
  const environmentScore = clamp(features.environment_score) ?? deriveEnvironmentScore(features);
  const marketScore = clamp(features.market_score) ?? deriveMarketScore(features);
  const confidenceScore = deriveDataConfidence(features, place);

  const siteScore = weightedAverage([
    { value: logisticsScore, weight: 0.35 },
    { value: marketScore, weight: 0.35 },
    { value: environmentScore, weight: 0.30 }
  ]);

  return {
    canonical_code: place.canonical_code || null,
    country_code: place.country_code || null,
    place_type: place.place_type || null,
    location: {
      lat: Number.isFinite(Number(place.lat)) ? Number(place.lat) : null,
      lng: Number.isFinite(Number(place.lng)) ? Number(place.lng) : null
    },
    scores: {
      site: siteScore,
      logistics: logisticsScore,
      market: marketScore,
      environment: environmentScore,
      data_confidence: confidenceScore
    },
    facts: {
      population: features.population ?? place.population ?? null,
      elevation_m: features.elevation_m ?? place.elevation_m ?? null,
      slope_deg: features.slope_deg ?? null,
      annual_rainfall_mm: features.annual_rainfall_mm ?? null,
      avg_temperature_c: features.avg_temperature_c ?? null,
      distance_to_highway_km: features.distance_to_highway_km ?? null,
      distance_to_airport_km: features.distance_to_airport_km ?? null,
      distance_to_port_km: features.distance_to_port_km ?? null
    },
    provenance: features.provenance || {},
    dataset_version: features.dataset_version || null,
    calculated_at: new Date().toISOString(),
    engine: 'bonds-local-geo-v1'
  };
}

module.exports = {
  calculateSiteIntelligence,
  deriveLogisticsScore,
  deriveEnvironmentScore,
  deriveMarketScore,
  deriveDataConfidence,
  inverseDistanceScore,
  weightedAverage
};
