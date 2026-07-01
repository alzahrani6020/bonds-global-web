/**
 * BONDS Investment Intelligence — AI Investment Review Engine
 *
 * Reviews a generated investment document before approval.
 * Delegates to the AI Orchestrator and returns a structured verdict.
 */

const { analyze } = require('../ai/orchestrator');

class AiInvestmentReviewEngine {
  constructor(memorandum, options = {}) {
    this.memorandum = memorandum;
    this.options = options;
  }

  async review() {
    const payload = {
      type: this.memorandum.type || 'investment_memorandum',
      language: this.memorandum.language || 'ar',
      sections: Object.keys(this.memorandum.content?.sections || {}),
      executiveSummary: this.memorandum.content?.sections?.executiveSummary?.text,
      financialHighlights: this.memorandum.content?.sections?.financialHighlights,
      riskAnalysis: this.memorandum.content?.sections?.riskAnalysis,
      valuation: this.memorandum.content?.sections?.valuation,
      fundingRequirements: this.memorandum.content?.sections?.fundingRequirements,
      confidence: this.memorandum.confidence_score,
      missingData: this.memorandum.content?.missingItems || []
    };

    let result;
    try {
      const aiResult = await analyze({
        userId: this.options.userId,
        projectId: this.memorandum.project_id,
        type: 'investment_review',
        payload,
        model: this.options.model
      });
      result = aiResult.result;
    } catch (err) {
      console.warn('[ai-investment-review] AI review failed, using fallback:', err.message);
      result = this._fallbackReview(payload);
    }

    return {
      output: {
        verdict: result.verdict || 'needs_revision',
        convincing: result.convincing ?? null,
        hasConflicts: result.has_conflicts ?? false,
        hasGaps: result.has_gaps ?? false,
        hasExaggeration: result.has_exaggeration ?? false,
        numbersReasonable: result.numbers_reasonable ?? true,
        risksMentioned: result.risks_mentioned ?? false,
        languageAppropriate: result.language_appropriate ?? true,
        issues: result.issues || [],
        suggestions: result.suggestions || []
      },
      confidence: result.confidence || 60,
      evidence: [
        { source: 'ai_orchestrator', evidence_type: 'review', evidence_code: 'ai_review', value: result.verdict, confidence: result.confidence || 60, reason: 'AI review of investment document' }
      ],
      engine: 'ai_investment_review',
      status: 'ok'
    };
  }

  _fallbackReview(payload) {
    const issues = [];
    if (!payload.risksMentioned || !payload.riskAnalysis) issues.push('Risk analysis is missing or incomplete.');
    if (!payload.valuation) issues.push('Valuation section is missing.');
    if (!payload.financialHighlights) issues.push('Financial highlights are missing.');
    if ((payload.confidence || 0) < 60) issues.push('Overall confidence is below 60%.');

    return {
      verdict: issues.length ? 'needs_revision' : 'approved',
      convincing: issues.length === 0,
      has_conflicts: false,
      has_gaps: issues.length > 0,
      has_exaggeration: false,
      numbers_reasonable: true,
      risks_mentioned: !!payload.riskAnalysis,
      language_appropriate: true,
      issues,
      suggestions: issues.map(i => `Address: ${i}`),
      confidence: issues.length ? 50 : 80
    };
  }
}

module.exports = { AiInvestmentReviewEngine };
