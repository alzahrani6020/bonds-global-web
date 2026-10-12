'use strict';

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class CalibrationEngine {
  constructor({ supabase = null } = {}) {
    this.supabase = supabase;
  }

  summarizeComparisons(comparisons = []) {
    const byMetric = new Map();

    for (const comparison of comparisons) {
      const metrics = comparison?.metrics || comparison?.variance?.metrics || {};
      for (const [metric, item] of Object.entries(metrics)) {
        const expected = finite(item.expected);
        const actual = finite(item.actual);
        if (expected === null || actual === null) continue;

        if (!byMetric.has(metric)) byMetric.set(metric, []);
        const absoluteError = actual - expected;
        const percentageError = expected === 0 ? null : absoluteError / Math.abs(expected);
        byMetric.get(metric).push({ expected, actual, absoluteError, percentageError });
      }
    }

    const metrics = {};
    for (const [metric, rows] of byMetric.entries()) {
      const pct = rows.map(r => r.percentageError).filter(v => v !== null);
      const signedBias = pct.length
        ? pct.reduce((sum, value) => sum + value, 0) / pct.length
        : null;
      const mape = pct.length
        ? pct.reduce((sum, value) => sum + Math.abs(value), 0) / pct.length
        : null;
      const meanAbsoluteError = rows.length
        ? rows.reduce((sum, row) => sum + Math.abs(row.absoluteError), 0) / rows.length
        : null;

      metrics[metric] = {
        observations: rows.length,
        signedBias,
        meanAbsolutePercentageError: mape,
        meanAbsoluteError,
        suggestedCorrectionFactor: signedBias === null
          ? 1
          : Math.max(0.5, Math.min(2, 1 + signedBias))
      };
    }

    const allMapes = Object.values(metrics)
      .map(item => item.meanAbsolutePercentageError)
      .filter(value => value !== null);

    const overallMape = allMapes.length
      ? allMapes.reduce((sum, value) => sum + value, 0) / allMapes.length
      : null;

    return {
      metrics,
      overallMape,
      observations: comparisons.length,
      calibratedMetrics: Object.keys(metrics).length
    };
  }

  async analyze({ entityId = null, decisionType = null, limit = 500 } = {}) {
    if (!this.supabase) {
      return {
        output: null,
        confidence: 0,
        evidence: [],
        engine: 'calibration',
        status: 'not_executed',
        executed: false,
        decisionEligible: true,
        reason: 'supabase_not_available'
      };
    }

    let query = this.supabase
      .from('decision_outcomes')
      .select('variance, decision:decision_id(entity_id, decision_type)')
      .order('recorded_at', { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 500, 5000)));

    const { data, error } = await query;
    if (error) {
      return {
        output: null,
        confidence: 0,
        evidence: [],
        engine: 'calibration',
        status: 'not_executed',
        executed: false,
        decisionEligible: true,
        reason: error.message
      };
    }

    const rows = (data || []).filter(row => {
      const decision = row.decision || {};
      if (entityId && decision.entity_id !== entityId) return false;
      if (decisionType && decision.decision_type !== decisionType) return false;
      return true;
    });

    const summary = this.summarizeComparisons(rows.map(row => row.variance || {}));
    const confidence = Math.min(95, Math.round(Math.log10(summary.observations + 1) * 35));

    return {
      output: summary,
      confidence,
      evidence: [{
        source: 'decision_outcomes',
        evidence_type: 'calibration',
        evidence_code: 'outcome_calibration_summary',
        value: {
          observations: summary.observations,
          calibratedMetrics: summary.calibratedMetrics,
          overallMape: summary.overallMape
        },
        confidence,
        timestamp: new Date().toISOString()
      }],
      engine: 'calibration',
      status: summary.observations ? 'computed' : 'insufficient_history',
      executed: summary.observations > 0,
      decisionEligible: true
    };
  }
}

module.exports = { CalibrationEngine };
