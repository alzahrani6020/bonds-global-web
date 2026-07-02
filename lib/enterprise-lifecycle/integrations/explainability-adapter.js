/**
 * Explainability Integration Adapter
 *
 * Produces human-readable rationale for a transition attempt.
 */

let ExplainabilityEngine;
try {
  ExplainabilityEngine = require('../../explainability/explainability-engine');
} catch (err) {
  // optional dependency
}

class ExplainabilityAdapter {
  explain({ fromStage, toStage, gateResult, language = 'ar' }) {
    if (!ExplainabilityEngine || !ExplainabilityEngine.explain) {
      return {
        summary: `Transition from ${fromStage} to ${toStage}`,
        why: gateResult.results.map(r => r.reason),
        confidence: gateResult.confidence
      };
    }
    try {
      return ExplainabilityEngine.explain(
        {
          recommendation: gateResult.passed ? 'proceed' : 'blocked',
          confidence: gateResult.confidence,
          evidence: gateResult.results
        },
        { language }
      );
    } catch (err) {
      return { summary: err.message, why: [], confidence: gateResult.confidence };
    }
  }
}

module.exports = { ExplainabilityAdapter };
