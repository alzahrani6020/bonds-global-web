'use strict';

const { assessAutoPopulation } = require('../../lib/confidence/data-reliability-engine');

describe('data reliability engine', () => {
  test('coverage and source quality affect reliability independently from field completeness confidence', () => {
    const result = assessAutoPopulation({
      populated: [{
        field: 'rent',
        confidence: 90,
        source: 'trusted_data_fabric',
        sourceDetail: 'benchmark',
        timestamp: new Date().toISOString(),
        evidence: { source_type: 'BENCHMARK', is_estimated: true }
      }]
    }, [{ name: 'rent' }, { name: 'labor_cost' }]);

    expect(result.coverage).toBe(50);
    expect(result.sourceQuality).toBe(55);
    expect(result.score).toBeLessThan(90);
  });
});
