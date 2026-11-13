'use strict';

const fs = require('fs');
const path = require('path');

describe('service execution and artifact persistence contract', () => {
  const api = fs.readFileSync(path.join(__dirname, '../../v3/api/services.js'), 'utf8');
  const ui = fs.readFileSync(path.join(__dirname, '../../components/service-request.js'), 'utf8');

  test('checks the Supabase insert result and requires a persisted artifact ID', () => {
    expect(api).toMatch(/data:artifact,\s*error:insertError/);
    expect(api).toMatch(/insertError\s*\|\|\s*!artifact\?\.id/);
    expect(api).toContain("artifactPersistence = { status:'saved', artifact_id:artifact.id }");
  });

  test('does not silently claim artifact persistence after a failed insert', () => {
    expect(api).toContain("artifactPersistence = { status:'failed', code:'INVESTMENT_ARTIFACT_SAVE_FAILED' }");
    expect(api).toContain('artifact_persistence:artifactPersistence');
    expect(ui).toContain("persistence?.status==='saved'&&persistence.artifact_id");
    expect(ui).toContain('تعذّر تأكيد حفظ المخرج في المشروع');
  });

  test('scopes service drafts to project/deal/opportunity, and unassigned drafts to a tab', () => {
    expect(ui).toContain("['project_id','deal_id','opportunity_id']");
    expect(ui).toContain("'bonds_service_workspace_draft_v2:'");
    expect(ui).toContain("workspaceDraftScope==='unassigned'?sessionStorage:localStorage");
    expect(ui).toContain('workspaceDraftStorage.getItem(workspaceDraftKey)');
    expect(ui).toContain('workspaceDraftStorage.setItem(workspaceDraftKey,');
  });

  test('scopes readiness drafts to one project, with tab-only unassigned drafts', () => {
    const readiness = fs.readFileSync(path.join(__dirname, '../../v3/project-readiness.html'), 'utf8');
    expect(readiness).toContain("'bonds_project_readiness_v2:project:' + projectId");
    expect(readiness).toContain('projectId ? localStorage : sessionStorage');
    expect(readiness).toContain('draftStorage.getItem(STORAGE_KEY)');
    expect(readiness).toContain('draftStorage.setItem(STORAGE_KEY, JSON.stringify(state))');
  });

  test('preserves unsubmitted local inputs when project artifact persistence fails', () => {
    const matches = ui.match(/if\(artifactSaved\)clearWorkspaceDraft\(\);/g) || [];
    expect(matches).toHaveLength(2);
    expect(ui).not.toMatch(/showStatus\(T\.executed,true\);\s*renderExecutionResult\(execution\);/);
  });
  test('rejects unowned or mismatched project context before running the engine', () => {
    const preflight = api.indexOf('if (body.project_id && artifactType)');
    const engine = api.indexOf('await executeService({ req, user, supabase, serviceCode, body })');
    expect(preflight).toBeGreaterThan(0);
    expect(engine).toBeGreaterThan(preflight);
    const check = api.slice(preflight, engine);
    expect(check).toContain('if (!user) return sendJson(res, 401');
    expect(check).toContain('await assertContextOwnership(supabase, user');
    expect(check).toContain("code:'UNAUTHORIZED'");
    expect(check).toContain("'PROJECT_CONTEXT_MISMATCH'");
    expect(check).toContain("'PROJECT_CONTEXT_NOT_FOUND'");
    expect(check).toContain('executed:false');
  });

});
