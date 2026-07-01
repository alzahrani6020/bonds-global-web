/**
 * BONDS Manual Override Connector
 *
 * Reads manual overrides from data_overrides as a first-class trusted source.
 */

const BaseConnector = require('../connector');

class ManualConnector extends BaseConnector {
  constructor(options = {}) {
    super({
      sourceCode: options.sourceCode || 'manual',
      sourceName: options.sourceName || 'Manual Override',
      category: 'manual',
      supportedOperations: ['override'],
      authType: 'user',
      ...options
    });
    this.supabase = options.supabase || null;
  }

  async healthCheck() {
    return { healthy: true, latencyMs: 0, message: 'manual source always available' };
  }

  async fetch(request = {}) {
    if (!this.supabase) return [];
    const { entityType, entityId, field } = request;
    let query = this.supabase.from('data_overrides').select('*');
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);
    if (field) query = query.eq('field', field);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  }

  async normalize(raw) {
    if (!Array.isArray(raw)) raw = [raw];
    return raw.map(row => ({
      metricCode: row.field,
      value: row.override_value,
      entityType: row.entity_type,
      entityId: row.entity_id,
      sourceId: row.source_id || this.sourceCode,
      sourceCode: this.sourceCode,
      confidence: 95,
      isOverride: true,
      collectedAt: row.created_at,
      evidence: {
        original_value: row.original_value,
        reason: row.reason,
        overridden_by: row.overridden_by
      }
    }));
  }

  async validate(normalized) {
    const errors = [];
    if (normalized.value === null || normalized.value === undefined) errors.push('missing override value');
    if (!normalized.entityType || !normalized.entityId) errors.push('override requires entity context');
    return { valid: errors.length === 0, errors };
  }
}

module.exports = { ManualConnector };
