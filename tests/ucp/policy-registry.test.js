const { PolicyRegistry } = require('../../lib/ucp/policy-registry');

describe('UCP Policy Registry', () => {
  let registry;

  beforeEach(() => {
    registry = new PolicyRegistry({ preferStatic: true });
  });

  test('evaluates VAT policy', () => {
    const result = registry.evaluate(['pol_sa_retail_vat'], { vat_rate: 15 });
    expect(result.valid).toBe(true);
  });

  test('finds policies by sector and country', () => {
    const policies = registry.findBySectorCountry('retail', 'SA', 'tax');
    expect(policies.length).toBe(1);
    expect(policies[0].code).toBe('pol_sa_retail_vat');
  });

  test('flags failing LTV policy', () => {
    const result = registry.evaluate(['pol_sa_financing_ltv'], { ltv: 90 });
    expect(result.valid).toBe(false);
    expect(result.results[0].status).toBe('fail');
  });
});
