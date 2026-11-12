'use strict';

/**
 * Project Context — shared helpers that bind analysis tools to a single bonds_projects record.
 *
 * The API uses the service-role client, so project ownership must be enforced here
 * before any project_id supplied by the browser is stored or used.
 */

const crypto = require('crypto');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT_ANALYSIS_TYPES = Object.freeze(['feasibility_studies', 'risk_analysis']);

function normalizeProjectId(value) {
  const id = String(value === null || value === undefined ? '' : value).trim();
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

function requestedProjectId(body) {
  if (!body || typeof body !== 'object') return { provided: false, projectId: null };
  const raw = body.project_id !== undefined && body.project_id !== null && body.project_id !== ''
    ? body.project_id
    : body.context && typeof body.context === 'object' ? body.context.project_id : undefined;
  if (raw === undefined || raw === null || raw === '') return { provided: false, projectId: null };
  return { provided: true, projectId: normalizeProjectId(raw) };
}

async function loadOwnedProject(supabase, userId, projectId) {
  const id = normalizeProjectId(projectId);
  if (!supabase || !userId || !id) return null;
  const { data, error } = await supabase
    .from('bonds_projects')
    .select('id,user_id,name,sector,activity,status,deleted_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || data.deleted_at) return null;
  return data;
}

function reportNumber(now = new Date()) {
  return `BR-${now.getUTCFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function pickNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(n)) return n;
  }
  return null;
}

function summarizeExecution(resultBody) {
  const body = plainObject(resultBody);
  const result = plainObject(body.result);
  const metrics = plainObject(body.metrics && Object.keys(body.metrics).length ? body.metrics : result.metrics);
  return {
    action: body.action || null,
    execution_status: body.execution_status || null,
    engine_version: body.engine_version || result.engine_version || null,
    confidence: pickNumber(body.confidence, result.confidence, metrics.confidence),
    metrics
  };
}

function shouldRecordAnalysis(serviceCode) {
  return PROJECT_ANALYSIS_TYPES.includes(String(serviceCode || ''));
}

async function recordProjectAnalysis(supabase, { project, userId, serviceCode, language, inputs, resultBody, datasetId, geo }) {
  if (!supabase || !project || !userId || !shouldRecordAnalysis(serviceCode)) return null;
  const summary = summarizeExecution(resultBody);
  const row = {
    report_number: reportNumber(),
    project_id: project.id,
    type: serviceCode,
    language: language === 'en' ? 'en' : 'ar',
    status: 'generated',
    metadata: {
      source: 'service_execution',
      service_code: serviceCode,
      recorded_by: userId,
      dataset_id: datasetId || null,
      inputs: plainObject(inputs),
      geo: {
        country_code: geo && geo.country_code ? String(geo.country_code).toUpperCase() : null,
        sector: (geo && geo.sector) || null,
        activity: (geo && geo.activity) || null,
        city: (geo && geo.city) || null
      },
      ...summary,
      recorded_at: new Date().toISOString()
    }
  };
  const { data, error } = await supabase.from('bonds_reports').insert(row).select('id,report_number,type,generated_at').single();
  if (error) {
    console.warn('[project-context] analysis record failed:', error.message);
    return null;
  }
  return data;
}

module.exports = {
  PROJECT_ANALYSIS_TYPES,
  normalizeProjectId,
  requestedProjectId,
  loadOwnedProject,
  recordProjectAnalysis,
  shouldRecordAnalysis,
  summarizeExecution
};
