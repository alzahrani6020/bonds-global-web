/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const api = fs.readFileSync(path.resolve(__dirname, '../../v3/api/index.js'), 'utf8');

describe('V3 city evidence and market activity alias resolution', () => {
  test('city evidence resolves canonical activity aliases before filtering rows', () => {
    const start = api.indexOf('async function handleCityEvidence');
    const end = api.indexOf('async function handleCityMarket');
    const block = api.slice(start, end);

    expect(block).toContain('resolveActivitySelection(supabase, activityCode)');
    expect(block).toContain('activityIds = activitySelection.ids');
    expect(block).toContain('activityIds.includes(row.activity_id)');
    expect(block).not.toContain(".eq('code', activityCode)");
  });

  test('city market resolves aliases for both latest legacy lookup and target-year query', () => {
    const start = api.indexOf('async function handleCityMarket');
    const end = api.indexOf('async function handleUcpCalculate');
    const block = api.slice(start, end);

    expect(block).toContain('resolveActivitySelection(supabase, activityCode)');
    expect(block).toContain("q.in('activity_id', activitySelection.ids)");
    expect(block).toContain("query.in('activity_id', activitySelection.ids)");
    expect(block).not.toContain("query.eq('activity_id', activity.id)");
  });
});
