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

  test('preserves unsubmitted local inputs when project artifact persistence fails', () => {
    const matches = ui.match(/if\(artifactSaved\)clearWorkspaceDraft\(\);/g) || [];
    expect(matches).toHaveLength(2);
    expect(ui).not.toMatch(/showStatus\(T\.executed,true\);\s*renderExecutionResult\(execution\);/);
  });
});
