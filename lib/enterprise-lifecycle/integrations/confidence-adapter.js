/**
 * Confidence Engine Integration Adapter
 *
 * Aggregates confidence scores across context sources.
 */

let ConfidenceEngine;
try {
  ConfidenceEngine = require('../../confidence/confidence-engine');
} catch (err) {
  // optional dependency
}

class ConfidenceAdapter {
  async enrich({ context }) {
    if (!ConfidenceEngine) return context;
    try {
      const inputs = [];
      if (context.ucp && context.ucp.confidence !== undefined) {
        inputs.push({ name: 'ucp', score: context.ucp.confidence, weight: 0.35 });
      }
      if (context.readiness && context.readiness.readinessScore !== undefined) {
        inputs.push({ name: 'readiness', score: context.readiness.readinessScore, weight: 0.25 });
      }
      if (context.fabric && context.fabric.completeness !== undefined) {
        inputs.push({ name: 'fabric', score: context.fabric.completeness * 100, weight: 0.2 });
      }
      if (context.valuation && context.valuation.confidence !== undefined) {
        inputs.push({ name: 'valuation', score: context.valuation.confidence, weight: 0.2 });
      }
      if (!inputs.length) return context;
      const aggregate = ConfidenceEngine.combineConfidence(
        inputs.map(i => i.score),
        inputs.map(i => i.weight)
      );
      return { ...context, aggregateConfidence: aggregate };
    } catch (err) {
      console.warn('[ConfidenceAdapter] enrich failed:', err.message);
      return context;
    }
  }
}

module.exports = { ConfidenceAdapter };
