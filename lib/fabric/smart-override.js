/**
 * BONDS Smart Override
 *
 * Stores original and new value, explains the difference, recalculates impact,
 * updates reports/certificates, and creates full audit trail.
 */

const { Provenance } = require('./provenance');

class SmartOverride {
  constructor(options = {}) {
    this.supabase = options.supabase || null;
    this.provenance = options.provenance || new Provenance(this.supabase);
    this.impactEngine = options.impactEngine || null;
  }

  /**
   * Apply a manual override.
   */
  async apply({ entityType, entityId, field, originalValue, newValue, reason, overriddenBy, sourceId }) {
    if (!this.supabase) {
      throw new Error('SmartOverride requires Supabase');
    }

    const { data: override, error } = await this.supabase
      .from('data_overrides')
      .insert({
        source_id: sourceId || null,
        entity_type: entityType,
        entity_id: entityId,
        field,
        original_value: originalValue === undefined ? null : originalValue,
        override_value: newValue,
        reason,
        overridden_by: overriddenBy
      })
      .select()
      .single();

    if (error) throw error;

    const provenanceRecord = Provenance.buildOverride({
      entityType,
      entityId,
      field,
      oldValue: originalValue,
      newValue,
      sourceId: sourceId || null,
      createdBy: overriddenBy,
      reason,
      confidence: 95
    });

    await this.provenance.persist(provenanceRecord);

    const impact = this.impactEngine
      ? await this.impactEngine.analyze({ entityType, entityId, field, oldValue: originalValue, newValue })
      : null;

    return {
      override,
      provenance: provenanceRecord,
      impact,
      explanation: {
        summary: `Field ${field} overridden by user.`,
        diff: this._diff(originalValue, newValue),
        reason
      }
    };
  }

  /**
   * List overrides for an entity/field.
   */
  async list({ entityType, entityId, field }) {
    if (!this.supabase) return [];
    let query = this.supabase.from('data_overrides').select('*');
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    if (field) query = query.eq('field', field);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  _diff(oldValue, newValue) {
    const oldStr = JSON.stringify(oldValue);
    const newStr = JSON.stringify(newValue);
    const oldNum = Number(oldValue);
    const newNum = Number(newValue);
    if (!isNaN(oldNum) && !isNaN(newNum) && oldNum !== 0) {
      const change = ((newNum - oldNum) / Math.abs(oldNum)) * 100;
      return { oldValue, newValue, changePercent: Math.round(change * 100) / 100 };
    }
    return { oldValue, newValue, changed: oldStr !== newStr };
  }
}

module.exports = { SmartOverride };
