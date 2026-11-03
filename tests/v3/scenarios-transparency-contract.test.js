/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

const scenariosApi = fs.readFileSync(
  path.join(__dirname, '../../v3/api/scenarios.js'),
  'utf8'
);
const scenarioEngine = fs.readFileSync(
  path.join(__dirname, '../../v3/engine/ScenarioEngine.js'),
  'utf8'
);

describe('V3 scenario transparency contract', () => {
  test('passes country context into model loading', () => {
    expect(scenariosApi).toContain('const { projectModelCode, cityCode, countryCode');
    expect(scenariosApi).toContain('loadProjectModel(supabase, projectModelCode, cityCode, countryCode)');
  });

  test('returns calculation context and input provenance', () => {
    expect(scenariosApi).toContain('currencyCode: modelData.countryContext?.currency_code');
    expect(scenariosApi).toContain('cityDataStatus');
    expect(scenariosApi).toContain('cityAdjustmentsApplied: results.baseline?.cityAdjustments || []');
    expect(scenariosApi).toContain('cityConfidence: modelData.cityIndicators?.overall_confidence ?? null');
    expect(scenariosApi).toContain('cityIndicatorYear: modelData.cityIndicators?.year ?? null');
    expect(scenariosApi).toContain('cityMarketDataYear: modelData.marketData?.data_year ?? null');
    expect(scenariosApi).toContain('cityMarketDataConfidence: modelData.marketData?.confidence ?? null');
    expect(scenariosApi).toContain('cityMarketDataSource: modelData.marketData?.source ?? null');
    expect(scenariosApi).toContain("revenue: assumptions.revenue !== undefined ? 'user' : 'model'");
  });

  test('validates and returns explicit forecast timing', () => {
    expect(scenariosApi).toContain("projectionYears must be an integer between 1 and 10");
    expect(scenariosApi).toContain("baseYear must be an integer between 2000 and 2100");
    expect(scenariosApi).toContain('forecastStartYear: baseYear + 1');
    expect(scenariosApi).toContain('forecastEndYear: baseYear + projectionYears');
    expect(scenariosApi).toContain("baseYear: assumptions.baseYear !== undefined ? 'user' : 'default'");
  });

  test('returns authoritative preset definitions', () => {
    expect(scenariosApi).toContain("path === '/calculate/scenarios/presets'");
    expect(scenariosApi).toContain('ScenarioEngine.getPreset(code)');
  });

  test('reports applied and ignored shocks without changing applyShocks public contract', () => {
    expect(scenarioEngine).toContain('function applyShocksWithDiagnostics');
    expect(scenarioEngine).toContain('function applyShocks(assumptions, shocks)');
    expect(scenarioEngine).toContain('return applyShocksWithDiagnostics(assumptions, shocks).assumptions');
    expect(scenarioEngine).toContain('appliedShocks:');
    expect(scenarioEngine).toContain('ignoredShocks:');
    expect(scenarioEngine).toContain("reason: 'assumption_not_available_in_model'");
  });
});
