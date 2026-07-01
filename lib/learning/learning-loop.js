/**
 * BONDS Learning Loop
 *
 * Records user reactions to recommendations and reports, then computes
 * preference weights without modifying core formulas.
 */

class LearningLoop {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async record(event) {
    const row = {
      user_id: event.userId,
      project_id: event.projectId,
      event_type: event.eventType,
      report_id: event.reportId || null,
      recommendation_id: event.recommendationId || null,
      action: event.action,
      delta: event.delta || null,
      feedback: event.feedback || null,
      confidence_before: event.confidenceBefore,
      confidence_after: event.confidenceAfter,
      metadata: event.metadata || {}
    };
    if (!this.supabase) return { id: 'local-' + Date.now(), ...row };
    const { data, error } = await this.supabase
      .from('bonds_learning_events')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new Error(`Learning event record failed: ${error.message}`);
    return data;
  }

  async getUserFeedback(userId, { limit = 100 } = {}) {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('bonds_learning_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Learning fetch failed: ${error.message}`);
    return data || [];
  }

  computePreferenceWeights(events) {
    const weights = {};
    for (const event of events) {
      const key = event.event_type;
      if (!weights[key]) weights[key] = { accepted: 0, rejected: 0, modified: 0, total: 0 };
      weights[key].total += 1;
      if (event.action === 'accepted') weights[key].accepted += 1;
      if (event.action === 'rejected') weights[key].rejected += 1;
      if (event.action === 'modified') weights[key].modified += 1;
    }
    const result = {};
    for (const key of Object.keys(weights)) {
      const w = weights[key];
      result[key] = {
        acceptanceRate: w.total ? w.accepted / w.total : 0,
        rejectionRate: w.total ? w.rejected / w.total : 0,
        modificationRate: w.total ? w.modified / w.total : 0,
        score: w.total ? (w.accepted + w.modified * 0.5 - w.rejected) / w.total : 0
      };
    }
    return result;
  }
}

module.exports = { LearningLoop };
