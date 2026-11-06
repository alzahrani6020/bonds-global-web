'use strict';

const assistantManifest = require('../../services/manifests/assistant.service.json');
const financeManifest = require('../../services/manifests/financial-engine.service.json');
const researchManifest = require('../../services/manifests/web-research.service.json');
const { getRuntimeAdapter } = require('../../lib/capabilities/runtime-adapters');
const { getCapability } = require('../../lib/capabilities/bonds-capability-registry');

describe('new capability wiring', () => {
  const actions = [
    'math_calculate',
    'accounting_account_create',
    'accounting_period_initialize_monthly',
    'bonds_answer_brief'
  ];

  test('manifests and generated registry expose all four capabilities', () => {
    const manifestActions = new Set([
      ...assistantManifest.capabilities,
      ...financeManifest.capabilities,
      ...researchManifest.capabilities
    ].map(item => item.action));

    for (const action of actions) {
      expect(manifestActions.has(action)).toBe(true);
      expect(getCapability(action)).toBeTruthy();
      expect(getRuntimeAdapter(getCapability(action).runtime.adapter)).toBeTruthy();
    }
  });

  test('deterministic math executes without model inference', async () => {
    const adapter = getRuntimeAdapter('assistant_math_calculate');
    const result = await adapter({ expression:'2+2*3' });
    expect(result).toMatchObject({
      ok:true,
      executed:true,
      result:{ value:8 }
    });
  });

  test('answer brief executes as a governed compute adapter', async () => {
    const adapter = getRuntimeAdapter('bonds_answer_brief');
    const result = await adapter({
      topic:'حسني مبارك',
      sources:[{
        id:'source-1',
        title:'حسني مبارك',
        publisher:'example.org',
        kind:'reference',
        text:'حسني مبارك سياسي وعسكري مصري.'
      }]
    });
    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.capability_id).toBe('BONDS-CAP-BRIEF-001');
  });
});
