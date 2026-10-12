/**
 * @jest-environment node
 */

const FusionCore = require('../../v3/engine/data-acquisition/FusionCore');
const DataPipeline = require('../../v3/engine/data-acquisition/DataPipeline');

describe('Data acquisition truth controls', () => {
  test('zero-confidence override remains zero confidence', () => {
    const result = new FusionCore().fuse([{
      value: 100,
      sourceId: 'manual',
      confidence: 0,
      isOverride: true
    }]);

    expect(result.value).toBe(100);
    expect(result.confidence).toBe(0);
  });

  test('zero-confidence ordinary metric is not promoted to default confidence', () => {
    const result = new FusionCore().fuse([{
      value: 100,
      sourceId: 'source-a',
      confidence: 0,
      fetchedAt: new Date().toISOString()
    }]);

    expect(result.value).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.method).toBe('unweighted');
  });

  test('unknown observation time receives a confidence penalty instead of being treated as fresh', () => {
    const result = new FusionCore().fuse([{
      value: 100,
      sourceId: 'source-a',
      confidence: 80
    }]);

    expect(result.value).toBe(100);
    expect(result.confidence).toBe(55);
    expect(result.sources[0].freshnessKnown).toBe(false);
  });

  test('missing city country code does not silently become Saudi Arabia', async () => {
    const pipeline = Object.create(DataPipeline.prototype);
    pipeline.supabase = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          single() {
            return Promise.resolve({ data: { country_code: null }, error: null });
          }
        };
      }
    };

    await expect(pipeline._getCityCountryCode('city-1'))
      .rejects.toThrow('City country_code is missing');
  });
});
