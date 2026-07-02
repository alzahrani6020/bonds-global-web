/**
 * Decision Memory Integration Adapter
 *
 * Records lifecycle decisions into the decision memory store when available.
 */

class DecisionMemoryAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async record({ instance, transition, gateResult, userId }) {
    if (!this.supabase) return null;
    try {
      const { data, error } = await this.supabase.from('decision_memory').insert({
        entity_id: instance.entity_id,
        entity_type: instance.entity_type,
        decision_type: 'lifecycle_transition',
        decision: `${transition.from_stage} -> ${transition.to_stage}`,
        inputs: { gate_result: gateResult.results },
        expected_outcome: { stage: transition.to_stage },
        confidence: gateResult.confidence,
        created_by: userId,
        created_at: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[DecisionMemoryAdapter] record failed:', err.message);
      return null;
    }
  }
}

module.exports = { DecisionMemoryAdapter };
