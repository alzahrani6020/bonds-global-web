const semantic = require('../../lib/semantic');

describe('Semantic Layer', () => {
  it('resolves Arabic sector name', () => {
    const result = semantic.resolveSector('مطعم');
    expect(result.sector).toBe('restaurant');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('resolves English sector name', () => {
    const result = semantic.resolveSector('factory');
    expect(result.sector).toBe('manufacturing');
  });

  it('returns null for unknown sector', () => {
    expect(semantic.resolveSector('spaceship')).toBeNull();
  });

  it('infers concepts for restaurant with delivery activity', () => {
    const concepts = semantic.inferConcepts('restaurant', 'delivery restaurant');
    expect(concepts).toContain('delivery');
    expect(concepts).toContain('food_cost_percentage');
  });

  it('returns fields for a sector', () => {
    const fields = semantic.getFields('hotel');
    expect(fields.some(f => f.name === 'number_of_rooms')).toBe(true);
    expect(fields.some(f => f.name === 'occupancy_rate')).toBe(true);
  });

  it('lists all sectors', () => {
    expect(semantic.listSectors()).toContain('restaurant');
    expect(semantic.listSectors()).toContain('manufacturing');
  });
});
