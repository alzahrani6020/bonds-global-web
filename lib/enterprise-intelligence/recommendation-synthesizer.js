/**
 * BONDS Enterprise Intelligence — Recommendation Synthesizer
 *
 * Combines the outputs of all intelligence engines into a ranked list of
 * concrete, explainable actions.  Uses the existing Adaptive Recommendation
 * engine as a base and then enriches it with blind-spot mitigations and
 * engine-specific insights.
 */

const { generateRecommendations } = require('../../lib/recommendation/adaptive-recommendation.js');

class RecommendationSynthesizer {
  constructor(context = {}) {
    this.context = context;
  }

  synthesize() {
    const engineResults = this.context.engineResults || {};
    const blindSpots = engineResults.blind_spot?.output?.blindSpots || [];
    const language = this.context.language || 'ar';
    const isAr = language === 'ar';

    const base = this._baseRecommendations();
    const mitigations = blindSpots
      .filter(s => s.severity !== 'info')
      .map((s, i) => ({
        id: `mitigation_${i}`,
        title: isAr ? s.message : s.message,
        action: s.action,
        source: 'blind_spot_engine',
        baseConfidence: s.severity === 'critical' ? 90 : 70,
        confidence: s.severity === 'critical' ? 90 : 70,
        grade: s.severity === 'critical' ? 'A' : 'B',
        type: 'mitigation',
        valid: true
      }));

    const engineInsights = this._engineInsightActions(engineResults, isAr);

    const combined = [...base, ...mitigations, ...engineInsights];
    combined.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const top = combined[0] || null;
    return {
      output: {
        actions: combined,
        top,
        count: combined.length
      },
      confidence: top ? Math.round(top.confidence) : 50,
      evidence: combined.slice(0, 5).map((a, i) => ({
        source: a.source || 'synthesizer',
        evidence_type: 'recommendation',
        evidence_code: `action_${i}`,
        value: a.title,
        confidence: a.confidence || 50,
        reason: a.action,
        timestamp: new Date().toISOString()
      })),
      engine: 'recommendation_synthesizer',
      status: 'ok'
    };
  }

  _baseRecommendations() {
    try {
      const liveData = this._buildLiveData();
      const result = generateRecommendations({
        sector: this.context.sector,
        country: this.context.country,
        assetType: this.context.assetType || this.context.asset_class,
        decisionType: this.context.decisionType || this.context.intent,
        liveData,
        decisionProfile: this.context.decisionProfile,
        contextMemory: this.context.contextMemory,
        language: this.context.language || 'ar'
      });
      return (result.recommendations || []).map(r => ({
        ...r,
        source: r.source || 'adaptive_recommendation',
        type: 'recommendation'
      }));
    } catch (err) {
      return [];
    }
  }

  _engineInsightActions(engineResults, isAr) {
    const actions = [];
    const risk = engineResults.risk?.output;
    if (risk?.criticalRisks?.length) {
      const topRisk = risk.criticalRisks[0];
      actions.push({
        id: 'insight_risk',
        title: isAr ? `معالجة الخطر الحرج: ${topRisk.labelAr || topRisk.id}` : `Address critical risk: ${topRisk.labelEn || topRisk.id}`,
        action: (risk.mitigations && risk.mitigations[0]?.actionsAr?.[0]) || (isAr ? 'راجع افتراضات المخاطر' : 'Review risk assumptions'),
        source: 'risk_engine',
        baseConfidence: 78,
        confidence: 78,
        grade: 'B',
        type: 'insight',
        valid: true
      });
    }

    const graph = engineResults.decision_graph?.output;
    if (graph?.bottleneck) {
      actions.push({
        id: 'insight_bottleneck',
        title: isAr ? `تحسين نقطة الضعف: ${graph.bottleneck.node}` : `Improve bottleneck: ${graph.bottleneck.node}`,
        action: graph.nextAction,
        source: 'decision_graph_engine',
        baseConfidence: 72,
        confidence: 72,
        grade: 'B',
        type: 'insight',
        valid: true
      });
    }

    return actions;
  }

  _buildLiveData() {
    const ucp = this.context.ucpResult;
    return {
      valuation: ucp?.engineResults?.valuation?.value,
      riskGrade: ucp?.engineResults?.risk?.risk_grade,
      dscr: ucp?.engineResults?.financing?.dscr,
      npv: ucp?.engineResults?.feasibility?.npv,
      opportunityScore: this.context.opportunityScore,
      ...this.context.liveData
    };
  }
}

module.exports = { RecommendationSynthesizer };
