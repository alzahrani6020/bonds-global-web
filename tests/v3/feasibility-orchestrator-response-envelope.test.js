'use strict';

// Regression: the orchestrator's trace wrapper must not become an extra
// public result layer, or NPV/IRR disappear from the feasibility artifact gate.
const orchestrator = require('../../lib/orchestrator/intelligence-orchestrator');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');
const { assessFeasibilityArtifact } = require('../../lib/finance/feasibility-artifact-gate');
const { feasibilityAnalysis } = require('../../lib/finance/engines/feasibility-engine');

describe('governed orchestrator response contract', () => {
  afterEach(() => jest.restoreAllMocks());

  test('unwraps the domain result while retaining trace and archive-ready metrics', async () => {
    const calculated = feasibilityAnalysis({
      initial_investment: 100000,
      cash_flows: [30000, 30000, 30000, 30000, 30000],
      discount_rate: 0.1
    });
    expect(calculated.executed).toBe(true);
    const expected = { intent: { intent: 'feasibility' }, engineResults: { feasibility: calculated } };
    const trace = { name: 'intelligence-orchestrator', steps: [{ name: 'run_engines' }] };
    const runSpy = jest.spyOn(orchestrator, 'run').mockResolvedValue({ result: expected, trace });
    const adapter = getRuntimeAdapter('orchestrator_run');
    const executed = await adapter(
      { request: { intent: 'feasibility', values: { investment_amount: 100000 } } },
      { actor: { id: 'fixture-owner' }, userId: 'fixture-owner', userTier: 'pro', requestId: 'fixture-req' }
    );
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(executed).toMatchObject({ ok: true, executed: true, trace });
    expect(executed.result).toBe(expected);
    expect(executed.result.result).toBeUndefined();
    expect(executed.result.engineResults.feasibility.metrics.npv).toBeCloseTo(13723.603082, 5);
    expect(executed.result.engineResults.feasibility.metrics.irr_pct).toBeCloseTo(15.238237, 5);
    expect(assessFeasibilityArtifact({ result: executed.result })).toEqual({
      complete: true, required_inputs: []
    });
  });

  test('fails closed without an authorized runtime actor', async () => {
    const runSpy = jest.spyOn(orchestrator, 'run');
    const adapter = getRuntimeAdapter('orchestrator_run');
    const response = await adapter({ request: {} }, {
      actor: { id: 'another-user' }, userId: 'fixture-owner', userTier: 'pro'
    });
    expect(response).toMatchObject({
      ok: false, executed: false, error: { code: 'USER_GOVERNANCE_UNAVAILABLE' }
    });
    expect(runSpy).not.toHaveBeenCalled();
  });
});
