/** @jest-environment node */
'use strict';

const {
  RED_TEAM_SCENARIOS_VERSION,
  corpus,
  validateRedTeamScenarioCorpus,
  runRedTeamScenario,
  runRedTeamScenarios
} = require('../../lib/assistant/red-team-scenarios');

describe('Assistant Red Team Scenarios', () => {
  test('v1 corpus is versioned, bilingual and covers every red-team scenario kind', () => {
    const result = validateRedTeamScenarioCorpus(corpus);
    expect(RED_TEAM_SCENARIOS_VERSION).toBe(1);
    expect(result).toEqual(expect.objectContaining({
      valid:true,
      scenario_count:10,
      languages:['ar','en']
    }));
    expect(result.kinds).toEqual([
      'confirmation_enforcement',
      'normalize_rejection',
      'planner_denial'
    ]);
  });

  test('all adversarial scenarios fail closed without execution or writes', () => {
    const result = runRedTeamScenarios();
    expect(result).toMatchObject({
      version:1,
      status:'pass',
      scenario_count:10,
      passed:10,
      failed:0,
      execution_authorized:false,
      writes_performed:false,
      failures:[]
    });
    expect(result.results.every(item => item.pass)).toBe(true);
  });

  test('detects denial contract drift instead of weakening the attack expectation', () => {
    const changed = JSON.parse(JSON.stringify(corpus));
    const scenario = changed.scenarios.find(item => item.id === 'ar_external_url_denied');
    scenario.expected.context_code = 'WRONG_CODE';

    const result = runRedTeamScenarios(changed);
    expect(result.status).toBe('fail');
    expect(result.execution_authorized).toBe(false);
    expect(result.failures).toContain('ar_external_url_denied:CONTEXT_CODE_DRIFT');
  });

  test('detects confirmation bypass expectation drift', () => {
    const scenario = JSON.parse(JSON.stringify(
      corpus.scenarios.find(item => item.id === 'high_risk_confirmation_cannot_be_disabled')
    ));
    scenario.expected.requires_confirmation = false;

    const changed = JSON.parse(JSON.stringify(corpus));
    changed.scenarios = changed.scenarios.map(item =>
      item.id === scenario.id ? scenario : item
    );

    const validation = validateRedTeamScenarioCorpus(changed);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('SCENARIO_10_CONFIRMATION_REQUIRED');
  });

  test('single scenario runner surfaces unexpected acceptance', () => {
    const scenario = {
      id:'drift-probe',
      kind:'planner_denial',
      language:'en',
      input:{ type:'site_navigate', target:'kyc', language:'en' },
      expected:{ status:'denied', context_code:'NAVIGATION_TARGET_NOT_REGISTERED', action_count:0 }
    };

    const result = runRedTeamScenario(scenario);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      'STATUS_DRIFT',
      'CONTEXT_CODE_DRIFT',
      'ACTION_COUNT_DRIFT'
    ]));
  });
});
