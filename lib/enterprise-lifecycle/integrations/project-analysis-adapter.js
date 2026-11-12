/**
 * Project Analysis Integration Adapter
 *
 * Feeds the latest project-linked feasibility and risk executions (bonds_reports)
 * into the lifecycle context, and supplies UcpAdapter with the same inputs and
 * country so that guard_feasibility_confidence is computed from the study the
 * user actually ran instead of an empty input set.
 */

const { PROJECT_ANALYSIS_TYPES } = require('../../projects/project-context');

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function upperCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function toAnalysis(row) {
  if (!row) return null;
  const metadata = plainObject(row.metadata);
  return {
    id: row.id,
    reportNumber: row.report_number,
    type: row.type,
    generatedAt: row.generated_at || row.created_at,
    confidence: metadata.confidence === null || metadata.confidence === undefined ? null : Number(metadata.confidence),
    metrics: plainObject(metadata.metrics),
    inputs: plainObject(metadata.inputs),
    geo: plainObject(metadata.geo)
  };
}

class ProjectAnalysisAdapter {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async enrich({ instance, context }) {
    if (!this.supabase || !instance || instance.entity_type !== 'project') return context;
    try {
      const { data, error } = await this.supabase
        .from('bonds_reports')
        .select('id,report_number,type,generated_at,created_at,metadata')
        .eq('project_id', instance.entity_id)
        .in('type', PROJECT_ANALYSIS_TYPES)
        .order('generated_at', { ascending: false })
        .limit(20);
      const rows = !error && Array.isArray(data) ? data : [];

      const feasibility = toAnalysis(rows.find(row => row.type === 'feasibility_studies'));
      const risk = toAnalysis(rows.find(row => row.type === 'risk_analysis'));

      const next = { ...context };
      if (feasibility || risk) {
        next.analysis = { ...(context.analysis || {}), feasibility, risk };
      }

      const project = context.project ? { ...context.project } : null;
      if (project && !upperCode(project.country_code)) {
        const country = upperCode(plainObject(project.metadata).country_code)
          || upperCode(plainObject(project.geo_snapshot).country_code)
          || await this._cityCountry(project.city_id)
          || upperCode(feasibility && feasibility.geo.country_code)
          || upperCode(risk && risk.geo.country_code);
        if (country) project.country_code = country;
      }
      if (project && !project.sector) {
        const sector = (feasibility && feasibility.geo.sector) || (risk && risk.geo.sector);
        if (sector) project.sector = sector;
      }
      if (project) next.project = project;

      const hasInputs = context.inputs && Object.keys(context.inputs).length > 0;
      if (!hasInputs && feasibility && Object.keys(feasibility.inputs).length > 0) {
        next.inputs = feasibility.inputs;
      }
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
}

module.exports = { ProjectAnalysisAdapter };
