const {
  calculateSiteIntelligence,
  deriveLogisticsScore,
  deriveEnvironmentScore,
  deriveMarketScore
} = require('../../lib/geo/local-intelligence');

describe('Local geo intelligence engine', () => {
  test('is deterministic and does not require an external provider', () => {
    const place = {
      canonical_code: 'SA-TEST',
      country_code: 'SA',
      place_type: 'city',
      lat: 24.7,
      lng: 46.7,
      source_code: 'geonames_dump'
    };
    const features = {
      population: 1000000,
      purchasing_power_index: 75,
      distance_to_highway_km: 2,
      distance_to_airport_km: 20,
      distance_to_port_km: 300,
      road_density_km_per_sqkm: 2,
      heat_stress_score: 60,
      flood_risk_score: 20,
      drought_risk_score: 50,
      poi_density_5km: 12,
      urban_growth_score: 70,
      data_confidence_score: 90,
      dataset_version: 'test-1',
      provenance: { population: 'fixture' }
    };
    const result = calculateSiteIntelligence(place, features);
    expect(result.engine).toBe('bonds-local-geo-v1');
    expect(result.scores.site).toBeGreaterThanOrEqual(0);
    expect(result.scores.site).toBeLessThanOrEqual(100);
    expect(result.scores.data_confidence).toBe(90);
    expect(result.dataset_version).toBe('test-1');
  });

  test('derives bounded component scores from local facts', () => {
    expect(deriveLogisticsScore({
      distance_to_highway_km: 1,
      distance_to_airport_km: 5,
      distance_to_port_km: 5,
      road_density_km_per_sqkm: 5
    })).toBe(100);

    expect(deriveEnvironmentScore({
      heat_stress_score: 0,
      flood_risk_score: 0,
      drought_risk_score: 0
    })).toBe(100);

    expect(deriveMarketScore({
      population: 1000000,
      purchasing_power_index: 100,
      poi_density_5km: 20,
      urban_growth_score: 100
    })).toBe(100);
  });
});
