/**
 * Investment Intelligence Integration Adapter
 *
 * Enriches lifecycle context with readiness scores, memoranda, and AI reviews.
 */

class InvestmentIntelligenceAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ instance, context }) {
    if (!this.supabase || instance.entity_type !== 'project') return context;
    const entityId = instance.entity_id;

    try {
      const [{ data: readiness }, { data: memoranda }, { data: reviews }] = await Promise.all([
        this.supabase.from('investment_readiness_scores').select('*').eq('project_id', entityId).order('generated_at', { ascending: false }).limit(1),
        this.supabase.from('investment_memoranda').select('*').eq('project_id', entityId).order('created_at', { ascending: false }).limit(1),
        this.supabase.from('ai_investment_reviews').select('*').eq('project_id', entityId).order('reviewed_at', { ascending: false }).limit(1)
      ]);

      return {
        ...context,
        readiness: readiness && readiness[0] ? {
          readinessScore: readiness[0].readiness_score,
          grade: readiness[0].grade,
          missingItems: readiness[0].missing_items,
          strengths: readiness[0].strengths,
          weaknesses: readiness[0].weaknesses
        } : context.readiness,
        documents: {
          ...(context.documents || {}),
          investment_memorandum: memoranda && memoranda[0] ? { status: memoranda[0].status, id: memoranda[0].id } : undefined,
          ai_investment_review: reviews && reviews[0] ? { status: reviews[0].verdict, id: reviews[0].id } : undefined
        }
      };
    } catch (err) {
      console.warn('[InvestmentIntelligenceAdapter] enrich failed:', err.message);
      return context;
    }
  }
}

module.exports = { InvestmentIntelligenceAdapter };
