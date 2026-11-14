'use strict';

const { ENGINE_RUNNERS } = require('../../lib/orchestrator/intelligence-orchestrator');

describe('ENGINE_RUNNERS.confidence facade', () => {
  test('combines confidence of executed engines via the confidence engine', async () => {
    const result = await ENGINE_RUNNERS.confidence({
      ucpResult: {
        engineResults: {
          valuation: { executed: true, confidence: 80 },
          risk: { executed: true, confidence: 60 }
        }
      }
    });
    expect(result.executed).toBe(true);
    expect(result.status).toBe('computed');
    expect(result.sourceCount).toBe(2);
    // Geometric combination stays between the lowest and highest source.
    expect(result.confidence).toBeGreaterThan(60);
    expect(result.confidence).toBeLessThanOrEqual(80);
    expect(result.grade).toBeDefined();
  });

  test('reports unavailable when no engine executed', async () => {
    const result = await ENGINE_RUNNERS.confidence({ ucpResult: null });
    expect(result.executed).toBe(false);
    expect(result.status).toBe('insufficient_inputs');
    expect(result.reason).toBe('no_executed_engines_for_confidence');
  });

  test('ignores non-executed results when collecting sources', async () => {
    const result = await ENGINE_RUNNERS.confidence({
      ucpResult: {
        engineResults: {
          valuation: { executed: false, confidence: 90 },
          risk: { executed: true, confidence: 50 }
        }
      }
    });
    expect(result.sourceCount).toBe(1);
    expect(result.confidence).toBe(50);
  });
});
