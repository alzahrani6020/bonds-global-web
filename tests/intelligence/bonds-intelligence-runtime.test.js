'use strict';

const {
  validatePublicUrl,
  parseRobots
} = require('../../lib/intelligence/web-acquisition');
const {
  extractContent
} = require('../../lib/intelligence/content-extraction');
const {
  verifyEvidence,
  synthesizeResearch
} = require('../../lib/intelligence/research-intelligence');
const {
  listCapabilities,
  validateCapabilityInput
} = require('../../lib/capabilities/bonds-capability-registry');
const { planCapabilities } = require('../../lib/capabilities/capability-planner');
const {
  assertSeparatedRoles,
  CapabilityGovernance
} = require('../../lib/capabilities/capability-governance');
const { executeCapability } = require('../../lib/capabilities/governed-executor');
const {
  createLedgerEntry,
  verifyLedgerEntry,
  LEDGER_VERSION
} = require('../../lib/decision-os/decision-ledger');
const {
  NativeInferenceProvider,
  InferenceRouter
} = require('../../lib/ai/inference-router');

describe('Bonds Intelligence Runtime', () => {
  test('blocks loopback/private acquisition targets by default', async () => {
    await expect(validatePublicUrl('http://127.0.0.1:3000/private'))
      .rejects.toMatchObject({ code: 'PRIVATE_OR_RESERVED_DESTINATION' });
  });

  test('robots parser honors longest allow/disallow rule', () => {
    const robots = parseRobots(
      'User-agent: *\nDisallow: /private\nAllow: /private/public\n',
      'Bonds-Intelligence-WebAcquisition/1.0'
    );
    expect(robots.canFetch('https://example.com/open')).toBe(true);
    expect(robots.canFetch('https://example.com/private/a')).toBe(false);
    expect(robots.canFetch('https://example.com/private/public/a')).toBe(true);
  });

  test('extracts structured JSON, CSV and HTML content', async () => {
    const json = await extractContent(Buffer.from('{"a":1}'), 'application/json');
    expect(json.format).toBe('json');
    expect(json.data.a).toBe(1);

    const csv = await extractContent(Buffer.from('a,b\n1,2'), 'text/csv');
    expect(csv.format).toBe('csv');
    expect(csv.rows).toEqual([['a', 'b'], ['1', '2']]);

    const html = await extractContent(Buffer.from('<html><title>X</title><body>Hello <b>World</b></body></html>'), 'text/html');
    expect(html.format).toBe('html');
    expect(html.title).toBe('X');
    expect(html.text).toContain('Hello World');
  });

  test('research verification supports consensus and blocks contradictions', () => {
    const supported = verifyEvidence({
      topic: 'population',
      sources: [
        { id: 'a', publisher: 'Authority A', claims: [{ key: 'population', value: 100 }] },
        { id: 'b', publisher: 'Authority B', claims: [{ key: 'population', value: 100 }] }
      ]
    });
    expect(supported.ok).toBe(true);
    expect(supported.result.verification_state).toBe('SUPPORTED');
    expect(supported.claim_promotion_allowed).toBe(true);

    const contested = verifyEvidence({
      topic: 'population',
      sources: [
        { id: 'a', publisher: 'Authority A', claims: [{ key: 'population', value: 100 }] },
        { id: 'b', publisher: 'Authority B', claims: [{ key: 'population', value: 200 }] }
      ]
    });
    expect(contested.ok).toBe(false);
    expect(contested.result.verification_state).toBe('CONTESTED');
    expect(contested.result.contradictions).toHaveLength(1);

    const synthesis = synthesizeResearch({
      topic: 'population',
      sources: [
        { id: 'a', publisher: 'Authority A', claims: [{ key: 'population', value: 100 }] },
        { id: 'b', publisher: 'Authority B', claims: [{ key: 'population', value: 100 }] }
      ]
    });
    expect(synthesis.provenance_preserved).toBe(true);
    expect(synthesis.result.known[0].source_ids).toEqual(['a', 'b']);
  });

  test('capability registry and planner fail closed on missing/unknown inputs', () => {
    expect(listCapabilities().some(c => c.action === 'web_fetch')).toBe(true);
    expect(validateCapabilityInput('web_fetch', {}).valid).toBe(false);
    expect(validateCapabilityInput('does_not_exist', {}).code).toBe('UNKNOWN_CAPABILITY');

    const plan = planCapabilities({
      actions: ['web_fetch', 'evidence_verify'],
      inputs: {
        web_fetch: { url: 'https://example.com' },
        evidence_verify: {}
      }
    });
    expect(plan.executable).toBe(false);
    expect(plan.requires_governed_execution).toBe(true);
    expect(plan.missing_inputs).toEqual([
      expect.objectContaining({ action: 'evidence_verify' })
    ]);
  });

  test('governance requires independent human/service roles and persistence', async () => {
    expect(() => assertSeparatedRoles({
      reviewer_id: 'same',
      evaluator_id: 'same',
      certifier_id: 'c',
      operator_id: 'o'
    })).toThrow(/independently separated/);

    const noStore = new CapabilityGovernance();
    const persistenceRequired = await noStore.promote(
      { id: 'x', action: 'x', execute() {} },
      { reviewer_id: 'r', evaluator_id: 'e', certifier_id: 'c', operator_id: 'o' },
      { evaluation: { passed: true }, certification: { certified: true } }
    );
    expect(persistenceRequired.status).toBe('PERSISTENCE_REQUIRED');

    const records = new Map();
    const store = {
      async get(id) { return records.get(id) || null; },
      async put(id, record) { records.set(id, record); },
      async rollback(id, operator) {
        const current = records.get(id);
        if (!current) return null;
        const rolled = { ...current, state: 'ROLLED_BACK', rolled_back_by: operator };
        records.set(id, rolled);
        return rolled;
      }
    };
    const governance = new CapabilityGovernance({ store });
    const promoted = await governance.promote(
      { id: 'cap-1', action: 'research_synthesize', version: '1.0.0', execute() {} },
      { reviewer_id: 'reviewer', evaluator_id: 'evaluator', certifier_id: 'certifier', operator_id: 'operator' },
      {
        review: { approved: true },
        evaluation: { passed: true },
        certification: { certified: true }
      }
    );
    expect(promoted.promoted).toBe(true);
    expect(promoted.status).toBe('ACTIVE');

    const rolled = await governance.rollback('cap-1', 'operator-2');
    expect(rolled.rolled_back).toBe(true);
  });

  test('decision ledger is deterministic and tamper-evident', () => {
    const entry = createLedgerEntry({
      decision: 'Proceed',
      requestId: 'req-1',
      workflowId: 'wf-1',
      evidenceGraph: { nodes: [{ id: 'e1' }], edges: [] },
      policyEvaluations: { passed: true },
      calculationVersion: 'ucp-1',
      model: { backend: 'llama_cpp', model_sha256: 'abc' },
      previousHash: 'previous',
      createdAt: '2026-10-13T00:00:00.000Z',
      actorId: 'user-1'
    });
    expect(entry.ledger_version).toBe(LEDGER_VERSION);
    expect(verifyLedgerEntry(entry)).toBe(true);
    expect(verifyLedgerEntry({ ...entry, decision: 'Reject' })).toBe(false);
  });

  test('unknown governed capability returns precise client error', async () => {
    const result = await executeCapability('not_real', {}, {});
    expect(result.ok).toBe(false);
    expect(result.httpStatus).toBe(404);
    expect(result.error.code).toBe('UNKNOWN_CAPABILITY');
  });

  test('native inference router is provider-independent and handles runtime response', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async (url, options) => {
      if (String(url).endsWith('/health')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ ok: true, runtime: { backend: 'llama_cpp' } })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true, result: { text: 'local answer', backend: 'llama_cpp' } })
      };
    });

    try {
      const provider = new NativeInferenceProvider({ baseUrl: 'http://127.0.0.1:8765', token: 'secret' });
      const health = await provider.health();
      expect(health.ok).toBe(true);

      const router = new InferenceRouter({
        mode: 'LOCAL_NATIVE',
        localUrl: 'http://127.0.0.1:8765',
        token: 'secret'
      });
      const generated = await router.generate('hello');
      expect(generated.ok).toBe(true);
      expect(generated.provider).toBe('BondsNativeProvider');
      expect(generated.external_llm_provider).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ authorization: 'Bearer secret' })
        })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
