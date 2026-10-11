'use strict';

const LLMEstimationAdapter = require('../../v3/engine/data-acquisition/adapters/LLMEstimationAdapter');

describe('LLMEstimationAdapter capability labeling', () => {
  test('local inference is not represented as an executed LLM call', async () => {
    const adapter = new LLMEstimationAdapter({
      inferenceEngine: {
        infer: () => ({ value: 123, valueText: null, confidence: 40, confidenceReason: 'local estimate' })
      }
    });
    expect(adapter.config.sourceName).toContain('Inference');
    const rows = await adapter.fetch({ cityCode: 'SA-01-001', activityCode: 'restaurant', metricCodes: ['market_size'] });
    const transformed = await adapter.transform(rows[0]);
    expect(transformed[0].metadata.actualMethod).toBe('local_inference');
    expect(transformed[0].metadata.llmExecuted).toBe(false);
    expect(transformed[0].metadata.sourceType).toBe('INFERRED');
  });
});
