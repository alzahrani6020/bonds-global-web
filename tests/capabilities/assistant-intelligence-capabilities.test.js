const { getCapability } = require('../../lib/capabilities/bonds-capability-registry');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');

describe('assistant decision intelligence capabilities', () => {
  const actions = [
    'evidence_graph_analyze',
    'blind_spot_analyze',
    'decision_graph_build',
    'recommendation_synthesize',
    'event_monitor_analyze'
  ];

  test('registers each capability as active compute under research-intelligence', () => {
    for (const action of actions) {
      const spec = getCapability(action);
      expect(spec).toBeTruthy();
      expect(spec.active).toBe(true);
      expect(spec.sideEffect).toBe('compute');
      expect(spec.serviceCode).toBe('research-intelligence');
      expect(getRuntimeAdapter(spec.runtime.adapter)).toEqual(expect.any(Function));
    }
  });

  test('runs evidence graph analysis through its registered adapter', async () => {
    const spec = getCapability('evidence_graph_analyze');
    const adapter = getRuntimeAdapter(spec.runtime.adapter);
    const result = await adapter({
      engineResults: {
        risk: {
          executed: true,
          confidence: 80,
          output: { primary: 'moderate' },
          evidence: [{
            source: 'test-source',
            evidence_code: 'risk_signal',
            value: 'moderate',
            observation_at: '2026-10-23',
            confidence: 80
          }]
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.result.engine).toBe('evidence_graph');
  });

  test('runs blind spot analysis without mutating external state', async () => {
    const spec = getCapability('blind_spot_analyze');
    const adapter = getRuntimeAdapter(spec.runtime.adapter);
    const result = await adapter({
      intent: 'feasibility',
      inputs: {},
      engineResults: {}
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.result.engine).toBe('blind_spot');
    expect(Array.isArray(result.result.output.blindSpots)).toBe(true);
  });

  test('event monitor adapter is hard-wired to dry run and no notifications', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'capabilities', 'runtime-adapters.js'),
      'utf8'
    );
    expect(source).toContain('persistAlerts: false');
    expect(source).toContain('sendNotifications: false');
  });
});
