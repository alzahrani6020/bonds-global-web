const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 investment taxonomy API', () => {
  test('canonical taxonomy endpoint is additive and keeps legacy sectors endpoint', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('async function handleInvestmentTaxonomy');
    expect(api).toContain("path === '/investment-taxonomy'");
    expect(api).toContain("path === '/sectors'");
    expect(api).toContain(".from('canonical_investment_sectors')");
    expect(api).toContain(".from('canonical_investment_subsectors')");
    expect(api).toContain(".from('canonical_activity_investment_sectors')");
    expect(api).toContain(".from('canonical_activity_investment_subsectors')");
  });

  test('country business-form eligibility is country-scoped and preserves verification status', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain(".from('canonical_activity_business_forms')");
    expect(api).toContain(".eq('country_code', countryCode)");
    expect(api).toContain('verification_status');
    expect(api).toContain('business_forms: eligibilityByActivity.get(activity.id) || []');
  });

  test('taxonomy returns the cross-cutting dimensions explicitly', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain(".from('investment_project_sizes')");
    expect(api).toContain(".from('investment_business_forms')");
    expect(api).toContain(".from('investment_opportunity_types')");
    expect(api).toContain("taxonomy_version: 'v3-canonical-investment-1'");
  });
});
