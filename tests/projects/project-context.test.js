/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const { createFakeSupabase } = require('../deals/fake-supabase');
const {
  normalizeProjectId,
  requestedProjectId,
  loadOwnedProject,
  recordProjectAnalysis,
  shouldRecordAnalysis
} = require('../../lib/projects/project-context');
const { ProjectAnalysisAdapter } = require('../../lib/enterprise-lifecycle/integrations/project-analysis-adapter');

const read = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DELETED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function seed() {
  return createFakeSupabase({
    bonds_projects: [
      { id: PROJECT, user_id: OWNER, name: 'Water plant', sector: 'manufacturing', metadata: {}, deleted_at: null },
      { id: DELETED, user_id: OWNER, name: 'Old', sector: null, metadata: {}, deleted_at: '2026-01-01T00:00:00Z' }
    ]
  });
}

describe('project context ownership', () => {
  test('normalizes only UUIDs', () => {
    expect(normalizeProjectId(PROJECT.toUpperCase())).toBe(PROJECT);
    expect(normalizeProjectId('../etc')).toBeNull();
    expect(normalizeProjectId(null)).toBeNull();
  });

  test('reads project_id from body or context and flags invalid values', () => {
    expect(requestedProjectId({})).toEqual({ provided: false, projectId: null });
    expect(requestedProjectId({ project_id: PROJECT })).toEqual({ provided: true, projectId: PROJECT });
    expect(requestedProjectId({ context: { project_id: PROJECT } })).toEqual({ provided: true, projectId: PROJECT });
    expect(requestedProjectId({ project_id: 'nope' })).toEqual({ provided: true, projectId: null });
  });

  test('loads only live projects owned by the caller', async () => {
    const sb = seed();
    expect((await loadOwnedProject(sb, OWNER, PROJECT)).id).toBe(PROJECT);
    expect(await loadOwnedProject(sb, OTHER, PROJECT)).toBeNull();
    expect(await loadOwnedProject(sb, OWNER, DELETED)).toBeNull();
    expect(await loadOwnedProject(sb, OWNER, 'not-a-uuid')).toBeNull();
  });
});

describe('project analysis records', () => {
  test('records feasibility and risk executions in bonds_reports', async () => {
    const sb = seed();
    const project = await loadOwnedProject(sb, OWNER, PROJECT);
    const record = await recordProjectAnalysis(sb, {
      project,
      userId: OWNER,
      serviceCode: 'feasibility_studies',
      language: 'ar',
      inputs: { revenue: 1000, initial_investment: 400 },
      resultBody: { executed: true, action: 'feasibility', result: { confidence: 82, metrics: { npv: 120 } } },
      geo: { country_code: 'sa', sector: 'manufacturing' }
    });
    expect(record.report_number).toMatch(/^BR-\d{4}-[0-9A-F]{8}$/);
    const [row] = sb.db.tables.bonds_reports;
    expect(row.project_id).toBe(PROJECT);
    expect(row.type).toBe('feasibility_studies');
    expect(row.metadata.inputs).toEqual({ revenue: 1000, initial_investment: 400 });
    expect(row.metadata.confidence).toBe(82);
    expect(row.metadata.metrics).toEqual({ npv: 120 });
    expect(row.metadata.geo.country_code).toBe('SA');
  });

  test('ignores services outside the project analysis set', async () => {
    const sb = seed();
    const project = await loadOwnedProject(sb, OWNER, PROJECT);
    expect(shouldRecordAnalysis('bookkeeping')).toBe(false);
    expect(await recordProjectAnalysis(sb, { project, userId: OWNER, serviceCode: 'bookkeeping', resultBody: {} })).toBeNull();
    expect(sb.db.tables.bonds_reports).toBeUndefined();
  });
});

