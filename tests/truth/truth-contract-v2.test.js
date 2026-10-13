'use strict';

const {
  TRUTH_CONTRACT_VERSION,
  createEvidenceRecord,
  deriveEvidenceAges,
  parseObservationTimestamp
} = require('../../lib/truth/evidence-record');
const { assessOpportunityRow } = require('../../lib/truth/opportunity-reliability');

describe('Bonds Truth Contract V2', () => {
  test('parses annual, monthly and quarterly observation periods deterministically', () => {
    expect(new Date(parseObservationTimestamp('2020')).toISOString()).toBe('2020-12-31T23:59:59.999Z');
    expect(new Date(parseObservationTimestamp('2020-01')).toISOString()).toBe('2020-01-31T23:59:59.999Z');
    expect(new Date(parseObservationTimestamp('2020 Q4')).toISOString()).toBe('2020-12-31T23:59:59.999Z');
    expect(new Date(parseObservationTimestamp('2022 Census')).toISOString()).toBe('2022-12-31T23:59:59.999Z');
  });

  test('uses observation age as freshness basis while preserving retrieval age separately', () => {
    const now = Date.UTC(2026, 9, 13);
    const ages = deriveEvidenceAges({
      period: '2020 Q4',
      fetched_at: '2026-10-13T00:00:00.000Z'
    }, now);

    expect(ages.observation_age_days).toBeGreaterThan(2000);
    expect(ages.retrieval_age_days).toBe(0);
    expect(ages.freshness_days).toBe(ages.observation_age_days);
    expect(ages.freshness_basis).toBe('observation');
  });

  test('evidence record exposes truth contract and separate observation/retrieval ages', () => {
    const record = createEvidenceRecord({
      value: 12.6,
      source: 'GASTAT via KAPSARC',
      sourceType: 'OFFICIAL_OBSERVED',
      period: '2020 Q4',
      retrievedAt: '2026-10-13T00:00:00.000Z',
      confidence: 95
    });

    expect(record.truth_contract_version).toBe(TRUTH_CONTRACT_VERSION);
    expect(record.observation_at).toContain('2020-12-31');
    expect(record.observation_age_days).toBeGreaterThan(record.retrieval_age_days);
    expect(record.freshness_days).toBe(record.observation_age_days);
    expect(record.freshness_basis).toBe('observation');
  });

  test('estimated legacy year is not promoted to an observation timestamp', () => {
    const result = assessOpportunityRow({
      opportunity_score: 80,
      confidence: 45,
      population: 1000000,
      market_size: 100,
      competitors_count: 10,
      market_saturation_score: 20,
      annual_growth_rate: 5,
      avg_salary: 8000,
      data_year: 2026,
      fetched_at: new Date().toISOString(),
      source_type: 'fallback',
      is_estimated: true,
      opportunity_breakdown: {
        confidence: 45,
        estimated: true,
        metricCoverage: 100,
        source: 'fallback'
      }
    });

    expect(result.freshnessBasis).toBe('unknown');
    expect(result.observationAgeDays).toBeNull();
    expect(result.retrievalAgeDays).toBe(0);
  });

  test('opportunity reliability does not treat freshly fetched old observations as fresh', () => {
    const common = {
      opportunity_score: 80,
      confidence: 90,
      population: 1000000,
      market_size: 100,
      competitors_count: 10,
      market_saturation_score: 20,
      annual_growth_rate: 5,
      avg_salary: 8000,
      source_type: 'OFFICIAL_OBSERVED',
      opportunity_breakdown: {
        confidence: 90,
        metricCoverage: 100,
        growth: 80,
        perCapitaMarket: 80,
        lowSaturation: 80,
        laborAvailability: 80,
        purchasingPower: 80,
        rentAffordability: 80,
        lowRisk: 80
      }
    };

    const oldObservation = assessOpportunityRow({
      ...common,
      data_year: 2020,
      fetched_at: new Date().toISOString()
    });
    const recentObservation = assessOpportunityRow({
      ...common,
      data_year: new Date().getUTCFullYear(),
      fetched_at: new Date().toISOString()
    });

    expect(oldObservation.freshnessBasis).toBe('observation');
    expect(oldObservation.observationAgeDays).toBeGreaterThan(oldObservation.retrievalAgeDays);
    expect(oldObservation.reliability).toBeLessThan(recentObservation.reliability);
  });
});
