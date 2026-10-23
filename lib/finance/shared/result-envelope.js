'use strict';

const { ENGINE_VERSION } = require('../version');

function evidence(engineCode, metrics, input) {
  return [{
    source: 'bonds_financial_engine',
    evidence_type: 'deterministic_computation',
    evidence_code: engineCode,
    value: metrics,
    confidence: 100,
    timestamp: new Date().toISOString(),
    metadata: {
      engine_version: ENGINE_VERSION,
      input_fields: Object.keys(input || {}).sort()
    }
  }];
}

function envelope(engineCode, metrics, input, diagnostics = {}, requiredInputs = []) {
  const missing = [...new Set(requiredInputs.filter(Boolean))];
  return {
    ok: missing.length === 0,
    executed: missing.length === 0,
    engine_code: engineCode,
    engine_version: ENGINE_VERSION,
    status: missing.length ? 'insufficient_inputs' : 'computed',
    metrics,
    diagnostics,
    required_inputs: missing,
    evidence: evidence(engineCode, metrics, input),
    provenance: {
      source: 'bonds_financial_engine',
      deterministic: true,
      ai_generated: false
    }
  };
}

module.exports = { evidence, envelope };
