/**
 * BONDS Data Provenance Layer
 *
 * Answers: where did I come from, who imported me, who changed me, why, when,
 * with what evidence and confidence, and what were my previous versions?
 */

class Provenance {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Build a provenance record without persisting it.
   */
  static build({
    entityType,
    entityId,
    field,
    value,
    sourceId,
    runId,
    connectorCode,
    collectedAt,
    confidence,
    evidence,
    previousProvenanceId,
    createdBy,
    reason
  }) {
    return {
      entityType,
      entityId,
      field,
      value: value === undefined ? null : value,
      sourceId,
      runId,
      connectorCode,
      collectedAt: collectedAt || new Date().toISOString(),
      confidence,
      evidence: { ...(evidence || {}), ...(reason ? { reason } : {}) },
      previousProvenanceId,
      createdBy,
      reason,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Persist a provenance record to Supabase.
   */
  async persist(record) {
    if (!this.supabase) return { persisted: false, record };
    const { data, error } = await this.supabase
      .from('fabric_provenance')
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return { persisted: true, record: data };
  }

  /**
   * Retrieve provenance chain for an entity/field.
   */
  async getChain(entityType, entityId, field) {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('fabric_provenance')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('field', field)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  /**
   * Create a provenance record for a manual override.
   */
  static buildOverride({ entityType, entityId, field, oldValue, newValue, sourceId, createdBy, reason, confidence = 95 }) {
    return Provenance.build({
      entityType,
      entityId,
      field,
      value: newValue,
      sourceId,
      connectorCode: 'manual_override',
      collectedAt: new Date().toISOString(),
      confidence,
      evidence: { oldValue, reason, override: true },
      createdBy,
      reason
    });
  }
}

module.exports = { Provenance };
