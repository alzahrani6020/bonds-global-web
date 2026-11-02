/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

const apiIndex = fs.readFileSync(
  path.join(__dirname, '../../v3/api/index.js'),
  'utf8'
);

describe('country model override query contract', () => {
  test('does not send all project model ids through a PostgREST IN filter', () => {
    expect(apiIndex).toContain(".from('country_model_overrides')");
    expect(apiIndex).toContain(".eq('country_code', countryCode)");
    expect(apiIndex).toContain("filter(row => modelIds.has(row.project_model_id))");
    expect(apiIndex).not.toContain(".in('project_model_id', modelIds)");
  });
  test('supports canonical investment-sector filtering and activity enrichment', () => {
    expect(apiIndex).toContain("url.searchParams.get('investment_sector')");
    expect(apiIndex).toContain(".from('legacy_sector_investment_map')");
    expect(apiIndex).toContain(".eq('investment_sector_id', canonicalSector.id)");
    expect(apiIndex).toContain(".eq('is_primary', true)");
    expect(apiIndex).toContain(".from('canonical_activity_legacy_aliases')");
    expect(apiIndex).toContain('canonical_activity: canonicalByLegacyActivityId.get(model.activity_id) || null');
  });
});
