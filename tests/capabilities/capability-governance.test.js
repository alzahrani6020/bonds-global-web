const {
  CAPABILITIES,
  validateCapabilityInput,
} = require('../../lib/capabilities/bonds-capability-registry');
const {
  CapabilityGovernance,
} = require('../../lib/capabilities/capability-governance');

describe('Capability governance safety', () => {
  test('Native capabilities are registered and validate required input', () => {
    expect(CAPABILITIES.native_health).toBeDefined();
    expect(CAPABILITIES.native_generate).toBeDefined();

    expect(validateCapabilityInput('native_generate', {}).valid).toBe(false);
    expect(validateCapabilityInput('native_generate', { prompt: 'hello' }).valid).toBe(true);
  });

  test('AI identities cannot certify or promote themselves', async () => {
    const store = {
      get: jest.fn(async () => null),
      put: jest.fn(async () => undefined),
    };
    const governance = new CapabilityGovernance({ store });
    const candidate = {
      id: 'BONDS-CAP-TEST-001',
      action: 'native_generate',
      version: '1.0.0',
      execute: async () => ({ ok: true }),
    };

    const result = await governance.promote(
      candidate,
      {
        reviewer_id: 'reviewer-1',
        evaluator_id: 'evaluator-1',
        certifier_id: 'bonds-ai',
        operator_id: 'operator-1',
      },
      {
        evaluation: { passed: true },
        certification: { certified: true },
      }
    );

    expect(result.promoted).toBe(false);
    expect(result.status).toBe('GOVERNANCE_REJECTED');
    expect(store.put).not.toHaveBeenCalled();
  });

  test('promotion requires independent roles plus evaluation and certification', async () => {
    let active = null;
    const store = {
      get: jest.fn(async () => active),
      put: jest.fn(async (_id, record) => { active = record; }),
    };
    const governance = new CapabilityGovernance({ store });
    const candidate = {
      id: 'BONDS-CAP-TEST-002',
      action: 'native_health',
      version: '1.0.0',
      execute: async () => ({ ok: true }),
    };

    const result = await governance.promote(
      candidate,
      {
        reviewer_id: 'reviewer-1',
        evaluator_id: 'evaluator-1',
        certifier_id: 'certifier-1',
        operator_id: 'operator-1',
      },
      {
        evaluation: { passed: true },
        certification: { certified: true },
      }
    );

    expect(result.promoted).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(active.capability_id).toBe(candidate.id);
    expect(active.candidate_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
