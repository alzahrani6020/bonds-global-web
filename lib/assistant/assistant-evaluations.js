'use strict';

const {
  corpus,
  validateGoldenConversationCorpus,
  runGoldenConversations
} = require('./golden-conversations');

const ASSISTANT_EVALUATIONS_VERSION = 1;

function ratio(passed, total) {
  if (!Number.isInteger(total) || total <= 0) return null;
  return Number((passed / total).toFixed(6));
}

function evaluateAssistant(value = corpus) {
  const validation = validateGoldenConversationCorpus(value);
  if (!validation.valid) {
    return {
      version: ASSISTANT_EVALUATIONS_VERSION,
      status: 'invalid',
      execution_authorized: false,
      writes_performed: false,
      validation,
      metrics: null,
      gates: {
        corpus_valid: false,
        exact_structural_accuracy: false,
        ready_flow_accuracy: false,
        denial_flow_accuracy: false,
        bilingual_accuracy: false,
        execution_safety: true
      },
      failures: validation.errors.slice()
    };
  }

  const run = runGoldenConversations(value);
  const items = value.conversations;
  const resultById = new Map(run.results.map(item => [item.id, item]));

  const ready = items.filter(item => item.expected?.status === 'ready');
  const denied = items.filter(item => item.expected?.status === 'denied');
  const arabic = items.filter(item => item.language === 'ar');
  const english = items.filter(item => item.language === 'en');

  const countPassed = list => list.filter(item => resultById.get(item.id)?.pass === true).length;

  const metrics = {
    conversation_count: items.length,
    passed: run.passed,
    failed: run.failed,
    structural_accuracy: ratio(run.passed, items.length),
    ready_accuracy: ratio(countPassed(ready), ready.length),
    denial_accuracy: ratio(countPassed(denied), denied.length),
    arabic_accuracy: ratio(countPassed(arabic), arabic.length),
    english_accuracy: ratio(countPassed(english), english.length),
    denied_case_count: denied.length,
    arabic_case_count: arabic.length,
    english_case_count: english.length
  };

  const gates = {
    corpus_valid: true,
    exact_structural_accuracy: metrics.structural_accuracy === 1,
    ready_flow_accuracy: metrics.ready_accuracy === 1,
    denial_flow_accuracy: metrics.denial_accuracy === 1,
    bilingual_accuracy: metrics.arabic_accuracy === 1 && metrics.english_accuracy === 1,
    execution_safety: run.execution_authorized === false
  };

  const failures = [];
  for (const [gate, passed] of Object.entries(gates)) {
    if (!passed) failures.push(`GATE_FAILED:${gate}`);
  }
  for (const item of run.results) {
    for (const failure of item.failures || []) {
      failures.push(`${item.id}:${failure}`);
    }
  }

  return {
    version: ASSISTANT_EVALUATIONS_VERSION,
    status: failures.length === 0 ? 'pass' : 'fail',
    execution_authorized: false,
    writes_performed: false,
    validation,
    metrics,
    gates,
    failures,
    results: run.results
  };
}

function assertAssistantEvaluationsPass(value = corpus) {
  const result = evaluateAssistant(value);
  if (result.status !== 'pass') {
    const error = new Error('ASSISTANT_EVALUATIONS_FAILED');
    error.result = result;
    throw error;
  }
  return result;
}

module.exports = {
  ASSISTANT_EVALUATIONS_VERSION,
  evaluateAssistant,
  assertAssistantEvaluationsPass
};
