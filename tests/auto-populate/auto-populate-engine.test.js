const { populate, populateField } = require('../../lib/auto-populate/auto-populate-engine');

describe('Auto Population Engine', () => {
  it('auto-fills rent with high confidence', async () => {
    const result = await populateField(
      { name: 'rent', type: 'number', unit: 'currency/month' },
      { sector: 'restaurant', city: 'Riyadh', country: 'SA', userId: 'usr-123' }
    );
    expect(result).not.toBeNull();
    expect(result.mode).toBe('auto');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });

  it('suggests energy cost with medium confidence', async () => {
    const result = await populateField(
      { name: 'energy_cost', type: 'number' },
      { sector: 'manufacturing' }
    );
    expect(result).not.toBeNull();
    expect(result.mode).toBe('suggest');
  });

  it('returns null for unknown field', async () => {
    const result = await populateField(
      { name: 'magic_number', type: 'number' },
      { sector: 'restaurant' }
    );
    expect(result).toBeNull();
  });

  it('populates a form and marks manual fields', async () => {
    const form = {
      sector: 'restaurant',
      fields: [
        { name: 'rent', type: 'number' },
        { name: 'labor_cost', type: 'number' },
        { name: 'magic_number', type: 'number' }
      ]
    };
    const result = await populate(form, { sector: 'restaurant' });
    expect(result.populated.length).toBeGreaterThan(0);
    expect(result.manual).toContain('magic_number');
    expect(result.overallGrade).toBeDefined();
  });
});
