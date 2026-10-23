/** @jest-environment node */

const { corpus } = require('../../lib/assistant/golden-conversations');
const {
  ASSISTANT_EVALUATIONS_VERSION,
  evaluateAssistant,
  assertAssistantEvaluationsPass
} = require('../../lib/assistant/assistant-evaluations');

describe('Assistant Evaluations', () => {
  test('current golden corpus passes every deterministic evaluation gate', () => {
    const result = evaluateAssistant();

    expect(ASSISTANT_EVALUATIONS_VERSION).toBe(1);
    expect(result).toMatchObject({
      version: 1,
      status: 'pass',
      execution_authorized: false,
      writes_performed: false,
      metrics: {
        conversation_count: 8,
        passed: 8,
        failed: 0,
        structural_accuracy: 1,
        ready_accuracy: 1,
        denial_accuracy: 1,
        arabic_accuracy: 1,
        english_accuracy: 1
      },
      gates: {
        corpus_valid: true,
        exact_structural_accuracy: true,
        ready_flow_accuracy: true,
        denial_flow_accuracy: true,
        bilingual_accuracy: true,
        execution_safety: true
      },
      failures: []
    });
  });

  test('planner drift fails closed and identifies the affected golden case', () => {
    const changed = JSON.parse(JSON.stringify(corpus));
    const item = changed.conversations.find(entry => entry.id === 'ar_navigation_kyc');
    item.expected.action.target = 'cash_flow';

    const result = evaluateAssistant(changed);

    expect(result.status).toBe('fail');
    expect(result.execution_authorized).toBe(false);
    expect(result.metrics.structural_accuracy).toBeLessThan(1);
    expect(result.metrics.arabic_accuracy).toBeLessThan(1);
    expect(result.gates.exact_structural_accuracy).toBe(false);
    expect(result.gates.bilingual_accuracy).toBe(false);
    expect(result.failures).toEqual(expect.arrayContaining([
      'GATE_FAILED:exact_structural_accuracy',
      'GATE_FAILED:bilingual_accuracy',
      'ar_navigation_kyc:ACTION_TARGET_DRIFT'
    ]));
  });

  test('invalid corpus is rejected before evaluation', () => {
    const changed = JSON.parse(JSON.stringify(corpus));
    changed.conversations[0].planner_input.provider = 'external-model';

    const result = evaluateAssistant(changed);

    expect(result.status).toBe('invalid');
    expect(result.metrics).toBeNull();
    expect(result.gates.corpus_valid).toBe(false);
    expect(result.execution_authorized).toBe(false);
    expect(result.writes_performed).toBe(false);
    expect(result.failures).toContain('CONVERSATION_1_PLANNER_KEY_FORBIDDEN:provider');
  });

  test('assert helper fails closed with structured evaluation evidence', () => {
    const changed = JSON.parse(JSON.stringify(corpus));
    const item = changed.conversations.find(entry => entry.id === 'en_unknown_form_denied');
    item.expected.context_code = 'WRONG_CODE';

    let thrown;
    try {
      assertAssistantEvaluationsPass(changed);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeTruthy();
    expect(thrown.message).toBe('ASSISTANT_EVALUATIONS_FAILED');
    expect(thrown.result.status).toBe('fail');
    expect(thrown.result.execution_authorized).toBe(false);
    expect(thrown.result.failures).toContain('en_unknown_form_denied:CONTEXT_CODE_DRIFT');
  });
});