describe('ProjectAnalysisAdapter', () => {
  function withReports() {
    const sb = seed();
    sb.db.tables.bonds_reports = [
      { id: 'r1', report_number: 'BR-2026-00000001', project_id: PROJECT, type: 'feasibility_studies', generated_at: '2026-11-01T00:00:00Z',
        metadata: { confidence: 70, inputs: { revenue: 1 }, metrics: {}, geo: { country_code: 'AE' } } },
      { id: 'r2', report_number: 'BR-2026-00000002', project_id: PROJECT, type: 'feasibility_studies', generated_at: '2026-11-10T00:00:00Z',
        metadata: { confidence: 88, inputs: { revenue: 2 }, metrics: { npv: 5 }, geo: { country_code: 'SA', sector: 'manufacturing' } } },
      { id: 'r3', report_number: 'BR-2026-00000003', project_id: PROJECT, type: 'risk_analysis', generated_at: '2026-11-05T00:00:00Z',
        metadata: { confidence: 60, inputs: {}, metrics: {}, geo: {} } }
    ];
    return sb;
  }

  test('feeds the latest feasibility inputs, country and analysis summary into the lifecycle context', async () => {
    const adapter = new ProjectAnalysisAdapter({ supabase: withReports() });
    const context = await adapter.enrich({
      instance: { entity_type: 'project', entity_id: PROJECT },
      context: { project: { id: PROJECT, sector: 'manufacturing', metadata: {} } }
    });
    expect(context.analysis.feasibility.reportNumber).toBe('BR-2026-00000002');
    expect(context.analysis.feasibility.confidence).toBe(88);
    expect(context.analysis.risk.reportNumber).toBe('BR-2026-00000003');
    expect(context.inputs).toEqual({ revenue: 2 });
    expect(context.project.country_code).toBe('SA');
  });

  test('keeps explicit inputs and an existing country', async () => {
    const adapter = new ProjectAnalysisAdapter({ supabase: withReports() });
    const context = await adapter.enrich({
      instance: { entity_type: 'project', entity_id: PROJECT },
      context: { inputs: { revenue: 99 }, project: { id: PROJECT, country_code: 'EG', metadata: {} } }
    });
    expect(context.inputs).toEqual({ revenue: 99 });
    expect(context.project.country_code).toBe('EG');
  });

  test('skips non-project entities', async () => {
    const adapter = new ProjectAnalysisAdapter({ supabase: withReports() });
    const base = { project: null };
    expect(await adapter.enrich({ instance: { entity_type: 'asset', entity_id: PROJECT }, context: base })).toBe(base);
  });

  test('runs before UcpAdapter in the default lifecycle adapters', () => {
    const engine = read('lib/enterprise-lifecycle/lifecycle-engine.js');
    const analysis = engine.indexOf('new ProjectAnalysisAdapter({ supabase })');
    expect(analysis).toBeGreaterThan(-1);
    expect(analysis).toBeLessThan(engine.indexOf('new UcpAdapter({ supabase })'));
  });
});

describe('project context wiring', () => {
  test('service execution verifies project ownership before running and records the analysis', () => {
    const services = read('v3/api/services.js');
    const execute = services.slice(services.indexOf('async function handleServiceExecute'));
    expect(execute.indexOf('loadOwnedProject(')).toBeGreaterThan(-1);
    expect(execute.indexOf('loadOwnedProject(')).toBeLessThan(execute.indexOf('executeService({'));
    expect(execute).toContain("error: { code: 'PROJECT_NOT_FOUND' }");
    expect(execute).toContain('recordProjectAnalysis(supabase');
    const intake = services.slice(services.indexOf('async function handleFinancialIntakePrepare'), services.indexOf('async function handleServiceExecute'));
    expect(intake).toContain('loadOwnedProject(supabase, user.id, intakeProject.projectId)');
  });

  test('workspace passes project_id from the URL into the execution context', () => {
    const client = read('components/service-request.js');
    expect(client).toContain("project_id:params.get('project_id')||null");
    expect(client).toContain("'/v3/project?id='");
  });

  test('valuation save links to the project only for a valid UUID', () => {
    const ui = read('valuation/valuation-ui.js');
    expect(ui).toContain("get('project_id')");
    expect(ui).toContain('if (projectId) payload.project_id = projectId;');
  });

  test('valuation bridge migration is additive, idempotent and ownership-checked', () => {
    const sql = read('supabase/migrations/20261112130000_project_context_valuation_bridge.sql');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS project_id uuid');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_asset_valuations_project_id');
    expect(sql).toContain('p.user_id = NEW.user_id');
    expect(sql).toContain("RAISE EXCEPTION 'PROJECT_NOT_OWNED'");
    expect(sql).toContain('ON CONFLICT (valuation_number) DO UPDATE');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.bonds_sync_asset_valuation_to_project() FROM PUBLIC');
    expect(sql).toContain('DROP TRIGGER IF EXISTS asset_valuations_project_bridge');
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|POLICY)/i);
  });

  test('readiness page persists through the institutional engine for a project', () => {
    const page = read('v3/project-readiness.html');
    expect(page).toContain("'/api/v3/investment-intelligence/readiness/' + encodeURIComponent(PROJECT_ID)");
    expect(page).toContain("'bonds_project_readiness_' + PROJECT_ID");
  });

  test('project command center links every analysis tool with the project id', () => {
    for (const file of ['v3/project/project-command-center.js', 'en/v3/project/project-command-center.js']) {
      const ecc = read(file);
      expect(ecc).toContain('service=feasibility_studies&project_id=${id}');
      expect(ecc).toContain('service=risk_analysis&project_id=${id}');
      expect(ecc).toContain('valuation/?project_id=${id}');
      expect(ecc).toContain('project-readiness?project_id=${id}');
      expect(ecc).toContain('${renderProjectToolsCard(project, role)}');
    }
  });
});
