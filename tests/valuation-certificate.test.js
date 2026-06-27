/**
 * Tests for BONDS Valuation Certificate handler (unit-level)
 */

const {
  computeSealHash,
  CERTIFICATE_CONFIDENCE_MIN,
  CERTIFICATE_DATA_QUALITY_MIN
} = require('../lib/ai/valuation-certificate-handler');

describe('BONDS Valuation Certificate Handler', () => {
  const originalEnv = process.env.BDVC_SEAL_SECRET;

  beforeEach(() => {
    process.env.BDVC_SEAL_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.BDVC_SEAL_SECRET = originalEnv;
  });

  test('computeSealHash is deterministic for same inputs', () => {
    const h1 = computeSealHash('BDVC-2026-SA-00000001', 'uuid-1', '2026-06-27T10:00:00.000Z');
    const h2 = computeSealHash('BDVC-2026-SA-00000001', 'uuid-1', '2026-06-27T10:00:00.000Z');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  test('computeSealHash changes when any input changes', () => {
    const base = computeSealHash('BDVC-2026-SA-00000001', 'uuid-1', '2026-06-27T10:00:00.000Z');
    const differentNumber = computeSealHash('BDVC-2026-SA-00000002', 'uuid-1', '2026-06-27T10:00:00.000Z');
    const differentAsset = computeSealHash('BDVC-2026-SA-00000001', 'uuid-2', '2026-06-27T10:00:00.000Z');
    const differentTime = computeSealHash('BDVC-2026-SA-00000001', 'uuid-1', '2026-06-27T11:00:00.000Z');

    expect(differentNumber).not.toBe(base);
    expect(differentAsset).not.toBe(base);
    expect(differentTime).not.toBe(base);
  });

  test('certificate quality gate thresholds are 85/80', () => {
    expect(CERTIFICATE_CONFIDENCE_MIN).toBe(85);
    expect(CERTIFICATE_DATA_QUALITY_MIN).toBe(80);
  });
});
