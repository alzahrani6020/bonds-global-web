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
});
