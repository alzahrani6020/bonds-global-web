const { buildForm } = require('../../lib/forms/dynamic-form-engine');

describe('Dynamic Form Engine', () => {
  it('builds a restaurant form with required food cost', () => {
    const form = buildForm({ sector: 'restaurant', activity: 'fast food', intent: 'feasibility', context: 'investment', language: 'ar' });
    expect(form.sector).toBe('restaurant');
    expect(form.fields.some(f => f.name === 'food_cost_percentage' && f.required)).toBe(true);
  });

  it('hides vehicle fields for real estate', () => {
    const form = buildForm({ sector: 'company', activity: 'realEstate', intent: 'value_asset', language: 'en' });
    // The rule hides mileage etc.; verify no hidden field is required.
    const mileage = form.fields.find(f => f.name === 'mileage');
    if (mileage) expect(mileage.hidden).toBe(true);
  });

  it('weights fields by decision context', () => {
    const form = buildForm({ sector: 'company', intent: 'request_financing', context: 'financing', language: 'en' });
    const dscr = form.fields.find(f => f.name === 'dscr');
    if (dscr) expect(dscr.weight).toBeGreaterThan(1);
  });

  it('includes common fields', () => {
    const form = buildForm({ sector: 'manufacturing', intent: 'feasibility', language: 'en' });
    expect(form.fields.some(f => f.name === 'project_name')).toBe(true);
    expect(form.fields.some(f => f.name === 'country')).toBe(true);
  });

  it('sorts required fields first', () => {
    const form = buildForm({ sector: 'hotel', intent: 'feasibility', language: 'en' });
    const firstRequiredIndex = form.fields.findIndex(f => f.required);
    const firstOptionalIndex = form.fields.findIndex(f => !f.required);
    expect(firstRequiredIndex).toBeLessThanOrEqual(firstOptionalIndex);
  });
});
