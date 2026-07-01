/**
 * BONDS Enterprise Intelligence — Blind Spot Engine
 *
 * Analyzes the complete set of engine results and raw inputs to detect
 * missing engines, low-confidence signals, contradictions, missing context,
 * and missing data sources.  Returns a list of blind spots with severity,
 * rationale, and suggested action.
 */

const SEVERITY_WEIGHT = {
  critical: 1.0,
  warning: 0.6,
  info: 0.2
};

const REQUIRED_INPUTS_BY_INTENT = {
  value_asset: ['asset_class', 'asset_value', 'country'],
  buy_asset: ['asset_class', 'country', 'city'],
  sell_asset: ['asset_class', 'asset_value', 'country'],
  revalue: ['asset_class', 'asset_value', 'country'],
  feasibility: ['sector', 'country', 'annual_revenue', 'operating_expenses'],
  investment: ['sector', 'country', 'annual_revenue', 'initial_investment'],
  expansion: ['sector', 'country', 'city', 'annual_revenue'],
  request_financing: ['sector', 'country', 'loan_amount', 'annual_revenue'],
  market_analysis: ['sector', 'country', 'city'],
  risk_analysis: ['asset_class', 'country'],
  compare_scenarios: ['sector', 'country', 'scenarios']
};

class BlindSpotEngine {
  constructor(context = {}) {
    this.context = context;
  }

  analyze() {
    const spots = [];
    const engineResults = this.context.engineResults || {};
    const inputs = this.context.inputs || this.context.values || {};
    const intent = this.context.intent;
    const fabric = this.context.fabric;

    spots.push(...this._missingEngines(intent, engineResults));
    spots.push(...this._lowConfidence(engineResults));
    spots.push(...this._contradictions(engineResults));
    spots.push(...this._missingInputs(intent, inputs));
    spots.push(...this._missingFabricSources(fabric, engineResults));

    const score = this._score(spots);
    return {
      output: {
        blindSpots: spots,
        count: spots.length,
        criticalCount: spots.filter(s => s.severity === 'critical').length,
        warningCount: spots.filter(s => s.severity === 'warning').length
      },
      confidence: Math.max(0, Math.min(100, Math.round(score))),
      evidence: spots.map(s => ({
        source: 'blind_spot_engine',
        evidence_type: 'insight',
        evidence_code: s.type,
        value: s.severity,
        confidence: s.severity === 'critical' ? 90 : s.severity === 'warning' ? 70 : 50,
        reason: s.message,
        timestamp: new Date().toISOString()
      })),
      engine: 'blind_spot',
      status: 'ok'
    };
  }

  _missingEngines(intent, engineResults) {
    const spots = [];
    if (!intent) {
      spots.push({
        type: 'missing_intent',
        severity: 'critical',
        message: 'No intent provided; cannot determine which engines should have run.',
        action: 'Provide an intent (e.g., feasibility, value_asset, risk_analysis).'
      });
      return spots;
    }

    const expected = REQUIRED_INPUTS_BY_INTENT[intent] ? [] : [];
    // Domain-specific expectations
    if (['feasibility', 'investment', 'expansion'].includes(intent) && !engineResults.feasibility) {
      spots.push({ type: 'missing_engine', severity: 'critical', message: 'Feasibility engine did not run.', action: 'Include feasibility in engines or use a feasibility intent.' });
    }
    if (['value_asset', 'buy_asset', 'sell_asset', 'revalue'].includes(intent) && !engineResults.valuation) {
      spots.push({ type: 'missing_engine', severity: 'critical', message: 'Valuation engine did not run.', action: 'Include valuation in engines or use an asset intent.' });
    }
    if (['request_financing'].includes(intent) && !engineResults.financing) {
      spots.push({ type: 'missing_engine', severity: 'critical', message: 'Financing engine did not run.', action: 'Include financing in engines.' });
    }
    if (['market_analysis', 'expansion'].includes(intent) && !engineResults.opportunity && !engineResults.market) {
      spots.push({ type: 'missing_engine', severity: 'warning', message: 'No market/opportunity engine result for a market/expansion decision.', action: 'Add market or opportunity engine.' });
    }
    if (!engineResults.risk) {
      spots.push({ type: 'missing_engine', severity: 'warning', message: 'Risk engine was not executed.', action: 'Add risk engine for a complete decision picture.' });
    }
    return spots;
  }

