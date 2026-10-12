'use strict';

class DecisionMemoryEngine {
  constructor({ supabase = null } = {}) {
    this.supabase = supabase;
  }

  async recordDecision(record = {}) {
    const payload = {
      entity_id: record.entityId || record.projectId || null,
      entity_type: record.entityType || 'project',
      decision_type: record.decisionType || 'investment_decision',
      decision: record.decision,
      inputs: record.inputs || {},
      expected_outcome: record.expectedOutcome || {},
      confidence: record.confidence ?? null,
      created_by: record.userId || null,
      created_at: record.createdAt || new Date().toISOString()
    };

    if (!this.supabase) {
      return { status: 'not_persisted', executed: false, reason: 'supabase_not_available', record: payload };
    }

    const { data, error } = await this.supabase
      .from('decision_memory')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { status: 'persistence_failed', executed: true, error: error.message, record: payload };
    }

    return { status: 'persisted', executed: true, record: data };
  }

  async loadDecision(decisionId) {
    if (!this.supabase || !decisionId) return null;
    const { data, error } = await this.supabase
      .from('decision_memory')
      .select('*')
      .eq('id', decisionId)
      .single();
    if (error) return null;
    return data;
  }

  async recordOutcome({ decisionId, actualOutcome = {}, userId = null, notes = null } = {}) {
    if (!decisionId) {
      return { status: 'invalid_request', executed: false, error: 'decisionId is required' };
    }
    if (!this.supabase) {
      return { status: 'not_persisted', executed: false, reason: 'supabase_not_available' };
    }

    const decision = await this.loadDecision(decisionId);
    if (!decision) {
      return { status: 'decision_not_found', executed: false };
    }

    const comparison = this.compareOutcome(decision, actualOutcome);
    const { data, error } = await this.supabase
      .from('decision_outcomes')
      .insert({
        decision_id: decisionId,
        actual_outcome: actualOutcome,
        variance: comparison,
        status: comparison.calibrated ? 'compared' : 'recorded',
        notes,
        recorded_by: userId
      })
      .select()
      .single();

    if (error) {
      return { status: 'persistence_failed', executed: true, error: error.message, comparison };
    }

    return {
      status: 'persisted',
      executed: true,
      outcome: data,
      comparison
    };
  }

  compareOutcome(decisionRecord = {}, actual = {}) {
    const expected = decisionRecord.expectedOutcome || decisionRecord.expected_outcome || {};
    const metrics = {};
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

    for (const key of keys) {
      const e = Number(expected[key]);
      const a = Number(actual[key]);
      if (!Number.isFinite(e) || !Number.isFinite(a)) continue;
      const absoluteError = a - e;
      const percentageError = e === 0 ? null : absoluteError / Math.abs(e);
      metrics[key] = { expected: e, actual: a, absoluteError, percentageError };
    }

    const percentageErrors = Object.values(metrics)
      .map(item => item.percentageError)
      .filter(value => value !== null)
      .map(Math.abs);

    const meanAbsolutePercentageError = percentageErrors.length
      ? percentageErrors.reduce((sum, value) => sum + value, 0) / percentageErrors.length
      : null;

    return {
      metrics,
      meanAbsolutePercentageError,
      calibrated: Object.keys(metrics).length > 0
    };
  }
}

module.exports = { DecisionMemoryEngine };
