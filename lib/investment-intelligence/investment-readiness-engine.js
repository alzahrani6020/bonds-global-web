/**
 * BONDS Investment Intelligence — Investment Readiness Engine
 *
 * Scores how ready a project is for investment without re-computing anything.
 * It checks data completeness, UCP confidence, risk grade, and financial
 * attractiveness, then returns a score, strengths, weaknesses, missing items,
 * and an action plan.
 */

const REQUIRED_FIELDS = {
  project: ['name', 'sector', 'capital', 'revenue'],
  asset: ['asset_class', 'market_value'],
  valuation: ['value', 'confidence_score'],
  financing: ['amount', 'dscr'],
  ucp: ['outputs', 'scenarios']
};

const FIELD_WEIGHTS = {
  project: 20,
  asset: 15,
  valuation: 15,
  financing: 15,
  ucp: 35
};

class InvestmentReadinessEngine {
  constructor(context) {
    this.context = context;
  }

  evaluate() {
    const { project, asset, valuation, financing, ucpResult, city } = this.context;
    const strengths = [];
    const weaknesses = [];
    const missing = [];
    let totalScore = 0;
    let totalWeight = 0;

    const projectScore = this._scoreGroup('project', project, missing, strengths, weaknesses);
    totalScore += projectScore * FIELD_WEIGHTS.project;
    totalWeight += FIELD_WEIGHTS.project;

    const assetScore = this._scoreGroup('asset', asset, missing, strengths, weaknesses);
    totalScore += assetScore * FIELD_WEIGHTS.asset;
    totalWeight += FIELD_WEIGHTS.asset;

    const valuationScore = this._scoreGroup('valuation', valuation, missing, strengths, weaknesses);
    totalScore += valuationScore * FIELD_WEIGHTS.valuation;
    totalWeight += FIELD_WEIGHTS.valuation;

    const financingScore = this._scoreGroup('financing', financing, missing, strengths, weaknesses);
    totalScore += financingScore * FIELD_WEIGHTS.financing;
    totalWeight += FIELD_WEIGHTS.financing;

    const ucpScore = this._scoreUcp(ucpResult, missing, strengths, weaknesses);
    totalScore += ucpScore * FIELD_WEIGHTS.ucp;
    totalWeight += FIELD_WEIGHTS.ucp;

    if (city?.population && city.purchasing_power_index) {
      strengths.push('City market data is available');
    } else {
      missing.push('City/demographic data');
      weaknesses.push('Limited city-level market context');
    }

    const readinessScore = totalWeight ? Math.round(totalScore / totalWeight) : 0;
    const actionPlan = this._buildActionPlan(readinessScore, missing, weaknesses);

    return {
      output: {
        readinessScore,
        grade: this._grade(readinessScore),
        strengths,
        weaknesses,
        missingItems: missing,
        actionPlan
      },
      confidence: Math.round(readinessScore),
      evidence: this._buildEvidence(missing, strengths, ucpResult),
      engine: 'investment_readiness',
      status: 'ok'
    };
  }

  _scoreGroup(groupName, data, missing, strengths, weaknesses) {
    const required = REQUIRED_FIELDS[groupName] || [];
    if (!data) {
      missing.push(`${groupName} record`);
      weaknesses.push(`No ${groupName} data available`);
      return 0;
    }
    let present = 0;
    for (const field of required) {
      if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
        present++;
      } else {
        missing.push(`${groupName}.${field}`);
      }
    }
    const score = required.length ? (present / required.length) * 100 : 100;
    if (score >= 80) strengths.push(`${groupName} data is complete`);
    else weaknesses.push(`${groupName} data is incomplete`);
    return score;
  }

  _scoreUcp(ucpResult, missing, strengths, weaknesses) {
    if (!ucpResult) {
      missing.push('UCP calculation result');
      weaknesses.push('UCP calculation could not be run');
      return 0;
    }
    const confidence = Math.round((ucpResult.confidence || 0) * 100);
    const outputs = ucpResult.outputs || {};
    const hasMetrics = Object.keys(outputs).length > 0;
    if (hasMetrics) strengths.push('UCP financial metrics are available');
    else missing.push('UCP financial metrics');

    const risk = ucpResult.engineResults?.risk;
    if (risk?.risk_grade) {
      if (['A', 'B'].includes(risk.risk_grade)) strengths.push(`Favorable risk grade (${risk.risk_grade})`);
      else if (['D', 'E'].includes(risk.risk_grade)) weaknesses.push(`High risk grade (${risk.risk_grade})`);
    }

    return confidence;
  }

  _buildActionPlan(score, missing, weaknesses) {
    const actions = [];
    if (score < 50) {
      actions.push('Complete missing project and financial data before approaching investors.');
      actions.push('Run a full UCP-backed feasibility study.');
    } else if (score < 75) {
      actions.push('Add missing data fields to improve confidence.');
      actions.push('Review risk drivers and prepare mitigations.');
    } else {
      actions.push('Proceed with investment document generation.');
      actions.push('Prepare data room and investor target list.');
    }
    if (missing.includes('UCP calculation result')) actions.push('Fix UCP inputs or sector mapping.');
    if (weaknesses.some(w => w.includes('risk grade'))) actions.push('Add risk mitigation evidence.');
    return actions;
  }

  _grade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 50) return 'D';
    return 'E';
  }

  _buildEvidence(missing, strengths, ucpResult) {
    const evidence = [];
    for (const item of missing) {
      evidence.push({ source: 'readiness_engine', evidence_type: 'missing', evidence_code: item, value: item, confidence: 30, reason: 'Required data missing' });
    }
    for (const item of strengths) {
      evidence.push({ source: 'readiness_engine', evidence_type: 'strength', evidence_code: 'strength', value: item, confidence: 70, reason: item });
    }
    if (ucpResult) {
      evidence.push({ source: 'ucp', evidence_type: 'calculation', evidence_code: 'ucp_confidence', value: ucpResult.confidence, confidence: Math.round((ucpResult.confidence || 0) * 100), reason: 'UCP confidence' });
    }
    return evidence;
  }
}

module.exports = { InvestmentReadinessEngine };
