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
  test('can expose model availability for canonical investment sectors', () => {
    expect(apiIndex).toContain("include.has('model_availability')");
    expect(apiIndex).toContain(".from('legacy_sector_investment_map')");
    expect(apiIndex).toContain('model_available: includeModelAvailability ? modelAvailabilityBySector.has(sector.id) : null');
    expect(apiIndex).toContain('model_count: includeModelAvailability ? (modelAvailabilityBySector.get(sector.id) || 0) : null');
  });

  test('supports canonical investment-sector filtering and activity enrichment', () => {
    expect(apiIndex).toContain("url.searchParams.get('investment_sector')");
    expect(apiIndex).toContain(".from('legacy_sector_investment_map')");
    expect(apiIndex).toContain(".eq('investment_sector_id', canonicalSector.id)");
    expect(apiIndex).toContain(".eq('is_primary', true)");
    expect(apiIndex).toContain(".from('canonical_activity_legacy_aliases')");
    expect(apiIndex).toContain(".from('canonical_activity_investment_sectors')");
    expect(apiIndex).toContain(".eq('sector_id', investmentSector.id)");
    expect(apiIndex).toContain("allowedCanonicalActivityIds.has(model.canonical_activity.id)");
    expect(apiIndex).toContain('canonical_activity: canonicalByLegacyActivityId.get(model.activity_id) || null');
  });
});
