/**
 * Project Analysis Integration Adapter
 *
 * Feeds the latest project-linked feasibility and risk artifacts
 * (bonds_investment_artifacts) into the lifecycle context, and supplies
 * UcpAdapter with the same inputs and the project country so that
 * guard_feasibility_confidence is computed from the study the user actually ran.
 */

const ANALYSIS_TYPES = ['feasibility', 'risk'];

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function upperCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function pickNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toAnalysis(row) {
  if (!row) return null;
  const body = plainObject(row.results);
  const result = plainObject(body.result);
  const metrics = plainObject(Object.keys(plainObject(body.metrics)).length ? body.metrics : result.metrics);
  return {
    id: row.id,
    type: row.artifact_type,
    recordedAt: row.created_at,
    confidence: pickNumber(body.confidence, result.confidence, metrics.confidence),
    metrics,
    inputs: plainObject(row.inputs)
  };
}

class ProjectAnalysisAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ instance, context }) {
    if (!this.supabase || !instance || instance.entity_type !== 'project') return context;
    try {
      const { data: owned } = await this.supabase
        .from('bonds_projects')
        .select('id,user_id,sector,city_id,geo_snapshot,metadata')
        .eq('id', instance.entity_id)
        .maybeSingle();
      if (!owned || !owned.user_id) return context;

      const { data, error } = await this.supabase
        .from('bonds_investment_artifacts')
        .select('id,artifact_type,inputs,results,created_at')
        .eq('project_id', owned.id)
        .eq('user_id', owned.user_id)
        .in('artifact_type', ANALYSIS_TYPES)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(20);
      const rows = !error && Array.isArray(data) ? data : [];

      const feasibility = toAnalysis(rows.find(row => row.artifact_type === 'feasibility'));
      const risk = toAnalysis(rows.find(row => row.artifact_type === 'risk'));

      if (!feasibility && !risk) return context;
      const next = { ...context, analysis: { ...(context.analysis || {}), feasibility, risk } };
      const hasInputs = context.inputs && Object.keys(context.inputs).length > 0;
      const feasibilityInputs = feasibility && Object.keys(feasibility.inputs).length > 0 ? feasibility.inputs : null;
      if (!hasInputs && !feasibilityInputs) return next;
      if (!hasInputs) next.inputs = feasibilityInputs;

      const project = { ...owned, ...(context.project || {}) };
      if (!upperCode(project.country_code)) {
        const country = upperCode(plainObject(owned.metadata).country_code)
          || upperCode(plainObject(owned.geo_snapshot).country_code)
          || await this._cityCountry(owned.city_id)
          || await this._opportunityCountry(owned.id, owned.user_id);
        if (country) project.country_code = country;
      }
      next.project = project;
      return next;
    } catch (err) {
      console.warn('[ProjectAnalysisAdapter] enrich failed:', err.message);
      return context;
    }
  }

  async _cityCountry(cityId) {
    if (!cityId) return null;
    try {
      const { data } = await this.supabase.from('cities').select('country_code').eq('id', cityId).maybeSingle();
      return upperCode(data && data.country_code);
    } catch (err) {
      return null;
    }
  }

  async _opportunityCountry(projectId, userId) {
    try {
      const { data } = await this.supabase
        .from('bonds_investment_opportunities')
        .select('country_code')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .limit(1);
      return upperCode(Array.isArray(data) && data[0] && data[0].country_code);
    } catch (err) {
      return null;
    }
  }
}

module.exports = { ProjectAnalysisAdapter, toAnalysis };
