/**
 * BONDS Decision Impact Engine
 *
 * Whenever data changes, detect affected assets, projects, reports, certificates,
 * financing, and scenarios; trigger selective recalculation.
 */

class DecisionImpactEngine {
  constructor(options = {}) {
    this.supabase = options.supabase || null;
    this.entityMappings = options.entityMappings || {};
  }

  /**
   * Analyze impact of a data change.
   * Returns impacted entities and queues selective recalculation.
   */
  async analyze({ entityType, entityId, field, oldValue, newValue }) {
    const impacted = {
      assets: await this._findImpacted('assets', entityType, entityId, field),
      projects: await this._findImpacted('projects', entityType, entityId, field),
      reports: await this._findImpacted('reports', entityType, entityId, field),
      certificates: await this._findImpacted('certificates', entityType, entityId, field),
      financing: await this._findImpacted('financing', entityType, entityId, field),
      scenarios: await this._findImpacted('scenarios', entityType, entityId, field)
    };

    const record = {
      event_type: 'data_change',
      entity_type: entityType,
      entity_id: entityId,
      field,
      old_value: oldValue === undefined ? null : oldValue,
      new_value: newValue,
      impacted_assets: impacted.assets,
      impacted_projects: impacted.projects,
      impacted_reports: impacted.reports,
      impacted_certificates: impacted.certificates,
      impacted_financing: impacted.financing,
      impacted_scenarios: impacted.scenarios,
      recalculation_status: 'pending',
      details: { diff: this._diff(oldValue, newValue) }
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('fabric_decision_impacts')
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return { ...impacted, impactId: data.id, record: data };
    }

    return { ...impacted, impactId: null, record };
  }

  async _findImpacted(type, entityType, entityId, field) {
    if (!this.supabase) return [];
    // Simplified: search tables that store a reference to the changed entity/field.
    // Production would use a dependency graph or materialized views.
    const tableMap = {
      assets: 'bonds_assets',
      projects: 'bonds_projects',
      reports: 'bonds_reports',
      certificates: 'bonds_certificates',
      financing: 'bonds_financing',
      scenarios: 'bonds_scenarios'
    };
    const table = tableMap[type];
    if (!table) return [];

    try {
      const { data, error } = await this.supabase
        .from(table)
        .select('id')
        .or(`source_entity_id.eq.${entityId},metadata->>${field}.not.is.null`)
        .limit(100);
      if (error) return [];
      return (data || []).map(r => ({ type, id: r.id }));
    } catch {
      return [];
    }
  }

  _diff(oldValue, newValue) {
    const oldNum = Number(oldValue);
    const newNum = Number(newValue);
    if (!isNaN(oldNum) && !isNaN(newNum) && oldNum !== 0) {
      return { changePercent: Math.round(((newNum - oldNum) / Math.abs(oldNum)) * 100 * 100) / 100 };
    }
    return { changed: JSON.stringify(oldValue) !== JSON.stringify(newValue) };
  }
}

module.exports = { DecisionImpactEngine };
