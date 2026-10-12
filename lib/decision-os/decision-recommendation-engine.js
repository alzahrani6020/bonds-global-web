'use strict';

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class DecisionRecommendationEngine {
  decide(context = {}) {
    const simulation = context.simulation?.output || null;
    const feasibility = context.engineResults?.feasibility || {};
    const financing = context.engineResults?.financing || {};
    const risk = context.engineResults?.risk || {};
    const market = context.engineResults?.live_market || context.engineResults?.market || {};
    const integrity = context.decisionIntegrity || {};

    const npv = number(feasibility.npv ?? feasibility.output?.npv ?? simulation?.expectedNpv);
    const irr = number(feasibility.irr ?? feasibility.output?.irr);
    const dscr = number(financing.dscr ?? financing.output?.dscr);
    const riskGrade = risk.risk_grade ?? risk.output?.riskGrade ?? risk.output?.risk_grade ?? null;
    const probabilityPositiveNpv = number(simulation?.probabilityPositiveNpv);
    const marketConfidence = number(market.confidence ?? market.output?.confidence);
    const confidence = number(context.confidence) ?? 0;

    const reasons = [];
    const risks = [];
    const conditions = [];
    const alternatives = [];

    if (npv !== null) {
      if (npv > 0) reasons.push('positive_npv');
      else risks.push('non_positive_npv');
    }
    if (irr !== null) {
      if (irr >= 0.18) reasons.push('irr_above_18_percent');
      else if (irr < 0.10) risks.push('low_irr');
    }
    if (dscr !== null) {
      if (dscr >= 1.25) reasons.push('healthy_dscr');
      else {
        risks.push('weak_debt_service_coverage');
        conditions.push({ metric: 'dscr', operator: '>=', value: 1.25 });
      }
    }
    if (['D', 'E'].includes(riskGrade)) {
      risks.push('high_risk_grade');
      alternatives.push('RESTRUCTURE');
    }
    if (probabilityPositiveNpv !== null) {
      if (probabilityPositiveNpv >= 0.70) reasons.push('high_probability_positive_npv');
      if (probabilityPositiveNpv < 0.50) {
        risks.push('low_probability_positive_npv');
        conditions.push({ metric: 'probabilityPositiveNpv', operator: '>=', value: 0.60 });
      }
    }

    let primary = 'WAIT';
    let decisionStatus = 'indicative';

    if (integrity.status === 'blocked') {
      primary = 'WAIT';
      decisionStatus = 'blocked';
      risks.push('decision_integrity_blocked');
    } else if (
      probabilityPositiveNpv !== null &&
      probabilityPositiveNpv >= 0.70 &&
      (npv === null || npv > 0) &&
      !['D', 'E'].includes(riskGrade) &&
      (dscr === null || dscr >= 1.25)
    ) {
      primary = 'INVEST';
      decisionStatus = integrity.status === 'decision_ready' ? 'decision_ready' : 'supported';
      alternatives.push('INVEST_WITH_CONDITIONS', 'WAIT');
    } else if (
      (npv !== null && npv > 0) ||
      (probabilityPositiveNpv !== null && probabilityPositiveNpv >= 0.50)
    ) {
      primary = 'INVEST_WITH_CONDITIONS';
      decisionStatus = 'supported';
      alternatives.push('WAIT', 'PARTNER');
      if (dscr === null) conditions.push({ metric: 'dscr', operator: '>=', value: 1.25 });
      if (probabilityPositiveNpv === null) conditions.push({ metric: 'simulation', operator: 'required', value: true });
    } else if (npv !== null && npv < 0) {
      primary = 'DO_NOT_INVEST';
      decisionStatus = 'supported';
      alternatives.push('RESTRUCTURE', 'WAIT');
    }

    if (marketConfidence !== null && marketConfidence < 45) {
      conditions.push({ metric: 'market_evidence_reliability', operator: '>=', value: 45 });
      if (primary === 'INVEST') primary = 'INVEST_WITH_CONDITIONS';
    }

    const scoreParts = [];
    if (npv !== null) scoreParts.push(npv > 0 ? 80 : 20);
    if (probabilityPositiveNpv !== null) scoreParts.push(probabilityPositiveNpv * 100);
    if (dscr !== null) scoreParts.push(Math.min(100, Math.max(0, dscr / 1.5 * 100)));
    if (confidence) scoreParts.push(confidence);
    const decisionScore = scoreParts.length
      ? Math.round(scoreParts.reduce((a, b) => a + b, 0) / scoreParts.length * 10) / 10
      : 0;

    return {
      output: {
        primary,
        decisionScore,
        decisionStatus,
        reasons: [...new Set(reasons)],
        risks: [...new Set(risks)],
        conditions,
        alternatives: [...new Set(alternatives)],
        triggerMetrics: { npv, irr, dscr, riskGrade, probabilityPositiveNpv, marketConfidence }
      },
      confidence,
      evidence: [{
        source: 'decision_recommendation_engine',
        evidence_type: 'decision',
        evidence_code: 'primary_decision',
        value: primary,
        confidence,
        timestamp: new Date().toISOString(),
        metadata: { decisionScore, decisionStatus, reasons, risks, conditions }
      }],
      engine: 'decision_recommendation',
      status: decisionStatus,
      executed: true,
      decisionEligible: decisionStatus !== 'blocked'
    };
  }
}

module.exports = { DecisionRecommendationEngine };
