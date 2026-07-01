const { predictField } = require('../../lib/predictive-input/predictive-input-engine');

describe('Predictive Input Engine', () => {
  it('predicts rent from similar projects', async () => {
    const result = await predictField(
      { name: 'rent', type: 'number' },
      { sector: 'restaurant', city: 'Riyadh' }
    );
    expect(result).not.toBeNull();
    expect(result.source).toBe('similar_projects');
    expect(result.mode).toMatch(/auto|suggest/);
  });

  it('predicts location index from geographic data', async () => {
    const result = await predictField(
      { name: 'location_index', type: 'number' },
      { city: 'Dubai' }
    );
    expect(result).not.toBeNull();
    expect(result.source).toBe('geographic_data');
    expect(result.value).toBe(82);
  });

  it('predicts sector benchmark', async () => {
    const result = await predictField(
      { name: 'food_cost_percentage', type: 'number' },
      { sector: 'restaurant' }
    );
    expect(result).not.toBeNull();
    expect(result.source).toBe('sector_benchmarks');
  });

  it('returns null for unknown field', async () => {
    const result = await predictField(
      { name: 'unicorn_count', type: 'number' },
      { sector: 'restaurant' }
    );
    expect(result).toBeNull();
  });
});