  _lowConfidence(engineResults) {
    const spots = [];
    for (const [engine, result] of Object.entries(engineResults)) {
      const conf = result?.confidence;
      if (conf === undefined || conf === null) continue;
      if (conf < 40) {
        spots.push({ type: 'low_confidence', severity: 'critical', message: `${engine} confidence is very low (${conf}).`, action: 'Add more inputs or use a higher-trust data source.' });
      } else if (conf < 60) {
        spots.push({ type: 'low_confidence', severity: 'warning', message: `${engine} confidence is below average (${conf}).`, action: 'Review inputs and override low-quality data.' });
      }
    }
    return spots;
  }

  _contradictions(engineResults) {
    const spots = [];
    const val = engineResults.valuation?.output?.value ?? engineResults.valuation?.value;
    const riskGrade = engineResults.risk?.output?.riskGrade ?? engineResults.risk?.risk_grade;
    const feasibility = engineResults.feasibility?.output ?? engineResults.feasibility;
    const market = engineResults.market?.output ?? engineResults.market;

    if (val > 0 && ['D', 'E'].includes(riskGrade)) {
      spots.push({ type: 'contradiction', severity: 'critical', message: `High asset value (${val}) but severe risk grade (${riskGrade}).`, action: 'Re-check risk assumptions before relying on valuation.' });
    }
    if (feasibility?.npv > 0 && ['D', 'E'].includes(riskGrade)) {
      spots.push({ type: 'contradiction', severity: 'warning', message: 'Positive NPV with severe risk grade.', action: 'Stress-test the downside scenario.' });
    }
    if (market?.demand_index < 40 && (engineResults.opportunity?.output?.score ?? engineResults.opportunity?.score) > 70) {
      spots.push({ type: 'contradiction', severity: 'warning', message: 'Low market demand index but high opportunity score.', action: 'Reconcile market data with opportunity model inputs.' });
    }
    return spots;
  }

  _missingInputs(intent, inputs) {
    const spots = [];
    if (!intent) return spots;
    const required = REQUIRED_INPUTS_BY_INTENT[intent] || [];
    for (const field of required) {
      if (inputs[field] === undefined || inputs[field] === null || inputs[field] === '') {
        spots.push({ type: 'missing_input', severity: 'warning', message: `Required input "${field}" is missing for intent "${intent}".`, action: `Provide ${field} in the request values.` });
      }
    }
    return spots;
  }

  _missingFabricSources(fabric, engineResults) {
    const spots = [];
    const autoPop = this.context.autoPopulate;
    if (autoPop && Array.isArray(autoPop.populated)) {
      const lowSource = autoPop.populated.filter(p => (p.confidence || 0) < 50 && p.source !== 'manual');
      for (const p of lowSource) {
        spots.push({ type: 'fabric_source_weak', severity: 'info', message: `Low-confidence auto-populated value for "${p.field}" (${p.confidence}).`, action: 'Confirm or override via a manual source.' });
      }
    }
    if (!fabric) {
      spots.push({ type: 'fabric_unavailable', severity: 'info', message: 'Trusted Data Fabric was not provided.', action: 'Enable fabric for fully trusted inputs.' });
    }
    return spots;
  }

  _score(spots) {
    if (spots.length === 0) return 95;
    const penalty = spots.reduce((sum, s) => sum + (SEVERITY_WEIGHT[s.severity] || 0.2) * 25, 0);
    return Math.max(5, 100 - penalty);
  }
}

module.exports = { BlindSpotEngine };
