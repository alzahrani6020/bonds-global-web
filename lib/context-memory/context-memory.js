/**
 * BONDS Context Memory
 *
 * Persists the last known project context so users can resume work later.
 */

class ContextMemory {
  constructor(supabase) {
    this.supabase = supabase;
    this.localCache = new Map();
  }

  _localGet(projectId) {
    return this.localCache.get(projectId) || { recent_entities: [] };
  }

  _localSet(projectId, row) {
    this.localCache.set(projectId, row);
    return row;
  }

  async update(projectId, updates) {
    const row = {
      project_id: projectId,
      last_valuation_id: updates.lastValuationId,
      last_financing_id: updates.lastFinancingId,
      last_report_id: updates.lastReportId,
      last_scenario: updates.lastScenario,
      last_assumptions: updates.lastAssumptions || {},
      recent_entities: updates.recentEntities || []
    };
    if (!this.supabase) {
      const existing = this._localGet(projectId);
      const merged = { ...existing, ...row };
      return this._localSet(projectId, merged);
    }
    const { data, error } = await this.supabase
      .from('bonds_project_context_memory')
      .upsert(row, { onConflict: 'project_id' })
      .select('*')
      .single();
    if (error) throw new Error(`Context memory update failed: ${error.message}`);
    return data;
  }

  async get(projectId) {
    if (!this.supabase) return this._localGet(projectId);
    const { data, error } = await this.supabase
      .from('bonds_project_context_memory')
      .select('*')
      .eq('project_id', projectId)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(`Context memory fetch failed: ${error.message}`);
    return data;
  }

  async rememberEntity(projectId, entityType, entityId, meta = {}) {
    const existing = await this.get(projectId) || { recent_entities: [] };
    const recent = (existing.recent_entities || []).filter(e => !(e.type === entityType && e.id === entityId));
    recent.unshift({ type: entityType, id: entityId, ...meta, touched_at: new Date().toISOString() });
    return this.update(projectId, { recentEntities: recent.slice(0, 20) });
  }
}

module.exports = { ContextMemory };
